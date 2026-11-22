import type { WeeklyReview as Review } from "../../shared/review";
import { formatNT } from "../../shared/money";
import { formatShortDay } from "../format";

export const weekLabel = (r: Review) => `${formatShortDay(r.weekStart)} – ${formatShortDay(r.weekEnd)}`;

const signed = (n: number) => (n === 0 ? "same as" : `${n > 0 ? "+" : "−"}${formatNT(Math.abs(n))} vs`);
const kg = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)} kg`;

/** The Sunday review of one week: money, food, gym, weight, best-value meals. */
export function WeeklyReview({ review: r }: { review: Review }) {
  const rows: [string, string][] = [
    ["Spent", `${formatNT(r.spent)} · ${signed(r.change)} the week before`],
    ["Top", r.topCategories.length ? r.topCategories.map((c) => `${c.category} ${formatNT(c.amount)}`).join(" · ") : "—"],
    [
      "Protein",
      r.avgProtein === null
        ? "Not tracked"
        : `${r.avgProtein} g a day · target (${r.proteinTarget} g) hit ${r.proteinDays} of ${r.trackedDays} tracked ${r.trackedDays === 1 ? "day" : "days"}`,
    ],
    ["Calories", r.avgKcal === null ? "Not tracked" : `${r.avgKcal.toLocaleString("en-US")} kcal a day`],
    ["Gym", r.workouts === 1 ? "1 workout" : `${r.workouts} workouts`],
    [
      "Weight",
      r.weightChange !== null
        ? `Trend ${kg(r.weightChange)}${r.weightSince ? ` since ${formatShortDay(r.weightSince)}` : ""}`
        : r.weightNow !== null
          ? `Trend ${r.weightNow.toFixed(1)} kg · first weigh-ins`
          : "No weigh-ins",
    ],
  ];
  if (r.bestValue.length) {
    rows.push(["Best value", r.bestValue.map((b) => `${b.name} ${b.value.toFixed(1)} g per NT$10`).join(" · ")]);
  }
  return (
    <dl className="review-list">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="small muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
