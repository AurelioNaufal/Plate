import { planMealSave, planMealDelete, dayNutrition, parseNutritionInput, itemsLabel, foodCategory, getSetting, targetsFrom, type MealInput } from "../../src/shared/meals";

test("targetsFrom defaults protein to 120 and leaves calories blank", () => {
  expect(targetsFrom([])).toEqual({ protein: 120, kcal: null });
  expect(targetsFrom([{ ID: "proteinTarget", Value: "130" }, { ID: "kcalTarget", Value: "2200" }])).toEqual({ protein: 130, kcal: 2200 });
  // Unreadable or zero values fall back instead of breaking the rings.
  expect(targetsFrom([{ ID: "proteinTarget", Value: "lots" }, { ID: "kcalTarget", Value: "0" }])).toEqual({ protein: 120, kcal: null });
  expect(getSetting([{ ID: "x", Value: 5 }], "x")).toBe("5");
  expect(getSetting([{ ID: "x", Value: null }], "x")).toBeNull();
  expect(getSetting([], "x")).toBeNull();
});
import { applyChanges, changeId, type Change } from "../../src/shared/changes";
import type { Row, TabName } from "../../src/shared/schema";
import { TAB_NAMES } from "../../src/shared/schema";

const categories: Row[] = [
  { ID: "c1", Name: "Food", Type: "expense", Hidden: false, SortOrder: 1 },
  { ID: "c2", Name: "Utilities", Type: "expense", Hidden: false, SortOrder: 2 },
];
const now = new Date("2026-11-13T04:10:00Z");
let n = 0;
const newId = () => `id${++n}`;

const input = (over: Partial<MealInput> = {}): MealInput => ({
  name: "Prasmanan", price: "80", inBudget: true, kcal: "650", protein: "32",
  date: "2026-11-13", time: "12:10", items: "Rice, Chicken breast", ...over,
});

const upserts = (cs: Change[], tab: TabName) => cs.filter((c): c is { tab: TabName; row: Row } => "row" in c && c.tab === tab);
const removes = (cs: Change[]) => cs.filter((c): c is { tab: TabName; removeId: string } => "removeId" in c);

function save(i: MealInput, ctx: { existingMeal?: Row; existingTx?: Row } = {}) {
  const r = planMealSave(i, { ...ctx, categories, newId, now });
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r.changes;
}

describe("planMealSave", () => {
  test("a new paid meal gives one linked meal row and one expense row", () => {
    const cs = save(input());
    expect(cs).toHaveLength(2);
    const meal = upserts(cs, "Meals")[0].row;
    const tx = upserts(cs, "Transactions")[0].row;
    expect(meal).toMatchObject({ InBudget: true, Estimated: false, TransactionID: tx.ID, Kcal: 650, Protein: 32, Name: "Prasmanan", Items: "Rice, Chicken breast" });
    expect(tx).toMatchObject({ Type: "expense", Amount: 80, Category: "Food", Description: "Prasmanan", Source: "app", MealID: meal.ID, Date: "2026-11-13" });
  });

  test("a food-only meal gives just the meal row", () => {
    const cs = save(input({ inBudget: false, price: "" }));
    expect(cs).toHaveLength(1);
    expect(upserts(cs, "Meals")[0].row.TransactionID).toBeNull();
  });

  test("a paid meal needs a price", () => {
    expect(planMealSave(input({ price: "" }), { categories, newId, now })).toEqual({
      ok: false, field: "price", error: "Enter a price, or turn off Count in budget",
    });
  });

  test("a bad price shows the amount error on the price field", () => {
    expect(planMealSave(input({ price: "80.5" }), { categories, newId, now })).toMatchObject({ ok: false, field: "price", error: "Use whole NT$ (no cents)" });
  });

  test("a name is required", () => {
    expect(planMealSave(input({ name: "  " }), { categories, newId, now })).toMatchObject({ ok: false, field: "name", error: "Enter a name" });
  });

  test("bad nutrition is reported on its field", () => {
    expect(planMealSave(input({ protein: "abc" }), { categories, newId, now })).toMatchObject({ ok: false, field: "protein", error: "Use a number" });
    expect(planMealSave(input({ kcal: "-5" }), { categories, newId, now })).toMatchObject({ ok: false, field: "kcal", error: "Can't be negative" });
  });

  test("blank nutrition is stored as null (not tracked)", () => {
    const meal = upserts(save(input({ kcal: "", protein: " " })), "Meals")[0].row;
    expect(meal.Kcal).toBeNull();
    expect(meal.Protein).toBeNull();
  });

  describe("editing", () => {
    const first = save(input());
    const meal = upserts(first, "Meals")[0].row;
    const tx = upserts(first, "Transactions")[0].row;

    test("changing the price updates the same expense row", () => {
      const cs = save(input({ price: "95" }), { existingMeal: meal, existingTx: tx });
      expect(removes(cs)).toHaveLength(0);
      const t = upserts(cs, "Transactions");
      expect(t).toHaveLength(1);
      expect(t[0].row).toMatchObject({ ID: tx.ID, Amount: 95 });
      expect(upserts(cs, "Meals")[0].row).toMatchObject({ ID: meal.ID, TransactionID: tx.ID });
    });

    test("turning Count in budget off removes the expense", () => {
      const cs = save(input({ inBudget: false }), { existingMeal: meal, existingTx: tx });
      expect(removes(cs).map((c) => c.removeId)).toEqual([tx.ID]);
      expect(upserts(cs, "Transactions")).toHaveLength(0);
      expect(upserts(cs, "Meals")[0].row).toMatchObject({ ID: meal.ID, InBudget: false, TransactionID: null });
    });

    test("turning Count in budget on creates a new expense", () => {
      const foodOnly = upserts(save(input({ inBudget: false, price: "" })), "Meals")[0].row;
      const cs = save(input({ price: "60" }), { existingMeal: foodOnly });
      const t = upserts(cs, "Transactions")[0].row;
      expect(t).toMatchObject({ Amount: 60, MealID: foodOnly.ID });
      expect(upserts(cs, "Meals")[0].row.TransactionID).toBe(t.ID);
    });

    test("an imported expense becomes app-owned; a manual one keeps its source", () => {
      const migrated = save(input(), { existingMeal: meal, existingTx: { ...tx, Source: "migrated" } });
      expect(upserts(migrated, "Transactions")[0].row.Source).toBe("app");
      const manual = save(input(), { existingMeal: meal, existingTx: { ...tx, Source: "manual" } });
      expect(upserts(manual, "Transactions")[0].row.Source).toBe("manual");
    });

    test("editing an estimated meal makes it the owner's", () => {
      const cs = save(input(), { existingMeal: { ...meal, Estimated: true }, existingTx: tx });
      expect(upserts(cs, "Meals")[0].row.Estimated).toBe(false);
    });
  });
});

