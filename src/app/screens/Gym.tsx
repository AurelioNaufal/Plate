import { useMemo, useState } from "react";
import { useData } from "../store";
import { todayTaipei, weekday } from "../../shared/dates";
import { formatWeekdays, parseIdList, parseWeekdays, routinesForDay, sessionsFrom, type Session } from "../../shared/gym";
import type { Row } from "../../shared/schema";
import { formatShortDay } from "../format";
import { loadDraft } from "../workoutDraft";

type Props = {
  today?: string;
  onStart(routineId: string | null): void;
  onResume(): void;
  onOpenExercise(id: string): void;
  onEditSession(sessionId: string): void;
};

const bySortOrder = (a: Row, b: Row) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0);

/** "40×10", or "×15" for a set with no weight. */
export function setLabel(r: Row): string {
  const kg = typeof r.WeightKg === "number" ? String(r.WeightKg) : "";
  const reps = typeof r.Reps === "number" ? String(r.Reps) : "–";
  return `${kg}×${reps}`;
}

export function Gym({ today = todayTaipei(), onStart, onResume, onOpenExercise, onEditSession }: Props) {
  const { rows } = useData();
  const exercises = useMemo(() => [...(rows.Exercises ?? [])].sort(bySortOrder), [rows.Exercises]);
  const names = useMemo(() => new Map(exercises.map((e) => [String(e.ID), String(e.Name ?? "")])), [exercises]);
  const routines = rows.Routines ?? [];
  const todays = routinesForDay(routines, weekday(today));
  const others = routines
    .filter((r) => parseWeekdays(r.Weekdays).length > 0 && !todays.includes(r))
    .sort((a, b) => String(a.Name ?? "").localeCompare(String(b.Name ?? "")));
  const sessions = useMemo(() => sessionsFrom(rows.Workouts ?? []).slice(0, 10), [rows.Workouts]);
  const draft = loadDraft();
  const [open, setOpen] = useState<string | null>(null);

  const nameOf = (id: unknown) => names.get(String(id)) ?? "Deleted exercise";
  const count = (r: Row) => parseIdList(r.ExerciseIDs).length;

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">Push · Pull · anytime moves</div>
          <h1>Gym</h1>
        </div>
      </header>

      {draft && (
        <section className="card" aria-label="Unfinished workout">
          <div className="row-between">
            <div>
              <h2>Workout in progress</h2>
              <div className="small muted">Started {formatShortDay(draft.date)}</div>
            </div>
            <button className="btn btn-primary" onClick={onResume}>Continue workout</button>
          </div>
        </section>
      )}

      <section className="card" aria-label="Today's workout">
        <h2>Today</h2>
        {todays.length === 0 ? (
          <div className="row-between">
            <span className="muted">No routine today</span>
            <button className="btn btn-secondary" onClick={() => onStart(null)}>Start blank workout</button>
          </div>
        ) : (
          todays.map((r) => (
            <div key={String(r.ID)} className="row-between">
              <div>
                <div style={{ fontWeight: 600 }}>{String(r.Name)}</div>
                <div className="small muted">{`${count(r)} exercises`}</div>
              </div>
              <button className="btn btn-primary" onClick={() => onStart(String(r.ID))}>Start workout</button>
            </div>
          ))
        )}
      </section>

      {others.length > 0 && (
        <section className="card" aria-label="Other routines">
          <h2>Other routines</h2>
          {others.map((r) => (
            <div key={String(r.ID)} className="row-between">
              <div>
                <div style={{ fontWeight: 600 }}>{String(r.Name)}</div>
                <div className="small muted">{`${formatWeekdays(parseWeekdays(r.Weekdays))} · ${count(r)} exercises`}</div>
              </div>
              <button className="btn btn-secondary" aria-label={`Start ${String(r.Name)}`} onClick={() => onStart(String(r.ID))}>Start</button>
            </div>
          ))}
          {todays.length > 0 && (
            <button className="btn-link" style={{ alignSelf: "flex-start" }} onClick={() => onStart(null)}>Start blank workout</button>
          )}
        </section>
      )}

      <section className="card" aria-label="Recent workouts">
        <h2>Recent workouts</h2>
        {sessions.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No workouts logged yet.</p>
        ) : (
          <div className="list">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} nameOf={nameOf} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} onEdit={() => onEditSession(s.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="card" aria-label="Exercises">
        <h2>Exercises</h2>
        <div className="list">
          {exercises.map((e) => (
            <button key={String(e.ID)} className="list-row" onClick={() => onOpenExercise(String(e.ID))}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{String(e.Name)}</span>
                {e.MuscleGroup ? <span className="small muted">{String(e.MuscleGroup)}</span> : null}
              </span>
              <span className="muted">›</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function SessionRow({ session, nameOf, open, onToggle, onEdit }: { session: Session; nameOf(id: unknown): string; open: boolean; onToggle(): void; onEdit(): void }) {
  const byExercise = new Map<string, Row[]>();
  for (const r of session.sets) byExercise.set(String(r.ExerciseID), [...(byExercise.get(String(r.ExerciseID)) ?? []), r]);
  const summary = `${formatShortDay(session.date)} · ${[...byExercise.keys()].map(nameOf).join(", ")} · ${session.sets.length} ${session.sets.length === 1 ? "set" : "sets"}`;
  return (
    <div>
      <button className="list-row" aria-expanded={open} onClick={onToggle}>
        <span style={{ fontSize: 14 }}>{summary}</span>
        <span className="muted">{open ? "▾" : "›"}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0 12px" }}>
          {[...byExercise].map(([id, sets]) => (
            <span key={id} className="small">{`${nameOf(id)}: ${sets.map(setLabel).join(" · ")}`}</span>
          ))}
          <button className="btn-link" style={{ alignSelf: "flex-start" }} onClick={onEdit}>Edit this workout</button>
        </div>
      )}
    </div>
  );
}
