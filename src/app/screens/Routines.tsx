import { useMemo, useState } from "react";
import { useData } from "../store";
import { formatWeekdays, parseIdList, parseWeekdays } from "../../shared/gym";
import type { Row } from "../../shared/schema";
import { BackHeader } from "../components/BackHeader";
import { ConfirmDelete } from "../components/ConfirmDelete";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const show = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function Routines({ onBack }: { onBack(): void }) {
  const { rows, save, remove } = useData();
  const routines = useMemo(() => [...(rows.Routines ?? [])].sort((a, b) => show(a.Name).localeCompare(show(b.Name))), [rows.Routines]);
  const [editing, setEditing] = useState<string | null>(null);
  const current = editing && editing !== "new" ? routines.find((r) => r.ID === editing) : undefined;

  return (
    <main className="screen">
      <BackHeader title="Routines" onBack={onBack} />
      <p className="muted small" style={{ margin: 0 }}>A routine with no days (like Anytime) is offered as "Add anytime" in every workout.</p>
      {editing ? (
        <RoutineForm
          key={editing}
          existing={current}
          exercises={rows.Exercises ?? []}
          onSave={(row) => { void save("Routines", row); setEditing(null); }}
          onDelete={current ? () => { void remove("Routines", String(current.ID)); setEditing(null); } : undefined}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button className="btn btn-secondary" onClick={() => setEditing("new")}>Add routine</button>
      )}
      <section className="card">
        <div className="list">
          {routines.map((r) => (
            <button key={String(r.ID)} className="list-row" onClick={() => setEditing(String(r.ID))}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{show(r.Name)}</span>
                <span className="small muted">{`${formatWeekdays(parseWeekdays(r.Weekdays))} · ${parseIdList(r.ExerciseIDs).length} exercises`}</span>
              </span>
              <span className="muted">›</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function RoutineForm({ existing, exercises, onSave, onDelete, onCancel }: {
  existing?: Row; exercises: Row[]; onSave(row: Row): void; onDelete?(): void; onCancel(): void;
}) {
  const [name, setName] = useState(show(existing?.Name));
  const [days, setDays] = useState<number[]>(parseWeekdays(existing?.Weekdays));
  const [ids, setIds] = useState<string[]>(parseIdList(existing?.ExerciseIDs));
  const [error, setError] = useState<string>();
  const nameOf = (id: string) => show(exercises.find((e) => e.ID === id)?.Name) || "Deleted exercise";

  const toggleDay = (d: number) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort((a, b) => a - b)));
  const move = (i: number, by: -1 | 1) =>
    setIds((xs) => {
      const next = [...xs];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  function submit() {
    const n = name.trim();
    if (!n) return setError("Enter a name");
    onSave({ ...(existing ?? {}), Name: n, Weekdays: days.join(","), ExerciseIDs: ids.join(",") });
  }

  const addable = [...exercises]
    .filter((e) => !ids.includes(String(e.ID)))
    .sort((a, b) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0));

  return (
    <section className="card" aria-label={existing ? `Edit ${show(existing.Name)}` : "New routine"}>
      <label className="field">
        Name
        <input value={name} onChange={(e) => { setName(e.target.value); setError(undefined); }} aria-invalid={!!error} aria-describedby={error ? "routine-error" : undefined} />
      </label>
      {error && <div id="routine-error" className="field-error" role="alert">{error}</div>}
      <div className="field">
        Days
        <div className="day-toggles">
          {DAYS.map((d, i) => (
            <button key={d} type="button" aria-pressed={days.includes(i)} className="day-toggle" onClick={() => toggleDay(i)}>{d}</button>
          ))}
        </div>
      </div>
      <div className="field">
        Exercises
        <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {ids.map((id, i) => (
            <li key={id} className="row-between" style={{ minHeight: 44 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{nameOf(id)}</span>
              <span style={{ display: "flex" }}>
                <button type="button" className="icon-btn" aria-label={`Move ${nameOf(id)} up`} disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                <button type="button" className="icon-btn" aria-label={`Move ${nameOf(id)} down`} disabled={i === ids.length - 1} onClick={() => move(i, 1)}>▼</button>
                <button type="button" className="icon-btn" aria-label={`Remove ${nameOf(id)}`} onClick={() => setIds((xs) => xs.filter((x) => x !== id))}>×</button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <label className="field">
        Add exercise
        <select value="" onChange={(e) => e.target.value && setIds((xs) => [...xs, e.target.value])}>
          <option value="">Choose…</option>
          {addable.map((e) => <option key={String(e.ID)} value={String(e.ID)}>{show(e.Name)}</option>)}
        </select>
      </label>
      <div className="grid-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit}>Save</button>
      </div>
      {onDelete && <ConfirmDelete question={`Delete ${show(existing?.Name)}? Past workouts stay in your history.`} onDelete={onDelete} />}
    </section>
  );
}
