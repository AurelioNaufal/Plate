// @vitest-environment jsdom
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { DataProvider, useData } from "../../src/app/store";
import { ApiError, type Api } from "../../src/app/api";
import type { Row, TabName } from "../../src/shared/schema";
import type { Change } from "../../src/shared/changes";

// batch goes through this fake's own upsert/remove, so a test can make either fail.
function fakeApi(over: Partial<Api> = {}): Api & { upserts: Row[][]; batches: Change[][] } {
  const upserts: Row[][] = [];
  const batches: Change[][] = [];
  const api = {
    upserts,
    batches,
    ping: async () => ({ serverTime: "" }),
    list: async () => ({ Transactions: [], Categories: [] }),
    upsert: async (_tab: string, rows: Row[]) => {
      upserts.push(rows);
      return { rows };
    },
    remove: async () => ({ removed: 1 }),
    renameCategory: async () => ({ updatedTransactions: 0 }),
    batch: async (changes: Change[]) => {
      batches.push(changes);
      const saved: { tab: TabName; row: Row }[] = [];
      let removed = 0;
      for (const c of changes) {
        if ("row" in c) saved.push(...(await api.upsert(c.tab, [c.row])).rows.map((row) => ({ tab: c.tab, row })));
        else removed += (await api.remove(c.tab, [c.removeId])).removed;
      }
      return { saved, removed };
    },
    ...over,
  } as Api & { upserts: Row[][]; batches: Change[][] };
  return api;
}

const wrap = (api: Api | null) => ({ children }: { children: ReactNode }) => <DataProvider api={api}>{children}</DataProvider>;

test("without a saved connection the status is needs-setup", () => {
  const { result } = renderHook(() => useData(), { wrapper: wrap(null) });
  expect(result.current.status).toBe("needs-setup");
});

test("loads all tabs and becomes ready", async () => {
  const api = fakeApi({ list: async () => ({ Transactions: [{ ID: "t1", Amount: 80 }] }) } as Partial<Api>);
  const { result } = renderHook(() => useData(), { wrapper: wrap(api) });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.rows.Transactions).toEqual([{ ID: "t1", Amount: 80 }]);
  expect(result.current.rows.Meals).toEqual([]);
});

test("a failed save shows the row at once and keeps it pending with an error", async () => {
  let fail = true;
  const api = fakeApi();
  const realUpsert = api.upsert;
  api.upsert = async (tab, rows) => {
    if (fail) throw new ApiError("NETWORK", "Can't reach the server");
    return realUpsert(tab, rows);
  };
  const { result } = renderHook(() => useData(), { wrapper: wrap(api) });
  await waitFor(() => expect(result.current.status).toBe("ready"));

  await act(() => result.current.save("Transactions", { Type: "expense", Amount: 80 }));
  const saved = result.current.rows.Transactions[0];
  expect(saved.Amount).toBe(80);
  expect(saved.ID).toBeTruthy();
  expect(result.current.pending).toHaveLength(1);
  expect(result.current.pending[0].error).toContain("Can't reach");

  fail = false;
  await act(() => result.current.retry(String(saved.ID)));
  expect(api.upserts.at(-1)?.[0].ID).toBe(saved.ID);
  expect(result.current.pending).toHaveLength(0);
});

test("apply shows linked rows at once, keeps one pending entry on failure, and retries as one batch", async () => {
  let fail = true;
  const api = fakeApi();
  const realBatch = api.batch;
  api.batch = async (changes) => {
    if (fail) {
      api.batches.push(changes);
      throw new ApiError("NETWORK", "Can't reach the server");
    }
    return realBatch(changes);
  };
  const { result } = renderHook(() => useData(), { wrapper: wrap(api) });
  await waitFor(() => expect(result.current.status).toBe("ready"));

  const changes: Change[] = [
    { tab: "Meals", row: { ID: "m1", Name: "Buffet lunch", TransactionID: "t1" } },
    { tab: "Transactions", row: { ID: "t1", Type: "expense", Amount: 80, MealID: "m1" } },
  ];
  await act(() => result.current.apply(changes));
  expect(result.current.rows.Meals.map((m) => m.ID)).toEqual(["m1"]);
  expect(result.current.rows.Transactions.map((t) => t.ID)).toEqual(["t1"]);
  expect(result.current.pending).toHaveLength(1);
  expect(result.current.pending[0]).toMatchObject({ id: "m1", tab: "Meals", error: expect.stringContaining("Can't reach") });

  fail = false;
  await act(() => result.current.retry("m1"));
  expect(api.batches).toHaveLength(2);
  expect(api.batches[1]).toEqual(changes);
  expect(result.current.pending).toHaveLength(0);
});

test("apply with a remove drops the row locally", async () => {
  const api = fakeApi({ list: async () => ({ Meals: [{ ID: "m1" }], Transactions: [{ ID: "t1" }, { ID: "t2" }] }) } as Partial<Api>);
  const { result } = renderHook(() => useData(), { wrapper: wrap(api) });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(() => result.current.apply([{ tab: "Meals", removeId: "m1" }, { tab: "Transactions", removeId: "t1" }]));
  expect(result.current.rows.Meals).toEqual([]);
  expect(result.current.rows.Transactions.map((t) => t.ID)).toEqual(["t2"]);
  expect(api.batches).toHaveLength(1);
});

test("renameCategory renames it and its transactions locally after the server agrees", async () => {
  const api = fakeApi({
    list: async () => ({
      Categories: [{ ID: "c1", Name: "Food", Type: "expense" }],
      Transactions: [{ ID: "t1", Type: "expense", Category: "Food" }, { ID: "t2", Type: "expense", Category: "Health" }],
    }),
    renameCategory: async () => ({ updatedTransactions: 1 }),
  } as Partial<Api>);
  const { result } = renderHook(() => useData(), { wrapper: wrap(api) });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.renameCategory("c1", "Meals");
  });
  expect(outcome).toEqual({ ok: true });
  expect(result.current.rows.Categories[0].Name).toBe("Meals");
  expect(result.current.rows.Transactions.map((t) => t.Category)).toEqual(["Meals", "Health"]);
});

test("renameCategory reports a conflict and changes nothing", async () => {
  const api = fakeApi({
    list: async () => ({ Categories: [{ ID: "c1", Name: "Food", Type: "expense" }] }),
    renameCategory: async () => {
      throw new ApiError("CONFLICT", 'A expense category named "Health" already exists');
    },
  } as Partial<Api>);
  const { result } = renderHook(() => useData(), { wrapper: wrap(api) });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.renameCategory("c1", "Health");
  });
  expect(outcome).toMatchObject({ ok: false, error: expect.stringContaining("already exists") });
  expect(result.current.rows.Categories[0].Name).toBe("Food");
});

test("remove drops the row locally and calls the API", async () => {
  const removed: string[] = [];
  const api = fakeApi({
    list: async () => ({ Transactions: [{ ID: "t1" }, { ID: "t2" }] }),
    remove: async (_tab: string, ids: string[]) => {
      removed.push(...ids);
      return { removed: ids.length };
    },
  } as Partial<Api>);
  const { result } = renderHook(() => useData(), { wrapper: wrap(api) });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(() => result.current.remove("Transactions", "t1"));
  expect(result.current.rows.Transactions.map((r) => r.ID)).toEqual(["t2"]);
  expect(removed).toEqual(["t1"]);
});
