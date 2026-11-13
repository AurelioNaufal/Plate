// One-time (re-runnable) import: gives every past Food expense a linked meal
// with estimated nutrition from the owner's FoodEstimates tab. Descriptions not
// in the table get a meal with blank values ("not tracked"), never 0.
import type { Row } from "../shared/schema";

export type Estimate = { name: string; kcal: number | null; protein: number | null; savedFood: boolean };

export function estimateKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function numberOrNull(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  const t = String(v ?? "").trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

const TRUTHY = new Set(["true", "yes", "y", "1"]);

/** values[0] is the header row: Description, Times, UsualPrice, Kcal, Protein, SavedFood (any order). */
export function parseEstimateTab(values: unknown[][]): Map<string, Estimate> {
  const out = new Map<string, Estimate>();
  if (values.length === 0) return out;
  const headers = values[0].map((h) => String(h ?? "").trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name.toLowerCase());
  const [d, k, p, s] = [col("Description"), col("Kcal"), col("Protein"), col("SavedFood")];
  if (d < 0) return out;
  for (const line of values.slice(1)) {
    const name = String(line[d] ?? "").trim();
    if (!name) continue;
    out.set(estimateKey(name), {
      name,
      kcal: k >= 0 ? numberOrNull(line[k]) : null,
      protein: p >= 0 ? numberOrNull(line[p]) : null,
      savedFood: s >= 0 && TRUTHY.has(String(line[s] ?? "").trim().toLowerCase()),
    });
  }
  return out;
}

function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  let best: T | undefined;
  let bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

type ImportInput = { transactions: Row[]; meals: Row[]; savedFoods: Row[]; estimates: Map<string, Estimate>; newId(): string; now: Date };

export function planFoodImport({ transactions, meals, savedFoods, estimates, newId, now }: ImportInput) {
  const txIds = new Set(transactions.map((t) => String(t.ID)));
  const orphanMealIds = meals
    .filter((m) => m.Estimated === true && m.TransactionID && !txIds.has(String(m.TransactionID)))
    .map((m) => String(m.ID));
  const linked = new Set(meals.filter((m) => m.TransactionID).map((m) => String(m.TransactionID)));

  const eligible = transactions.filter(
    (t) =>
      t.Type === "expense" &&
      String(t.Category ?? "").trim().toLowerCase() === "food" &&
      (t.Source === "migrated" || t.Source === "manual") &&
      !linked.has(String(t.ID)),
  );

  const newMeals: Row[] = [];
  const txUpdates: Row[] = [];
  let withNutrition = 0;
  for (const t of eligible) {
    const name = String(t.Description ?? "").trim() || "Food";
    const est = estimates.get(estimateKey(name));
    const kcal = est?.kcal ?? null;
    const protein = est?.protein ?? null;
    if (kcal !== null || protein !== null) withNutrition++;
    const id = newId();
    newMeals.push({
      ID: id, Date: t.Date, Time: null, Name: name, Kcal: kcal, Protein: protein,
      InBudget: true, TransactionID: String(t.ID), Items: null, Estimated: true, CreatedAt: now.toISOString(),
    });
    txUpdates.push({ ID: String(t.ID), MealID: id });
  }

  // Ticked foods become saved foods, named with the spelling used most often
  // and priced at the amount paid most often.
  const haveNames = new Set(savedFoods.map((f) => estimateKey(String(f.Name ?? ""))));
  let sortOrder = savedFoods.reduce((m, f) => Math.max(m, Number(f.SortOrder ?? 0)), 0);
  const newSavedFoods: Row[] = [];
  for (const [key, est] of estimates) {
    if (!est.savedFood || haveNames.has(key)) continue;
    const matching = transactions.filter(
      (t) => t.Type === "expense" && estimateKey(String(t.Description ?? "")) === key && typeof t.Amount === "number",
    );
    const spelling = mostCommon(matching.map((t) => String(t.Description).trim().replace(/\s+/g, " "))) ?? est.name;
    newSavedFoods.push({
      ID: newId(), Name: spelling, Kcal: est.kcal, Protein: est.protein,
      Price: mostCommon(matching.map((t) => t.Amount as number)) ?? null, SortOrder: ++sortOrder,
    });
    haveNames.add(key);
  }

  return {
    newMeals,
    txUpdates,
    orphanMealIds,
    newSavedFoods,
    stats: { linked: newMeals.length, withNutrition, notTracked: newMeals.length - withNutrition },
  };
}
