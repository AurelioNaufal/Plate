// @vitest-environment jsdom
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { DataProvider, useData } from "../../src/app/store";
import { ApiError, type Api } from "../../src/app/api";
import type { Row } from "../../src/shared/schema";

function fakeApi(over: Partial<Api> = {}): Api & { upserts: Row[][] } {
  const upserts: Row[][] = [];
  return {
    upserts,
    ping: async () => ({ serverTime: "" }),
    list: async () => ({ Transactions: [], Categories: [] }),
    upsert: async (_tab: string, rows: Row[]) => {
      upserts.push(rows);
      return { rows };
    },
    remove: async () => ({ removed: 1 }),
    renameCategory: async () => ({ updatedTransactions: 0 }),
    ...over,
  } as Api & { upserts: Row[][] };
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
