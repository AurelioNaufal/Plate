import { estimateKey, parseEstimateTab, planFoodImport } from "../../src/backend/foodEstimates";
import { applyChanges } from "../../src/shared/changes";
import type { Row } from "../../src/shared/schema";

const NOW = new Date("2026-11-13T05:00:00Z");
const tx = (ID: string, Description: string, Amount: number, over: Row = {}): Row => ({
  ID, Type: "expense", Date: "2026-10-01", Amount, Description, Category: "Food", Source: "migrated", ...over,
});

const estimates = parseEstimateTab([
  ["Description", "Times", "UsualPrice", "Kcal", "Protein", "SavedFood"],
  ["chicken rice", 3, 90, 600, 25, "TRUE"],
  ["mystery snack", 1, 40, "", "", ""],
]);

const transactions: Row[] = [
  tx("t1", "Chicken Rice", 90),
  tx("t2", "chicken  rice ", 90),
  tx("t3", "Chicken Rice", 85),
  tx("t4", "Mystery Snack", 40),
  tx("t5", "Bus", 15, { Category: "Transportation" }),
];

let n = 0;
const newId = () => `n${++n}`;

describe("planFoodImport", () => {
  const plan = planFoodImport({ transactions, meals: [], savedFoods: [], estimates, newId, now: NOW });

  test("links one estimated meal to every past Food expense", () => {
    expect(plan.newMeals).toHaveLength(4);
    const byTx = new Map(plan.newMeals.map((m) => [m.TransactionID, m]));
    for (const id of ["t1", "t2", "t3"]) {
      expect(byTx.get(id)).toMatchObject({ Kcal: 600, Protein: 25, Estimated: true, InBudget: true, Time: null, Items: null, Date: "2026-10-01", CreatedAt: NOW.toISOString() });
    }
    expect(byTx.get("t4")).toMatchObject({ Name: "Mystery Snack", Kcal: null, Protein: null, Estimated: true });
  });

  test("points each expense at its meal and leaves other categories alone", () => {
    expect(plan.txUpdates).toHaveLength(4);
    const meal = plan.newMeals.find((m) => m.TransactionID === "t1")!;
    expect(plan.txUpdates).toContainEqual({ ID: "t1", MealID: meal.ID });
    expect(plan.txUpdates.some((u) => u.ID === "t5")).toBe(false);
  });

  test("adds a ticked food as a saved food at its most common price", () => {
    expect(plan.newSavedFoods).toEqual([expect.objectContaining({ Name: "Chicken Rice", Price: 90, Kcal: 600, Protein: 25, SortOrder: 1 })]);
  });

  test("counts what it did", () => {
    expect(plan.stats).toEqual({ linked: 4, withNutrition: 3, notTracked: 1 });
  });

  test("running again changes nothing", () => {
    let rows = { Transactions: transactions, Meals: [] as Row[], SavedFoods: [] as Row[] } as never as Record<string, Row[]>;
    rows = applyChanges(rows as never, [
      ...plan.newMeals.map((row) => ({ tab: "Meals" as const, row })),
      ...plan.newSavedFoods.map((row) => ({ tab: "SavedFoods" as const, row })),
    ]) as never;
    rows.Transactions = transactions.map((t) => ({ ...t, ...(plan.txUpdates.find((u) => u.ID === t.ID) ?? {}) }));
    const again = planFoodImport({ transactions: rows.Transactions, meals: rows.Meals, savedFoods: rows.SavedFoods, estimates, newId, now: NOW });
    expect(again.newMeals).toEqual([]);
    expect(again.newSavedFoods).toEqual([]);
    expect(again.txUpdates).toEqual([]);
  });

  test("an existing saved food of the same name (any case) is not added again", () => {
    const again = planFoodImport({ transactions, meals: [], savedFoods: [{ ID: "s1", Name: "CHICKEN RICE", SortOrder: 4 }], estimates, newId, now: NOW });
    expect(again.newSavedFoods).toEqual([]);
  });

  test("new saved foods continue the SortOrder", () => {
    const again = planFoodImport({ transactions, meals: [], savedFoods: [{ ID: "s1", Name: "Toast", SortOrder: 4 }], estimates, newId, now: NOW });
    expect(again.newSavedFoods[0].SortOrder).toBe(5);
  });

  test("expenses logged in the app get no estimated meal", () => {
    const appTx = [tx("a1", "Chicken Rice", 90, { Source: "app" }), tx("a2", "Chicken Rice", 90, { Source: "recurring" })];
    expect(planFoodImport({ transactions: appTx, meals: [], savedFoods: [], estimates, newId, now: NOW }).newMeals).toEqual([]);
  });

  test("hand-typed expenses are included, whether marked manual or left blank in the Sheet", () => {
    const manual = [tx("m1", "Chicken Rice", 90, { Source: "manual" }), tx("m2", "Chicken Rice", 90, { Source: null })];
    expect(planFoodImport({ transactions: manual, meals: [], savedFoods: [], estimates, newId, now: NOW }).newMeals).toHaveLength(2);
  });

  test("only estimated meals whose expense is gone are orphans", () => {
    const meals: Row[] = [
      { ID: "e1", Estimated: true, TransactionID: "gone" },
      { ID: "e2", Estimated: false, TransactionID: "gone" },
      { ID: "e3", Estimated: true, TransactionID: "t1" },
      { ID: "e4", Estimated: true, TransactionID: null },
    ];
    expect(planFoodImport({ transactions, meals, savedFoods: [], estimates, newId, now: NOW }).orphanMealIds).toEqual(["e1"]);
  });

  test("an expense whose meal is an orphan-to-be is linked again", () => {
    // After a migration re-run, the tx IDs are new; the old estimated meals point nowhere.
    const meals: Row[] = [{ ID: "old", Estimated: true, TransactionID: "gone" }];
    const p = planFoodImport({ transactions, meals, savedFoods: [], estimates, newId, now: NOW });
    expect(p.orphanMealIds).toEqual(["old"]);
    expect(p.newMeals).toHaveLength(4);
  });
});

test("parseEstimateTab matches headers by name and tolerates odd cells", () => {
  const m = parseEstimateTab([
    ["SavedFood", "Kcal", "Description", "Protein"],
    ["yes", "abc", "  Milk   Tea ", "3.5"],
    ["", "", "", ""],
  ]);
  expect(m.get("milk tea")).toEqual({ name: "Milk   Tea", kcal: null, protein: 3.5, savedFood: true });
  expect(m.size).toBe(1);
});

test("estimateKey lowercases, trims and collapses spaces", () => {
  expect(estimateKey("  Chicken   RICE ")).toBe("chicken rice");
});
