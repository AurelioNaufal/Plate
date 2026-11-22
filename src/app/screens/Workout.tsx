import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../store";
import { lastSets, parseIdList, setLabel } from "../../shared/gym";
import { getSetting } from "../../shared/meals";
import type { Change } from "../../shared/changes";
import type { Row } from "../../shared/schema";
import { formatShortDay } from "../format";
import { clearDraft, saveDraft, startingSets, type Draft, type DraftSet } from "../workoutDraft";

type Props = {
  draft: Draft;
  /** Finished: the draft is cleared. */
  onDone(): void;
  /** Left for now: the draft stays on this phone to continue later. */
  onLeave?(): void;
};

const newId = () => crypto.randomUUID();
const bySortOrder = (a: Row, b: Row) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0);

type Parsed = { ok: true; weightKg: number | null; reps: number | null } | { ok: false; error: string };

function parseSet(s: DraftSet): Parsed {
  const w = s.weight.trim().replace(",", ".");
  const r = s.reps.trim();
  if (!w && !r) return { ok: false, error: "Enter reps or kg" };
  if (w && !/^\d+(\.\d+)?$/.test(w)) return { ok: false, error: "Use a number for kg" };
  if (r && !/^\d+$/.test(r)) return { ok: false, error: "Use whole reps" };
  // The Sheet refuses 1000 kg or more; say so here instead of failing to save.
  if (w && Number(w) >= 1000) return { ok: false, error: "Use less than 1000 kg" };
  return { ok: true, weightKg: w ? Number(w) : null, reps: r ? Number(r) : null };
}

const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

