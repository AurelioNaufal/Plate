import { useData } from "../store";
import { periodFor, summarize } from "../../shared/aggregate";
import { todayTaipei } from "../../shared/dates";
import { formatNT } from "../../shared/money";
import { formatLongDay } from "../format";

export function Today({ today = todayTaipei() }: { today?: string }) {
  const { rows } = useData();
  const day = summarize(rows.Transactions, { kind: "custom", start: today, end: today }, today);
  const week = summarize(rows.Transactions, periodFor("week", today), today);

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">{formatLongDay(today)}</div>
          <h1>Today</h1>
        </div>
      </header>

      <section className="card grid-2" aria-label="Spending" style={{ display: "grid" }}>
        <div>
          <div className="stat-label">Spent today</div>
          <div className="stat-value">{formatNT(day.spent)}</div>
        </div>
        <div>
          <div className="stat-label">This week (Sun–Sat)</div>
          <div className="stat-value">{formatNT(week.spent)}</div>
        </div>
      </section>

      <section className="card">
        <h2>Meals, workouts and your weekly charges</h2>
        <p className="muted small" style={{ margin: 0 }}>These arrive in the next update.</p>
      </section>
    </main>
  );
}
