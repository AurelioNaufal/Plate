import { useMemo, useState } from "react";
import { useData } from "../store";
import { todayTaipei, weekday } from "../../shared/dates";
import { formatWeekdays, parseIdList, parseWeekdays, routinesForDay, sessionsFrom, setLabel, type Session } from "../../shared/gym";
import type { Row } from "../../shared/schema";
import { formatShortDay } from "../format";
import { clearDraft, loadDraft, savedSetCount, startChoice } from "../workoutDraft";

type Props = {
  today?: string;
  /** replace: the owner agreed to close today's open workout. */
  onStart(routineId: string | null, replace?: boolean): void;
  /** A routine Today tried to start while another workout is open: ask straight away. */
  asking?: string | null;
  onResume(): void;
  onOpenExercise(id: string): void;
  onEditSession(sessionId: string): void;
};

const bySortOrder = (a: Row, b: Row) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0);

export function Gym({ today = todayTaipei(), onStart, onResume, onOpenExercise, onEditSession, asking = null }: Props) {
  const { rows } = useData();
  const exercises = useMemo(() => [...(rows.Exercises ?? [])].sort(bySortOrder), [rows.Exercises]);
  const names = useMemo(() => new Map(exercises.map((e) => [String(e.ID), String(e.Name ?? "")])), [exercises]);
  const routines = rows.Routines ?? [];
  const todays = routinesForDay(routines, weekday(today));
  const others = routines
    .filter((r) => parseWeekdays(r.Weekdays).length > 0 && !todays.includes(r))
    .sort((a, b) => String(a.Name ?? "").localeCompare(String(b.Name ?? "")));
  const sessions = useMemo(() => sessionsFrom(rows.Workouts ?? []).slice(0, 10), [rows.Workouts]);
  const [draft, setDraft] = useState(() => loadDraft());
  const [open, setOpen] = useState<string | null>(null);
  const draftToday = draft !== null && draft.date === today;
  // undefined: no question; null: a blank workout was tapped.
  const [switchTo, setSwitchTo] = useState<string | null | undefined>(asking ?? undefined);
  const routineName = (id: string | null | undefined) =>
    id ? String(routines.find((r) => r.ID === id)?.Name ?? "Workout") : "Blank workout";

  /** Starting another routine never silently reopens the one already open. */
  const start = (routineId: string | null) => {
    if (draftToday && startChoice(draft, routineId) === "ask") setSwitchTo(routineId);
    else onStart(routineId);
  };

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
          {draftToday ? (
            <div className="row-between">
              <h2>{`${draft.routineId ? routineName(draft.routineId) : "Blank workout"} in progress`}</h2>
              <button className="btn btn-primary" onClick={onResume}>Continue workout</button>
            </div>
          ) : (
            <>
              <h2>{`Unfinished workout from ${formatShortDay(draft.date)}`}</h2>
              <p className="small muted" style={{ margin: 0 }}>Its ticked sets are saved. Starting a new workout today closes it.</p>
              <div className="grid-2">
                <button className="btn btn-secondary" onClick={() => { clearDraft(); setDraft(null); }}>Finish it</button>
                <button className="btn btn-secondary" onClick={onResume}>Continue it</button>
              </div>
            </>
          )}
        </section>
      )}

      {switchTo !== undefined && draftToday && (
        <section className="card" aria-label="Switch workout">
          <span>
            {`Your ${routineName(draft.routineId)} workout has ${savedSetCount(draft)} saved set${savedSetCount(draft) === 1 ? "" : "s"}. Start ${routineName(switchTo)} instead?`}
          </span>
          <span className="small muted">Its saved sets stay in your history.</span>
          <div className="grid-2">
            <button className="btn btn-secondary" onClick={() => setSwitchTo(undefined)}>{`Keep ${routineName(draft.routineId)}`}</button>
            <button className="btn btn-primary" onClick={() => onStart(switchTo, true)}>{`Start ${routineName(switchTo)}`}</button>
          </div>
        </section>
      )}

      <section className="card" aria-label="Today's workout">
        <h2>Today</h2>
        {todays.length === 0 ? (
          <div className="row-between">
            <span className="muted">No routine today</span>
            <button className="btn btn-secondary" onClick={() => start(null)}>Start blank workout</button>
          </div>
        ) : (
          todays.map((r) => (
            <div key={String(r.ID)} className="row-between">
              <div>
                <div style={{ fontWeight: 600 }}>{String(r.Name)}</div>
                <div className="small muted">{`${count(r)} exercises`}</div>
              </div>
              <button className="btn btn-primary" onClick={() => start(String(r.ID))}>Start workout</button>
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
              <button className="btn btn-secondary" aria-label={`Start ${String(r.Name)}`} onClick={() => start(String(r.ID))}>Start</button>
            </div>
          ))}
          {todays.length > 0 && (
            <button className="btn-link" style={{ alignSelf: "flex-start" }} onClick={() => start(null)}>Start blank workout</button>
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
              <SessionRow
                key={s.id}
                session={s}
                nameOf={nameOf}
                open={open === s.id}
                onToggle={() => setOpen(open === s.id ? null : s.id)}
                onEdit={() => onEditSession(s.id)}
                editBlocked={draftToday && draft?.sessionId !== s.id}
              />
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

function SessionRow({ session, nameOf, open, onToggle, onEdit, editBlocked }: {
  session: Session; nameOf(id: unknown): string; open: boolean; onToggle(): void; onEdit(): void; editBlocked: boolean;
}) {
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
          <button className="btn-link" style={{ alignSelf: "flex-start" }} onClick={onEdit} disabled={editBlocked}>Edit this workout</button>
          {editBlocked && <span className="small muted">Finish today's workout first.</span>}
        </div>
      )}
    </div>
  );
}
