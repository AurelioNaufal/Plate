// Body: weigh-ins, the smoothed trend, BMI and the calorie estimate. Nothing
// here changes a target: suggestions are only offered, and the owner taps
// Update to accept one (spec §7.8, anti-goal "targets change on their own").
import type { Row } from "./schema";
import { addDays } from "./dates";
import { getSetting, targetsFrom } from "./meals";

const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** One weight per date (the latest row that day), oldest first. Blank weights are skipped. */
export function dailyWeights(body: Row[]): { date: string; kg: number }[] {
  const byDate = new Map<string, number>();
  for (const r of body) if (num(r.WeightKg) && typeof r.Date === "string") byDate.set(r.Date, r.WeightKg);
  return [...byDate].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, kg]) => ({ date, kg }));
}

/** At each weigh-in, the mean of the weigh-ins in the 7 days ending that day. */
export function weightTrend(daily: { date: string; kg: number }[]): { date: string; kg: number }[] {
  return daily.map(({ date }) => {
    const from = addDays(date, -6);
    const window = daily.filter((d) => d.date >= from && d.date <= date);
    return { date, kg: round1(window.reduce((s, d) => s + d.kg, 0) / window.length) };
  });
}

export type Profile = { heightCm: number | null; age: number | null; sex: "male" | "female" | null };

export function profileFrom(settings: Row[]): Profile {
  const positive = (id: string) => {
    const t = getSetting(settings, id);
    const n = t !== null && /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
    return n > 0 ? n : null;
  };
  const sex = getSetting(settings, "sex");
  return { heightCm: positive("heightCm"), age: positive("age"), sex: sex === "male" || sex === "female" ? sex : null };
}

/** BMI with Taiwan's adult ranges (Health Promotion Administration). */
export function bmi(kg: number | null, heightCm: number | null): { value: number; label: string } | null {
  if (!num(kg) || !num(heightCm) || heightCm <= 0) return null;
  const value = round1(kg / (heightCm / 100) ** 2);
  const label = value < 18.5 ? "Underweight" : value < 24 ? "Healthy" : value < 27 ? "Overweight" : "Obese";
  return { value, label };
}

/** Maintenance calories: Mifflin-St Jeor × 1.55 (about 4 training days a week), to the nearest 50. */
export function maintenanceKcal(p: Profile, kg: number | null): number | null {
  if (!num(kg) || p.heightCm === null || p.age === null || p.sex === null) return null;
  const bmr = 10 * kg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : -161);
  return Math.round((bmr * 1.55) / 50) * 50;
}

const round5 = (n: number) => Math.round(n / 5) * 5;

/**
 * New targets worth offering for this weight trend, or null. Protein is
 * 2 g/kg; calories are the maintenance estimate. A pair the owner said
 * "Not now" to stays hidden until the numbers change.
 */
export function targetSuggestion(settings: Row[], trendKg: number | null): { protein: number; kcal: number | null } | null {
  if (!num(trendKg)) return null;
  const protein = round5(2 * trendKg);
  const kcal = maintenanceKcal(profileFrom(settings), trendKg);
  const current = targetsFrom(settings);
  const proteinMoved = Math.abs(protein - current.protein) >= 5;
  const kcalMoved = kcal !== null && (current.kcal === null || Math.abs(kcal - current.kcal) >= 100);
  if (!proteinMoved && !kcalMoved) return null;
  if (getSetting(settings, "targetSuggestionDismissed") === suggestionKey({ protein, kcal })) return null;
  return { protein, kcal };
}

export const suggestionKey = (s: { protein: number; kcal: number | null }) => `${s.protein}|${s.kcal ?? ""}`;

/** Trend change over a week (Sun–Sat): trend by that Saturday minus trend by the Saturday before. */
export function weekTrendChange(trend: { date: string; kg: number }[], weekStart: string): number | null {
  const at = (day: string) => [...trend].reverse().find((p) => p.date <= day)?.kg ?? null;
  const end = at(addDays(weekStart, 6));
  const before = at(addDays(weekStart, -1));
  return end === null || before === null ? null : round1(end - before);
}