export function Workout({ draft: initial, onDone, onLeave }: Props) {
  const { rows, apply } = useData();
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const exercises = useMemo(() => [...(rows.Exercises ?? [])].sort(bySortOrder), [rows.Exercises]);
  const nameOf = (id: string) => String(exercises.find((e) => e.ID === id)?.Name ?? "Deleted exercise");
  const workouts = rows.Workouts ?? [];
  const routineName = draft.routineId ? String((rows.Routines ?? []).find((r) => r.ID === draft.routineId)?.Name ?? "") : "";
  const anytime = new Set((rows.Routines ?? []).filter((r) => !String(r.Weekdays ?? "").trim()).flatMap((r) => parseIdList(r.ExerciseIDs)));

  useEffect(() => saveDraft(draft), [draft]);

  // On opening (a resumed or edited workout), make the Sheet match the ticks:
  // a ticked set the Sheet lacks, or has with other numbers, is sent again
  // (an earlier save may have failed before the app closed); an unticked set
  // still in the Sheet is removed. Upserts are by ID, so nothing doubles.
  useEffect(() => {
    const stored = new Map((rows.Workouts ?? []).map((r) => [String(r.ID), r]));
    const changes: Change[] = [];
    for (const ex of initial.exercises) {
      ex.sets.forEach((s, i) => {
        const have = stored.get(s.id);
        if (!s.done) {
          if (have) changes.push({ tab: "Workouts", removeId: s.id });
          return;
        }
        const p = parseSet(s);
        if (!p.ok) return;
        const want = rowFor(ex.exerciseId, s, i + 1, p);
        const same = have && (["SessionID", "Date", "ExerciseID", "SetNumber", "WeightKg", "Reps"] as const).every((k) => (have[k] ?? null) === want[k]);
        if (!same) changes.push({ tab: "Workouts", row: want });
      });
    }
    if (changes.length) void apply(changes);
    // Once, when the workout opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowFor = (exerciseId: string, s: DraftSet, setNumber: number, p: { weightKg: number | null; reps: number | null }): Row => ({
    ID: s.id, SessionID: draft.sessionId, Date: draft.date, ExerciseID: exerciseId, SetNumber: setNumber, WeightKg: p.weightKg, Reps: p.reps, Done: true,
  });

  const updateSets = (exerciseId: string, f: (sets: DraftSet[]) => DraftSet[]) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: f(e.sets) } : e)) }));

  const setError = (id: string, msg?: string) =>
    setErrors((e) => {
      const next = { ...e };
      if (msg) next[id] = msg;
      else delete next[id];
      return next;
    });

  function toggle(exerciseId: string, index: number) {
    const s = draft.exercises.find((e) => e.exerciseId === exerciseId)!.sets[index];
    if (s.done) {
      void apply([{ tab: "Workouts", removeId: s.id }]);
      updateSets(exerciseId, (sets) => sets.map((x, i) => (i === index ? { ...x, done: false } : x)));
      return;
    }
    const p = parseSet(s);
    if (!p.ok) return setError(s.id, p.error);
    setError(s.id);
    void apply([{ tab: "Workouts", row: rowFor(exerciseId, s, index + 1, p) }]);
    updateSets(exerciseId, (sets) => sets.map((x, i) => (i === index ? { ...x, done: true } : x)));
  }

  /** A ticked set edited and left: save its new numbers. */
  function commit(exerciseId: string, index: number) {
    const s = draft.exercises.find((e) => e.exerciseId === exerciseId)!.sets[index];
    if (!s.done) return;
    const p = parseSet(s);
    if (!p.ok) return setError(s.id, p.error);
    setError(s.id);
    void apply([{ tab: "Workouts", row: rowFor(exerciseId, s, index + 1, p) }]);
  }

  function removeSet(exerciseId: string, index: number) {
    const sets = draft.exercises.find((e) => e.exerciseId === exerciseId)!.sets;
    const removed = sets[index];
    const changes: Change[] = [];
    if (removed.done) changes.push({ tab: "Workouts", removeId: removed.id });
    // Ticked sets after it move up one place. One whose numbers are mid-edit and
    // unreadable keeps its saved numbers, but still moves, so no two sets share a number.
    const stored = new Map(workouts.map((r) => [String(r.ID), r]));
    sets.forEach((s, i) => {
      if (i <= index || !s.done) return;
      const p = parseSet(s);
      if (p.ok) changes.push({ tab: "Workouts", row: rowFor(exerciseId, s, i, p) });
      else {
        const have = stored.get(s.id);
        if (have) changes.push({ tab: "Workouts", row: { ...have, SetNumber: i } });
      }
    });
    if (changes.length) void apply(changes);
    updateSets(exerciseId, (xs) => xs.filter((_, i) => i !== index));
  }

  function addSet(exerciseId: string) {
    updateSets(exerciseId, (sets) => {
      const prev = sets.at(-1);
      return [...sets, { id: newId(), weight: prev?.weight ?? "", reps: prev?.reps ?? "", done: false }];
    });
  }

  function addExercise(exerciseId: string) {
    if (!exerciseId || draft.exercises.some((e) => e.exerciseId === exerciseId)) return;
    setDraft((d) => ({ ...d, exercises: [...d.exercises, { exerciseId, sets: startingSets(exerciseId, workouts, newId, d.sessionId) }] }));
  }

  function removeExercise(exerciseId: string) {
    const done = draft.exercises.find((e) => e.exerciseId === exerciseId)!.sets.filter((s) => s.done);
    if (done.length) void apply(done.map((s): Change => ({ tab: "Workouts", removeId: s.id })));
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((e) => e.exerciseId !== exerciseId) }));
    setConfirmingRemove(null);
  }

  const untickedWithNumbers = draft.exercises.flatMap((e) => e.sets).filter((s) => !s.done && (s.weight.trim() || s.reps.trim())).length;

  function finish(force = false) {
    if (!force && untickedWithNumbers > 0) return setFinishing(true);
    clearDraft();
    onDone();
  }

  const inSession = new Set(draft.exercises.map((e) => e.exerciseId));
  const pickable = exercises.filter((e) => !inSession.has(String(e.ID)));
  const restDefault = (() => {
    const n = Number(getSetting(rows.Settings ?? [], "restSeconds"));
    return Number.isInteger(n) && n >= 15 && n <= 600 ? n : 90;
  })();

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">{formatShortDay(draft.date)}</div>
          <h1>{routineName || "Workout"}</h1>
        </div>
        {onLeave && <button className="btn-link" onClick={onLeave}>Later</button>}
      </header>

      <RestTimer defaultSeconds={restDefault} />

      {draft.exercises.map((ex) => {
        const name = nameOf(ex.exerciseId);
        const last = lastSets(workouts, ex.exerciseId, draft.sessionId);
        const saved = ex.sets.filter((s) => s.done).length;
        return (
          <section key={ex.exerciseId} className="card" aria-label={name}>
            <div className="row-between">
              <div>
                <h2>{name}</h2>
                <div className="small muted">{`Last time: ${last.length ? last.map(setLabel).join(" · ") : "—"}`}</div>
              </div>
              <button className="icon-btn" aria-label={`Remove ${name}`} onClick={() => (saved ? setConfirmingRemove(ex.exerciseId) : removeExercise(ex.exerciseId))}>×</button>
            </div>
            {confirmingRemove === ex.exerciseId && (
              <div className="row-between">
                <span className="small">{`Delete ${saved} saved ${saved === 1 ? "set" : "sets"}?`}</span>
                <span style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setConfirmingRemove(null)}>Cancel</button>
                  <button className="btn btn-danger" onClick={() => removeExercise(ex.exerciseId)}>Yes, delete</button>
                </span>
              </div>
            )}
            <div className="set-head small muted" aria-hidden="true">
              <span>Set</span><span>kg</span><span>Reps</span><span>Done</span><span />
            </div>
            {ex.sets.map((s, i) => (
              <div key={s.id}>
                <div className={`set-row${s.done ? " is-done" : ""}`}>
                  <span className="set-num">{i + 1}</span>
                  <input
                    aria-label={`Set ${i + 1} kg`}
                    inputMode="decimal"
                    value={s.weight}
                    placeholder="–"
                    onChange={(e) => updateSets(ex.exerciseId, (sets) => sets.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))}
                    onBlur={() => commit(ex.exerciseId, i)}
                  />
                  <input
                    aria-label={`Set ${i + 1} reps`}
                    inputMode="numeric"
                    value={s.reps}
                    onChange={(e) => updateSets(ex.exerciseId, (sets) => sets.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))}
                    onBlur={() => commit(ex.exerciseId, i)}
                  />
                  <input type="checkbox" className="set-done" aria-label={`Set ${i + 1} done`} checked={s.done} onChange={() => toggle(ex.exerciseId, i)} />
                  <button className="icon-btn" aria-label={`Remove set ${i + 1}`} onClick={() => removeSet(ex.exerciseId, i)}>−</button>
                </div>
                {errors[s.id] && <div className="field-error" role="alert">{errors[s.id]}</div>}
              </div>
            ))}
            <button className="btn-link" style={{ alignSelf: "flex-start" }} onClick={() => addSet(ex.exerciseId)}>Add set</button>
          </section>
        );
      })}

      <section className="card">
        <label className="field">
          Add exercise
          <select value="" onChange={(e) => addExercise(e.target.value)}>
            <option value="">Choose…</option>
            <optgroup label="Add anytime">
              {pickable.filter((e) => anytime.has(String(e.ID))).map((e) => <option key={String(e.ID)} value={String(e.ID)}>{String(e.Name)}</option>)}
            </optgroup>
            <optgroup label="All exercises">
              {pickable.filter((e) => !anytime.has(String(e.ID))).map((e) => <option key={String(e.ID)} value={String(e.ID)}>{String(e.Name)}</option>)}
            </optgroup>
          </select>
        </label>
      </section>

      {finishing ? (
        <div className="card">
          <span className="small">
            {untickedWithNumbers === 1 ? "1 set isn't ticked and won't be saved." : `${untickedWithNumbers} sets aren't ticked and won't be saved.`}
          </span>
          <div className="grid-2">
            <button className="btn btn-secondary" onClick={() => setFinishing(false)}>Keep going</button>
            <button className="btn btn-primary" onClick={() => finish(true)}>Finish anyway</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={() => finish()}>Finish workout</button>
      )}
    </main>
  );
}