describe("planMealDelete", () => {
  test("a paid meal removes both rows; a food-only meal removes one", () => {
    expect(planMealDelete({ ID: "m1", TransactionID: "t1" }).map(changeId).sort()).toEqual(["m1", "t1"]);
    expect(planMealDelete({ ID: "m2", TransactionID: null })).toEqual([{ tab: "Meals", removeId: "m2" }]);
  });
});

test("dayNutrition leaves blank values out instead of counting 0", () => {
  const meals: Row[] = [
    { ID: "a", Date: "2026-11-13", Time: "19:00", Protein: 30, Kcal: 500 },
    { ID: "b", Date: "2026-11-13", Time: null, Protein: null, Kcal: 300 },
    { ID: "c", Date: "2026-11-13", Time: "08:00", Protein: 20, Kcal: null },
    { ID: "d", Date: "2026-11-12", Time: "12:00", Protein: 99, Kcal: 999 },
  ];
  const d = dayNutrition(meals, "2026-11-13");
  expect(d).toMatchObject({ kcal: 800, protein: 50, kcalMeals: 2, proteinMeals: 2 });
  expect(d.meals.map((m) => m.ID)).toEqual(["c", "a", "b"]);
});

test("parseNutritionInput", () => {
  expect(parseNutritionInput("")).toEqual({ ok: true, value: null });
  expect(parseNutritionInput("   ")).toEqual({ ok: true, value: null });
  expect(parseNutritionInput("7.5")).toEqual({ ok: true, value: 7.5 });
  expect(parseNutritionInput("-1")).toEqual({ ok: false, error: "Can't be negative" });
  expect(parseNutritionInput("abc")).toEqual({ ok: false, error: "Use a number" });
});

test("itemsLabel lists counted items with ×n", () => {
  expect(itemsLabel([{ name: "Rice", count: 1 }, { name: "Chicken breast", count: 2 }, { name: "Tofu", count: 0 }])).toBe("Rice, Chicken breast ×2");
});

test("foodCategory matches Food in any case, else the first visible expense category", () => {
  expect(foodCategory([{ Name: "food", Type: "expense" }])).toBe("food");
  expect(
    foodCategory([
      { Name: "Rent", Type: "expense", SortOrder: 2 },
      { Name: "Hidden one", Type: "expense", SortOrder: 0, Hidden: true },
      { Name: "Transport", Type: "expense", SortOrder: 1 },
      { Name: "Food", Type: "income", SortOrder: 0 },
    ]),
  ).toBe("Transport");
  expect(foodCategory([])).toBeNull();
});

test("applyChanges upserts by ID and removes by ID without touching the input", () => {
  const rows = Object.fromEntries(TAB_NAMES.map((t) => [t, [] as Row[]])) as Record<TabName, Row[]>;
  rows.Meals = [{ ID: "m1", Name: "Old" }];
  rows.Transactions = [{ ID: "t1" }];
  const next = applyChanges(rows, [
    { tab: "Meals", row: { ID: "m1", Name: "New" } },
    { tab: "Meals", row: { ID: "m2", Name: "Added" } },
    { tab: "Transactions", removeId: "t1" },
  ]);
  expect(next.Meals.map((m) => m.Name)).toEqual(["New", "Added"]);
  expect(next.Transactions).toEqual([]);
  expect(rows.Meals[0].Name).toBe("Old");
});
