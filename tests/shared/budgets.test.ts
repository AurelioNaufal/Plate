import { budgetStatus } from "../../src/shared/budgets";
import type { Row } from "../../src/shared/schema";

const cats: Row[] = [
  { ID: "c1", Name: "Food", Type: "expense", SortOrder: 1 },
  { ID: "c2", Name: "Health", Type: "expense", SortOrder: 2 },
  { ID: "c3", Name: "Rent", Type: "expense", SortOrder: 3 },
];
const tx = (Amount: number, Category: string, Date = "2026-11-05", Source = "app", Type = "expense"): Row => ({ ID: `${Category}${Amount}${Date}`, Type, Date, Amount, Category, Source });
const b = (Category: string, MonthlyLimit: number): Row => ({ ID: `b-${Category}`, Category, MonthlyLimit });

test("levels: under 80% ok, 80% to 100% warn, above over", () => {
  const at = (spent: number) => budgetStatus([b("Food", 1000)], [tx(spent, "Food")], "2026-11", cats)[0];
  expect(at(799)).toMatchObject({ level: "ok", spent: 799, left: 201 });
  expect(at(800).level).toBe("warn");
  expect(at(1000).level).toBe("warn");
  expect(at(1001)).toMatchObject({ level: "over", left: -1 });
});

test("only that month's expenses count, recurring charges included; income doesn't", () => {
  const txs = [tx(300, "Health", "2026-11-01", "recurring"), tx(100, "Health", "2026-10-31"), tx(500, "Health", "2026-11-02", "app", "income")];
  expect(budgetStatus([b("Health", 1000)], txs, "2026-11", cats)[0]).toMatchObject({ spent: 300, share: 0.3 });
});

test("only budgeted categories, in category order", () => {
  const s = budgetStatus([b("Rent", 6500), b("Food", 6000)], [], "2026-11", cats);
  expect(s.map((x) => x.category)).toEqual(["Food", "Rent"]);
  expect(s[0]).toEqual({ category: "Food", limit: 6000, spent: 0, left: 6000, share: 0, level: "ok" });
});

test("a budget row without a usable limit is ignored", () => {
  expect(budgetStatus([{ ID: "x", Category: "Food", MonthlyLimit: null }], [], "2026-11", cats)).toEqual([]);
});
