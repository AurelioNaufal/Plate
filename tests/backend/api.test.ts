import { handleRequest } from "../../src/backend/api";
import { MemoryStore } from "../../src/backend/store";
import type { Row, TabName } from "../../src/shared/schema";

const TOKEN = "secret";
const NOW = new Date("2026-11-12T04:00:00Z");

function setup(initial: Partial<Record<TabName, Row[]>> = {}) {
  const store = new MemoryStore(initial);
  let n = 0;
  const ctx = { store, token: TOKEN, now: NOW, newId: () => `id${++n}` };
  const call = (body: unknown) => handleRequest(typeof body === "string" ? body : JSON.stringify(body), ctx);
  return { store, call };
}

const tx = (over: Row = {}): Row => ({ Type: "expense", Date: "2026-11-12", Amount: 80, Description: "Buffet lunch", Category: "Food", Source: "app", ...over });

const categories: Row[] = [
  { ID: "c1", Name: "Food", Type: "expense", Hidden: false, SortOrder: 1 },
  { ID: "c2", Name: "Health", Type: "expense", Hidden: false, SortOrder: 2 },
  { ID: "c3", Name: "Family", Type: "income", Hidden: false, SortOrder: 1 },
];

describe("auth and request shape", () => {
  test("wrong or missing token is UNAUTHORIZED", () => {
    const { call } = setup();
    expect(call({ token: "nope", action: "ping" })).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
    expect(call({ action: "ping" })).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
  });
  test("invalid JSON is BAD_REQUEST", () => {
    expect(setup().call("{not json")).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
  });
  test("unknown tab is BAD_REQUEST", () => {
    expect(setup().call({ token: TOKEN, action: "list", tabs: ["Nope"] })).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
  });
  test("ping returns server time", () => {
    expect(setup().call({ token: TOKEN, action: "ping" })).toEqual({ ok: true, data: { serverTime: NOW.toISOString() } });
  });
});