/** Tap to start a rest countdown; ±15 s while it runs; buzzes at 0 where the phone allows. */
function RestTimer({ defaultSeconds }: { defaultSeconds: number }) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [over, setOver] = useState(false);
  const buzzed = useRef(false);

  useEffect(() => {
    if (endAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endAt]);

  const left = endAt === null ? 0 : Math.max(0, Math.ceil((endAt - now) / 1000));
  useEffect(() => {
    if (endAt !== null && left === 0 && !buzzed.current) {
      buzzed.current = true;
      setEndAt(null);
      setOver(true);
      navigator.vibrate?.(300);
    }
  }, [endAt, left]);

  const start = () => {
    buzzed.current = false;
    setOver(false);
    const t = Date.now();
    setNow(t);
    setEndAt(t + defaultSeconds * 1000);
  };

  return (
    <div className="rest-bar card" role="timer" aria-label="Rest timer">
      {endAt === null ? (
        <div className="row-between">
          <span className="small" style={{ fontWeight: 600, color: over ? "var(--accent)" : "var(--muted)" }}>{over ? "Rest over" : "Between sets"}</span>
          <button className="btn btn-secondary" onClick={start}>{`Rest ${clock(defaultSeconds)}`}</button>
        </div>
      ) : (
        <div className="row-between">
          <span className="stat-value" aria-live="off">{clock(left)}</span>
          <span style={{ display: "flex", gap: 4 }}>
            <button className="btn btn-secondary" aria-label="Subtract 15 seconds" onClick={() => setEndAt((e) => (e === null ? e : Math.max(Date.now() + 1000, e - 15_000)))}>−15</button>
            <button className="btn btn-secondary" aria-label="Add 15 seconds" onClick={() => setEndAt((e) => (e === null ? e : e + 15_000))}>+15</button>
            <button className="btn btn-secondary" onClick={() => setEndAt(null)}>Stop</button>
          </span>
        </div>
      )}
    </div>
  );
}
