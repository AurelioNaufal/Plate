import { MemoryStore, rowsFromValues, valuesForRow, normalizeRow } from "../../src/backend/store";

describe("rowsFromValues", () => {
  test("maps columns by header name, not position", () => {
    const rows = rowsFromValues("Transactions", [
      ["Category", "ID", "Amount", "Date"],
      ["Food", "a1", "80", "2026-11-12"],
    ]);
    expect(rows[0]).toMatchObject({ ID: "a1", Amount: 80, Category: "Food", Date: "2026-11-12" });
  });

  test("ignores unknown headers and drops blank rows", () => {
    const rows = rowsFromValues("Transactions", [
      ["ID", "Notes", "Amount"],
      ["a1", "hello", 80],
      ["", "", ""],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("Notes");
  });
});

describe("normalizeRow", () => {
  test("turns a Date object into its Taipei calendar date", () => {
    expect(normalizeRow("Transactions", { Date: new Date("2026-11-12T16:30:00Z") }).Date).toBe("2026-11-13");
  });
  test("a hand-typed M/D/YYYY date becomes YYYY-MM-DD", () => {
    expect(normalizeRow("Transactions", { Date: "11/12/2026" }).Date).toBe("2026-11-12");
  });
  test("an unreadable date string is kept as typed", () => {
    expect(normalizeRow("Transactions", { Date: "sometime" }).Date).toBe("sometime");
  });
  test("reads TRUE text as boolean true", () => {
    expect(normalizeRow("Categories", { Hidden: "TRUE" }).Hidden).toBe(true);
  });
  test("reads numeric text as a number and empty text as null", () => {
    const r = normalizeRow("Transactions", { Amount: "80", Description: "" });
    expect(r.Amount).toBe(80);
    expect(r.Description).toBeNull();
  });
});

test("valuesForRow follows the given header order", () => {
  expect(valuesForRow(["Category", "ID"], { ID: "x", Category: "Food" })).toEqual(["Food", "x"]);
});

describe("MemoryStore", () => {
  test("append then read returns the rows", () => {
    const s = new MemoryStore();
    s.append("Transactions", [{ ID: "a", Amount: 1 }]);
    expect(s.read("Transactions")).toEqual([{ ID: "a", Amount: 1 }]);
  });
  test("update of a missing ID returns false", () => {
    expect(new MemoryStore().update("Transactions", { ID: "nope" })).toBe(false);
  });
  test("remove counts only rows that existed", () => {
    const s = new MemoryStore({ Transactions: [{ ID: "a" }, { ID: "b" }] });
    expect(s.remove("Transactions", ["a", "zz"])).toBe(1);
    expect(s.read("Transactions")).toEqual([{ ID: "b" }]);
  });
  test("renameInColumn changes matching cells, optionally filtered, and counts them", () => {
    const s = new MemoryStore({
      Transactions: [
        { ID: "a", Type: "expense", Category: "Other" },
        { ID: "b", Type: "income", Category: "Other" },
        { ID: "c", Type: "expense", Category: "Food" },
      ],
    });
    expect(s.renameInColumn("Transactions", "Category", "Other", "Misc", { column: "Type", equals: "expense" })).toBe(1);
    expect(s.read("Transactions").map((r) => r.Category)).toEqual(["Misc", "Other", "Food"]);
  });
  test("fillMissingIds gives blank-ID rows distinct new IDs", () => {
    const s = new MemoryStore({ Transactions: [{ ID: null, Amount: 1 }, { ID: "", Amount: 2 }, { ID: "keep", Amount: 3 }] });
    let n = 0;
    expect(s.fillMissingIds("Transactions", () => `new${++n}`)).toBe(2);
    const ids = s.read("Transactions").map((r) => r.ID);
    expect(ids).toEqual(["new1", "new2", "keep"]);
  });
});
