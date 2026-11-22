import { useMemo, useState } from "react";
import { useData } from "../store";
import { addDays, todayTaipei, weekRange } from "../../shared/dates";
import { formatNT } from "../../shared/money";
import { weeklyReview } from "../../shared/review";
import { BackHeader } from "../components/BackHeader";
import { WeeklyReview, weekLabel } from "../components/WeeklyReview";
import { formatShortDay } from "../format";

/** The last 12 finished Sun–Sat weeks, newest first; tap one to see its review. */
export function Reviews({ today = todayTaipei(), onBack }: { today?: string; onBack(): void }) {
  const { rows } = useData();
  const lastWeek = weekRange(addDays(today, -7)).start;
  const reviews = useMemo(
    () => Array.from({ length: 12 }, (_, i) => weeklyReview(rows, addDays(lastWeek, -7 * i))),
    [rows, lastWeek],
  );
  const [open, setOpen] = useState<string | null>(null);

  return (
    <main className="screen">
      <BackHeader title="Weekly reviews" onBack={onBack} />
      <section className="card">
        <ul className="list" aria-label="Past weeks" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {reviews.map((r) => (
            <li key={r.weekStart}>
              <button className="list-row" aria-expanded={open === r.weekStart} onClick={() => setOpen(open === r.weekStart ? null : r.weekStart)}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{weekLabel(r)}</span>
                  <span className="small muted">{`${formatNT(r.spent)} · ${r.workouts === 1 ? "1 workout" : `${r.workouts} workouts`}`}</span>
                </span>
                <span className="muted" aria-hidden="true">{open === r.weekStart ? "▴" : "▾"}</span>
              </button>
              {open === r.weekStart && (
                <section aria-label={`Week of ${formatShortDay(r.weekStart)}`} style={{ padding: "4px 0 12px" }}>
                  <WeeklyReview review={r} />
                </section>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
