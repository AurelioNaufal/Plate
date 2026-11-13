// Meals: one form logs nutrition and, when it counts in the budget, the
// matching Food expense. Blank kcal or protein means "not tracked" and is
// left out of every total (never counted as 0).
import type { Row } from "./schema";
import type { Change } from "./changes";
import { parseAmountInput } from "./money";

export type NutritionInput = { ok: true; value: number | null } | { ok: false; error: string };

export function parseNutritionInput(s: string): NutritionInput {
  const t = s.trim().replace(/,/g, "");
  if (t === "") return { ok: true, value: null };
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { ok: false, error: "Use a number" };
  const n = Number(t);
  if (n < 0) return { ok: false, error: "Can't be negative" };
  return { ok: true, value: n };
}

export const roundKcal = (n: number) => Math.round(n);
export const roundProtein = (n: number) => Math.round(n * 10) / 10;

/** The expense category paid meals go to: "Food" (any case), else the first visible expense category. */
export function foodCategory(categories: Row[]): string | null {
  const expense = categories.filter((c) => c.Type === "expense");
  const food = expense.find((c) => String(c.Name ?? "").trim().toLowerCase() === "food");
  if (food) return String(food.Name);
  const first = expense
    .filter((c) => !c.Hidden)
    .sort((a, b) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0))[0];
  return first ? String(first.Name) : null;
}

export type MealInput = {
  name: string;
  price: string;
  inBudget: boolean;
  kcal: string;
  protein: string;
  date: string;
  time: string;
  items: string;
};

type MealField = "name" | "price" | "kcal" | "protein";
export type MealPlan = { ok: true; changes: Change[] } | { ok: false; field: MealField; error: string };

export function planMealSave(
  input: MealInput,
  ctx: { existingMeal?: Row; existingTx?: Row; categories: Row[]; newId(): string; now: Date },
): MealPlan {
  const name = input.name.trim();
  if (!name) return { ok: false, field: "name", error: "Enter a name" };

  const kcal = parseNutritionInput(input.kcal);
  if (!kcal.ok) return { ok: false, field: "kcal", error: kcal.error };
  const protein = parseNutritionInput(input.protein);
  if (!protein.ok) return { ok: false, field: "protein", error: protein.error };

  let amount: number | null = null;
  if (input.inBudget) {
    if (input.price.trim() === "") return { ok: false, field: "price", error: "Enter a price, or turn off Count in budget" };
    const p = parseAmountInput(input.price);
    if (!p.ok) return { ok: false, field: "price", error: p.error };
    amount = p.value;
  }

  const { existingMeal, existingTx } = ctx;
  const mealId = existingMeal?.ID ? String(existingMeal.ID) : ctx.newId();
  const changes: Change[] = [];
  let txId: string | null = null;

  if (amount !== null) {
    txId = existingTx?.ID ? String(existingTx.ID) : ctx.newId();
    const keepSource = existingTx?.Source && existingTx.Source !== "migrated" ? existingTx.Source : "app";
    changes.push({
      tab: "Transactions",
      row: {
        ...(existingTx ?? {}),
        ID: txId,
        Type: "expense",
        Date: input.date,
        Amount: amount,
        Description: name,
        Category: (existingTx?.Category as string | undefined) ?? foodCategory(ctx.categories),
        Source: keepSource,
        MealID: mealId,
      },
    });
  } else if (existingTx?.ID) {
    changes.push({ tab: "Transactions", removeId: String(existingTx.ID) });
  }

  changes.unshift({
    tab: "Meals",
    row: {
      ...(existingMeal ?? {}),
      ID: mealId,
      Date: input.date,
      Time: input.time.trim() || null,
      Name: name,
      Kcal: kcal.value === null ? null : roundKcal(kcal.value),
      Protein: protein.value === null ? null : roundProtein(protein.value),
      InBudget: amount !== null,
      TransactionID: txId,
      Items: input.items.trim() || null,
      Estimated: false,
    },
  });
  return { ok: true, changes };
}

export function planMealDelete(meal: Row): Change[] {
  const out: Change[] = [{ tab: "Meals", removeId: String(meal.ID) }];
  if (meal.TransactionID) out.push({ tab: "Transactions", removeId: String(meal.TransactionID) });
  return out;
}

const tracked = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function dayNutrition(meals: Row[], date: string) {
  const day = meals
    .filter((m) => m.Date === date)
    .sort((a, b) => {
      const ta = a.Time ? String(a.Time) : "~";
      const tb = b.Time ? String(b.Time) : "~";
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
  let kcal = 0, protein = 0, kcalMeals = 0, proteinMeals = 0;
  for (const m of day) {
    if (tracked(m.Kcal)) { kcal += m.Kcal; kcalMeals++; }
    if (tracked(m.Protein)) { protein += m.Protein; proteinMeals++; }
  }
  return { kcal, protein: roundProtein(protein), kcalMeals, proteinMeals, meals: day };
}

export function itemsLabel(counts: { name: string; count: number }[]): string {
  return counts
    .filter((c) => c.count > 0)
    .map((c) => (c.count > 1 ? `${c.name} ×${c.count}` : c.name))
    .join(", ");
}
