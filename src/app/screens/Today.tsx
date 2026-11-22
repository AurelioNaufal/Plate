import { useMemo } from "react";
import { useData } from "../store";
import { periodFor, summarize } from "../../shared/aggregate";
import { monthKey, todayTaipei, weekday } from "../../shared/dates";
import { budgetStatus } from "../../shared/budgets";
import { routinesForDay } from "../../shared/gym";
import { formatNT } from "../../shared/money";
import { dayNutrition, roundProtein, targetsFrom } from "../../shared/meals";
import { upcomingCharges } from "../../shared/recurring";
import type { Row } from "../../shared/schema";
import { formatLongDay, formatShortDay } from "../format";
import { Ring } from "../components/Rings";

type Props = {
  today?: string;
  onOpenMeal?(id: string): void;
  onOpenTargets?(): void;
  onOpenRecurring?(): void;
  onStartWorkout?(routineId: string | null): void;
  onOpenGym?(): void;
};

const num = (n: number) => n.toLocaleString("en-US");

function nutritionText(m: Row): string {
  const parts: string[] = [];
  if (typeof m.Protein === "number") parts.push(`${m.Protein} g`);
  if (typeof m.Kcal === "number") parts.push(`${num(m.Kcal)} kcal`);
  return parts.length ? parts.join(" · ") : "no nutrition";
}

export function Today({ today = todayTaipei(), onOpenMeal, onOpenTargets, onOpenRecurring, onStartWorkout, onOpenGym }: Props) {
  const { rows } = useData();
  const txs = rows.Transactions ?? [];
  const day = summarize(txs, { kind: "custom", start: today, end: today }, today);
  const week = summarize(txs, periodFor("week", today), today);
  const nutrition = dayNutrition(rows.Meals ?? [], today);
  const targets = targetsFrom(rows.Settings ?? []);
  const upcoming = upcomingCharges(rows.Recurring ?? [], today);
  const txById = useMemo(() => new Map(txs.map((t) => [String(t.ID), t])), [txs]);

  const food = budgetStatus(rows.Budgets ?? [], txs, monthKey(today), rows.Categories ?? []).find((b) => b.category === "Food");
  const setsToday = (rows.Workouts ?? []).filter((w) => w.Date === today).length;
  const todaysRoutines = routinesForDay(rows.Routines ?? [], weekday(today));

  const proteinLeft = roundProtein(targets.protein - nutrition.protein);
  const kcalLeft = targets.kcal === null ? null : targets.kcal - nutrition.kcal;

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">{formatLongDay(today)}</div>
          <h1>Today</h1>
        </div>
      </header>

      <section className="card grid-2" aria-label="Today's nutrition" style={{ display: "grid" }}>
        <div className="ring-stat">
          <Ring value={nutrition.protein} target={targets.protein} color="var(--accent)" label={`Protein ${nutrition.protein} of ${targets.protein} grams`} />
          <div>
            <div className="stat-label">Protein</div>
            <div className="stat-value">{`${nutrition.protein}g / ${targets.protein}g`}</div>
            <div className="small muted">{proteinLeft > 0 ? `${proteinLeft}g to go` : "Target hit"}</div>
          </div>
        </div>
        <div className="ring-stat">
          <Ring
            value={nutrition.kcal}
            target={targets.kcal}
            color="var(--kcal)"
            label={targets.kcal === null ? `${nutrition.kcal} calories, no target set` : `Calories ${nutrition.kcal} of ${targets.kcal}`}
          />
          <div>
            <div className="stat-label">Calories</div>
            <div className="stat-value">{`${num(nutrition.kcal)} kcal`}</div>
            {kcalLeft === null ? (
              <button className="btn-link" style={{ minHeight: 0, textAlign: "left" }} onClick={onOpenTargets}>Set a calorie target</button>
            ) : (
              <div className="small muted">{kcalLeft >= 0 ? `${num(kcalLeft)} left` : `${num(-kcalLeft)} over`}</div>
            )}
          </div>
        </div>
      </section>

      <section className="card grid-2" aria-label="Spending" style={{ display: "grid" }}>
        <div>
          <div className="stat-label">Spent today</div>
          <div className="stat-value">{formatNT(day.spent)}</div>
        </div>
        <div>
          <div className="stat-label">This week (Sun–Sat)</div>
          <div className="stat-value">{formatNT(week.spent)}</div>
        </div>
        {food && (
          <div className="small" style={{ gridColumn: "1 / -1", fontWeight: 600, color: food.level === "over" ? "var(--danger)" : food.level === "warn" ? "var(--kcal)" : "var(--muted)" }}>
            {food.left < 0 ? `${formatNT(-food.left)} over Food budget this month` : `${formatNT(food.left)} left of Food budget this month`}
          </div>
        )}
      </section>

      <section className="card" aria-label="Today's workout">
        <h2>Today's workout</h2>
        {setsToday > 0 ? (
          <button className="list-row" onClick={onOpenGym}>
            <span style={{ fontWeight: 600 }}>{`Done today · ${setsToday} ${setsToday === 1 ? "set" : "sets"}`}</span>
            <span className="muted" aria-hidden="true">›</span>
          </button>
        ) : todaysRoutines.length === 0 ? (
          <div className="row-between">
            <span className="muted">No routine today</span>
            <button className="btn btn-secondary" onClick={() => onStartWorkout?.(null)}>Start blank workout</button>
          </div>
        ) : (
          todaysRoutines.map((r) => (
            <div key={String(r.ID)} className="row-between">
              <span style={{ fontWeight: 600 }}>{String(r.Name)}</span>
              <button className="btn btn-primary" onClick={() => onStartWorkout?.(String(r.ID))}>Start workout</button>
            </div>
          ))
        )}
      </section>

      <section className="card" aria-label="Meals today">
        <h2>Meals today</h2>
        {nutrition.meals.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Nothing logged yet. Tap + to add a meal.</p>
        ) : (
          <div className="list">
            {nutrition.meals.map((m) => {
              const tx = m.TransactionID ? txById.get(String(m.TransactionID)) : undefined;
              const price = tx ? formatNT(Number(tx.Amount)) : "not in budget";
              return (
                <button key={String(m.ID)} className="list-row" onClick={() => onOpenMeal?.(String(m.ID))}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{String(m.Name ?? "")}</span>
                    <span className="small muted">
                      {m.Time ? `${m.Time} · ` : ""}
                      {nutritionText(m)}
                    </span>
                  </span>
                  <span className={tx ? "" : "small muted"} style={tx ? { fontSize: 14, fontWeight: 700 } : undefined}>{price}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card" aria-label="Coming up">
        <div className="row-between">
          <h2>Coming up</h2>
          {onOpenRecurring && <button className="btn-link" onClick={onOpenRecurring}>Recurring charges ›</button>}
        </div>
        {upcoming.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Nothing in the next 7 days</p>
        ) : (
          <ul className="plain-list">
            {upcoming.map(({ item, date }) => (
              <li key={`${item.ID}_${date}`} className="small">
                {`${formatShortDay(date)} · ${item.Name} · ${formatNT(Number(item.Amount))}`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