describe("upsert", () => {
  test("a row without ID gets one from newId, plus CreatedAt", () => {
    const res = setup().call({ token: TOKEN, action: "upsert", tab: "Transactions", rows: [tx()] });
    expect(res).toMatchObject({ ok: true, data: { rows: [{ ID: "id1", CreatedAt: NOW.toISOString() }] } });
  });
  test("sending the same ID twice leaves one row with the latest values", () => {
    const { store, call } = setup();
    call({ token: TOKEN, action: "upsert", tab: "Transactions", rows: [tx({ ID: "t1", Amount: 80 })] });
    call({ token: TOKEN, action: "upsert", tab: "Transactions", rows: [tx({ ID: "t1", Amount: 95 })] });
    const rows = store.read("Transactions");
    expect(rows).toHaveLength(1);
    expect(rows[0].Amount).toBe(95);
  });
  test.each([
    ["Type transfer", { Type: "transfer" }],
    ["fractional Amount", { Amount: 80.5 }],
    ["zero Amount", { Amount: 0 }],
    ["bad Date", { Date: "12/11/2026" }],
  ])("rejects a transaction with %s", (_label, over) => {
    const res = setup().call({ token: TOKEN, action: "upsert", tab: "Transactions", rows: [tx(over as Row)] });
    expect(res).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
  });
  test("a duplicate category name of the same type is CONFLICT", () => {
    const res = setup({ Categories: categories }).call({
      token: TOKEN, action: "upsert", tab: "Categories", rows: [{ Name: "food", Type: "expense" }],
    });
    expect(res).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
  test("the same name as an income category is allowed for expenses", () => {
    const res = setup({ Categories: categories }).call({
      token: TOKEN, action: "upsert", tab: "Categories", rows: [{ Name: "Family", Type: "expense" }],
    });
    expect(res.ok).toBe(true);
  });
});

describe("remove", () => {
  test("returns the count removed", () => {
    const { call } = setup({ Transactions: [tx({ ID: "a" }), tx({ ID: "b" })] });
    expect(call({ token: TOKEN, action: "remove", tab: "Transactions", ids: ["a", "zz"] })).toEqual({ ok: true, data: { removed: 1 } });
  });
});

describe("batch", () => {
  const meal = (over: Row = {}): Row => ({ ID: "m1", Date: "2026-11-12", Name: "Buffet lunch", Kcal: 650, Protein: 32, InBudget: true, TransactionID: "t1", ...over });
  const linked = (txOver: Row = {}) => ({
    token: TOKEN,
    action: "batch",
    ops: [
      { op: "upsert", tab: "Meals", rows: [meal()] },
      { op: "upsert", tab: "Transactions", rows: [tx({ ID: "t1", MealID: "m1", ...txOver })] },
    ],
  });

  test("writes a meal and its expense in one request", () => {
    const { store, call } = setup();
    const res = call(linked());
    expect(res).toMatchObject({ ok: true, data: { removed: 0 } });
    if (!res.ok) throw new Error();
    expect((res.data as { saved: { tab: string }[] }).saved.map((s) => s.tab)).toEqual(["Meals", "Transactions"]);
    expect(store.read("Meals")).toHaveLength(1);
    expect(store.read("Transactions")[0]).toMatchObject({ ID: "t1", MealID: "m1", CreatedAt: NOW.toISOString() });
  });

  test("a bad row anywhere in the batch writes nothing", () => {
    const { store, call } = setup();
    expect(call(linked({ Amount: 0 }))).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
    expect(store.read("Meals")).toHaveLength(0);
    expect(store.read("Transactions")).toHaveLength(0);
  });

  test("sending the same batch twice leaves one row in each tab", () => {
    const { store, call } = setup();
    call(linked());
    call(linked());
    expect(store.read("Meals")).toHaveLength(1);
    expect(store.read("Transactions")).toHaveLength(1);
  });

  test("removing a missing ID gives removed 0 without an error", () => {
    const res = setup().call({ token: TOKEN, action: "batch", ops: [{ op: "remove", tab: "Transactions", ids: ["zz"] }] });
    expect(res).toEqual({ ok: true, data: { saved: [], removed: 0 } });
  });

  test("removes and upserts together", () => {
    const { store, call } = setup({ Meals: [meal()], Transactions: [tx({ ID: "t1" })] });
    const res = call({
      token: TOKEN, action: "batch",
      ops: [
        { op: "upsert", tab: "Meals", rows: [meal({ InBudget: false, TransactionID: null })] },
        { op: "remove", tab: "Transactions", ids: ["t1"] },
      ],
    });
    expect(res).toMatchObject({ ok: true, data: { removed: 1 } });
    expect(store.read("Transactions")).toHaveLength(0);
    expect(store.read("Meals")[0].InBudget).toBe(false);
  });

  test("more than 50 ops is BAD_REQUEST", () => {
    const ops = Array.from({ length: 51 }, () => ({ op: "remove", tab: "Transactions", ids: [] }));
    expect(setup().call({ token: TOKEN, action: "batch", ops })).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
  });

  test("an unknown op is BAD_REQUEST", () => {
    expect(setup().call({ token: TOKEN, action: "batch", ops: [{ op: "drop", tab: "Meals" }] })).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
  });
});

describe("renameCategory", () => {
  const initial = () => ({
    Categories: categories,
    Transactions: [tx({ ID: "t1" }), tx({ ID: "t2" }), tx({ ID: "t3", Category: "Health" })],
    Budgets: [{ ID: "b1", Category: "Food", MonthlyLimit: 6000 }],
  });
  test("renames the category and every row that uses it", () => {
    const { store, call } = setup(initial());
    expect(call({ token: TOKEN, action: "renameCategory", id: "c1", name: "Meals" })).toEqual({ ok: true, data: { updatedTransactions: 2 } });
    expect(store.read("Categories").find((c) => c.ID === "c1")?.Name).toBe("Meals");
    expect(store.read("Transactions").filter((t) => t.Category === "Meals")).toHaveLength(2);
    expect(store.read("Budgets")[0].Category).toBe("Meals");
  });
  test("renaming to an existing name of the same type is CONFLICT", () => {
    expect(setup(initial()).call({ token: TOKEN, action: "renameCategory", id: "c1", name: "Health" })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
  test("unknown category id is NOT_FOUND", () => {
    expect(setup(initial()).call({ token: TOKEN, action: "renameCategory", id: "zz", name: "X" })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("recurring", () => {
  const gym: Row = { ID: "r1", Name: "Gym", Amount: 40, Category: "Health", Frequency: "weekly", Weekday: 0, Active: true, StartDate: "2026-11-15" };
  const sundayNoon = new Date("2026-11-15T04:00:00Z");

  test("list adds the charges due today before reading Transactions", () => {
    const store = new MemoryStore({ Recurring: [gym], Transactions: [] });
    const res = handleRequest(JSON.stringify({ token: TOKEN, action: "list", tabs: ["Transactions", "Recurring"] }), {
      store, token: TOKEN, now: sundayNoon, newId: () => "x",
    });
    if (!res.ok) throw new Error("list failed");
    const data = res.data as Record<string, Row[]>;
    expect(data.Transactions).toEqual([expect.objectContaining({ ID: "rec_r1_2026-11-15", Source: "recurring", Amount: 40 })]);
    expect(data.Recurring[0].ChargedThrough).toBe("2026-11-15");
  });

  test("list without Transactions does not charge", () => {
    const store = new MemoryStore({ Recurring: [gym], Transactions: [] });
    handleRequest(JSON.stringify({ token: TOKEN, action: "list", tabs: ["Recurring"] }), { store, token: TOKEN, now: sundayNoon, newId: () => "x" });
    expect(store.read("Transactions")).toEqual([]);
  });

  test.each([
    ["Weekday 7", { Weekday: 7 }],
    ["fractional Weekday", { Weekday: 1.5 }],
    ["no Name", { Name: " " }],
    ["zero Amount", { Amount: 0 }],
    ["unknown Frequency", { Frequency: "daily" }],
    ["monthly without MonthDay", { Frequency: "monthly", MonthDay: null }],
    ["MonthDay 32", { Frequency: "monthly", MonthDay: 32 }],
    ["bad StartDate", { StartDate: "soon" }],
  ])("rejects a Recurring row with %s", (_label, over) => {
    const res = setup().call({ token: TOKEN, action: "upsert", tab: "Recurring", rows: [{ ...gym, ...(over as Row) }] });
    expect(res).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
  });

  test("a valid monthly row is accepted", () => {
    const res = setup().call({ token: TOKEN, action: "upsert", tab: "Recurring", rows: [{ ...gym, Frequency: "monthly", Weekday: null, MonthDay: 31 }] });
    expect(res.ok).toBe(true);
  });

  test("saving an item from an old copy never moves ChargedThrough back", () => {
    const { store, call } = setup({ Recurring: [{ ...gym, ChargedThrough: "2026-11-29" }] });
    call({ token: TOKEN, action: "upsert", tab: "Recurring", rows: [{ ...gym, Active: false, ChargedThrough: "2026-11-15" }] });
    expect(store.read("Recurring")[0]).toMatchObject({ Active: false, ChargedThrough: "2026-11-29" });
    call({ token: TOKEN, action: "upsert", tab: "Recurring", rows: [{ ...gym, ChargedThrough: null }] });
    expect(store.read("Recurring")[0].ChargedThrough).toBe("2026-11-29");
  });
});

describe("list", () => {
  test("hand-typed rows get a stable ID and Source manual", () => {
    const { call } = setup({ Transactions: [tx({ ID: null, Source: null })] });
    const first = call({ token: TOKEN, action: "list", tabs: ["Transactions"] });
    const second = call({ token: TOKEN, action: "list", tabs: ["Transactions"] });
    if (!first.ok || !second.ok) throw new Error("list failed");
    const a = (first.data as Record<string, Row[]>).Transactions[0];
    const b = (second.data as Record<string, Row[]>).Transactions[0];
    expect(a.ID).toBeTruthy();
    expect(a.Source).toBe("manual");
    expect(b.ID).toBe(a.ID);
  });
});
