import type { Row, TabName } from "./schema";
import { summarize } from "./aggregate";
import { addDays } from "./dates";
import { dayNutrition, proteinPerTen, roundProtein, targetsFrom } from "./meals";
import { sessionCount } from "./gym";
import { dailyWeights, weekTrendChange, weightTrend } from "./body";

export type WeeklyReview = {
  weekStart: string;
  weekEnd: string;
  spent: number;
  spentPrev: number;
  change: number;
  topCategories: { category: string; amount: number }[];
  /** Per day with at least one tracked value; null when none. */
  avgProtein: number | null;
  avgKcal: number | null;
  /** Days whose tracked protein reached the target, out of days with tracked protein. */
  proteinDays: number;
  trackedDays: number;
  proteinTarget: number;
  workouts: number;
  weightChange: number | null;
  /** The trend at the week's end when there were weigh-ins that week (shown when there's no change to compare). */
  weightNow: number | null;
  /** When the change is measured from a weigh-in more than a week before this one, its date. */
  weightSince: string | null;
  /** The week's paid meals with the most protein per NT$10, best first (one per name). */
  bestValue: { name: string; value: number }[];
};

/** The Sun–Sat week starting at weekStart, summed up for the Sunday review. */
export function weeklyReview(rows: Partial<Record<TabName, Row[]>>, weekStart: string): WeeklyReview {
  const weekEnd = addDays(weekStart, 6);
  const txs = rows.Transactions ?? [];
  const meals = rows.Meals ?? [];
  const week = summarize(txs, { kind: "custom", start: weekStart, end: weekEnd }, weekEnd);
  const prev = summarize(txs, { kind: "custom", start: addDays(weekStart, -7), end: addDays(weekStart, -1) }, weekEnd);

  const target = targetsFrom(rows.Settings ?? []).protein;
  let proteinSum = 0, trackedDays = 0, proteinDays = 0, kcalSum = 0, kcalDays = 0;
  for (let i = 0; i < 7; i++) {
    const n = dayNutrition(meals, addDays(weekStart, i));
    if (n.proteinMeals > 0) {
      trackedDays++;
      proteinSum += n.protein;
      if (n.protein >= target) proteinDays++;
    }
    if (n.kcalMeals > 0) {
      kcalDays++;
      kcalSum += n.kcal;
    }
  }

  const trend = weightTrend(dailyWeights(rows.Body ?? []));
  const lastAtOrBefore = (day: string) => [...trend].reverse().find((p) => p.date <= day) ?? null;
  const priceOf = new Map(txs.map((t) => [String(t.ID), t.Amount]));
  const best = new Map<string, { name: string; value: number }>();
  for (const m of meals) {
    if (typeof m.Date !== "string" || m.Date < weekStart || m.Date > weekEnd || !m.TransactionID) continue;
    const value = proteinPerTen(m.Protein, priceOf.get(String(m.TransactionID)));
    const name = String(m.Name ?? "").trim();
    if (value === null || !name) continue;
    const key = name.toLowerCase();
    const seen = best.get(key);
    if (!seen || value > seen.value) best.set(key, { name: seen?.name ?? name, value });
  }

  return {
    weekStart,
    weekEnd,
    spent: week.spent,
    spentPrev: prev.spent,
    change: week.spent - prev.spent,
    topCategories: week.byCategory.slice(0, 3).map(({ category, amount }) => ({ category, amount })),
    avgProtein: trackedDays ? roundProtein(proteinSum / trackedDays) : null,
    avgKcal: kcalDays ? Math.round(kcalSum / kcalDays) : null,
    proteinDays,
    trackedDays,
    proteinTarget: target,
    workouts: sessionCount(rows.Workouts ?? [], weekStart, weekEnd),
    weightChange: weekTrendChange(trend, weekStart),
    weightNow: trend.some((p) => p.date >= weekStart && p.date <= weekEnd) ? (lastAtOrBefore(weekEnd)?.kg ?? null) : null,
    weightSince: (() => {
      const before = lastAtOrBefore(addDays(weekStart, -1));
      return before && before.date < addDays(weekStart, -7) && weekTrendChange(trend, weekStart) !== null ? before.date : null;
    })(),
    bestValue: [...best.values()].sort((a, b) => b.value - a.value).slice(0, 3),
  };
}
