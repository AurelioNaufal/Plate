import { parseOldLedger, ledgerStats, reportRows } from "../../src/shared/migrate";
import { oldLedger } from "../fixtures/oldLedger";

let n = 0;
const opts = { today: "2026-11-12", newId: () => `m${++n}` };

describe("parseOldLedger", () => {
  const result = parseOldLedger(oldLedger(), opts);

  test("imports the valid expense and income rows", () => {
    expect(result.transactions.filter((t) => t.Type === "expense")).toHaveLength(4);
    expect(result.transactions.filter((t) => t.Type === "income")).toHaveLength(1);
    expect(result.transactions.every((t) => t.Source === "migrated" && typeof t.ID === "string")).toBe(true);
  });

  test("trims text and converts dates and amounts", () => {
    expect(result.transactions.find((t) => t.Amount === 80)).toMatchObject({
      Date: "2026-11-12", Description: "Buffet lunch", Category: "Food", Type: "expense",
    });
  });

  test("flags an income dated before the first expense instead of importing it", () => {
    const gift = result.flagged.find((f) => f.cells.includes("Gift from aunt"));
    expect(gift?.block).toBe("income");
    expect(gift?.reason).toContain("before first entry");
    expect(gift?.sheetRow).toBe(6);
  });

  test("a split bill with cents is imported rounded to the nearest NT$ and flagged", () => {
    expect(result.transactions.find((t) => t.Description === "Half-price snack")?.Amount).toBe(50);
    expect(result.flagged.find((f) => f.cells.includes("$49.50"))?.reason).toContain("rounded");
  });

  test("a $0.00 amount is flagged and skipped", () => {
    const r = parseOldLedger(oldLedger([["11/10/2026", "$0.00", "Noodles (215 NT)", "Food"]]), opts);
    expect(r.transactions.some((t) => t.Description === "Noodles (215 NT)")).toBe(false);
    expect(r.flagged.find((f) => f.cells.includes("Noodles (215 NT)"))?.reason).toContain("amount");
  });

  test("totals imported rows by month and type", () => {
    expect(result.stats.byMonth["2025-08"].expense).toBe(1302);
    expect(result.stats.count.income).toBe(1);
  });

  test("source stats include every row with a readable amount", () => {
    expect(result.sourceStats.count.income).toBe(2);
    expect(result.sourceStats.count.expense).toBe(4);
  });
});

test("finds blocks when the Date and Amount header cells are blank (as the real export shows)", () => {
  const values = [
    ["0", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "Start Date"],
    ["", "", "", "Description", "Category", "", "", "", "Description", "Category", "Category"],
    ["", "8/26/2025", "$1,240.00", "Desk lamp", "Furniture", "", "8/26/2025", "$3,000.00", "Family support", "Family", ""],
  ];
  const r = parseOldLedger(values, opts);
  expect(r.transactions.map((t) => [t.Type, t.Amount, t.Category])).toEqual([
    ["expense", 1240, "Furniture"],
    ["income", 3000, "Family"],
  ]);
});

test("a future-dated row is flagged", () => {
  const r = parseOldLedger(oldLedger([["11/13/2026", "$50.00", "Tomorrow", "Food"]]), opts);
  expect(r.flagged.find((f) => f.cells.includes("Tomorrow"))?.reason).toContain("future");
  expect(r.transactions.some((t) => t.Description === "Tomorrow")).toBe(false);
});

test("an unknown category is imported but flagged", () => {
  const r = parseOldLedger(oldLedger([["11/10/2026", "$120.00", "Veg", "Groceries"]]), opts);
  expect(r.transactions.some((t) => t.Category === "Groceries")).toBe(true);
  expect(r.flagged.find((f) => f.cells.includes("Groceries"))?.reason).toContain("unknown category");
});

test("a row with no category is flagged and skipped", () => {
  const r = parseOldLedger(oldLedger([["11/10/2026", "$30.00", "Mystery", ""]]), opts);
  expect(r.transactions.some((t) => t.Description === "Mystery")).toBe(false);
  expect(r.flagged.find((f) => f.cells.includes("Mystery"))?.reason).toContain("category");
});

describe("reportRows", () => {
  const rows = reportRows(parseOldLedger(oldLedger(), opts));
  test("compares old and imported totals per month", () => {
    expect(rows.find((r) => r[0] === "2025-08")?.slice(0, 5)).toEqual(["2025-08", 1302, 1302, 3000, 3000]);
  });
  test("lists each flagged row with its reason", () => {
    const gift = rows.find((r) => r.includes("Gift from aunt"));
    expect(gift?.[0]).toBe(6);
    expect(String(gift?.[gift.length - 1])).toContain("before first entry");
  });
  test("every row has the same width so it can be written as one block", () => {
    expect(new Set(rows.map((r) => r.length)).size).toBe(1);
  });
});

test("ledgerStats sums by category", () => {
  const s = ledgerStats([
    { Type: "expense", Date: "2026-11-12", Amount: 80, Category: "Food" },
    { Type: "expense", Date: "2026-11-11", Amount: 20, Category: "Food" },
  ]);
  expect(s.byCategory.Food).toBe(100);
});
