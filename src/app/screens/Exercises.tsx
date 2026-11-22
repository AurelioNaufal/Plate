import { useMemo, useState } from "react";
import { useData } from "../store";
import { planExerciseDelete } from "../../shared/gym";
import { getSetting } from "../../shared/meals";
import type { Row } from "../../shared/schema";
import { BackHeader } from "../components/BackHeader";
import { ConfirmDelete } from "../components/ConfirmDelete";

export const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Other"];
const bySortOrder = (a: Row, b: Row) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0);
const show = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function Exercises({ onBack }: { onBack(): void }) {
  const { rows, save, apply } = useData();
  const items = useMemo(() => [...(rows.Exercises ?? [])].sort(bySortOrder), [rows.Exercises]);
  const [editing, setEditing] = useState<string | null>(null);
  const current = editing && editing !== "new" ? items.find((r) => r.ID === editing) : undefined;

  return (
    <main className="screen">
      <BackHeader title="Exercises" onBack={onBack} />
      {editing ? (
        <ExerciseForm
          key={editing}
          existing={current}
          others={items.filter((r) => r.ID !== current?.ID)}
          nextSortOrder={items.reduce((m, r) => Math.max(m, Number(r.SortOrder ?? 0)), 0) + 1}
          onSave={(row) => { void save("Exercises", row); setEditing(null); }}
          onDelete={current ? () => { void apply(planExerciseDelete(current, rows.Routines ?? [])); setEditing(null); } : undefined}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button className="btn btn-secondary" onClick={() => setEditing("new")}>Add exercise</button>
      )}
      <section className="card">
        <ul className="list" aria-label="Exercises" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((e) => (
            <li key={String(e.ID)}>
              <button className="list-row" onClick={() => setEditing(String(e.ID))}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{show(e.Name)}</span>
                  <span className="small muted">{show(e.MuscleGroup) || "No group"}</span>
                </span>
                <span className="muted">›</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <RestSetting />
    </main>
  );
}

function ExerciseForm({ existing, others, nextSortOrder, onSave, onDelete, onCancel }: {
  existing?: Row; others: Row[]; nextSortOrder: number; onSave(row: Row): void; onDelete?(): void; onCancel(): void;
}) {
  const [name, setName] = useState(show(existing?.Name));
  const [group, setGroup] = useState(show(existing?.MuscleGroup) || "Other");
  const [error, setError] = useState<string>();

  function submit() {
    const n = name.trim();
    if (!n) return setError("Enter a name");
    if (others.some((r) => show(r.Name).trim().toLowerCase() === n.toLowerCase())) return setError("Already exists");
    onSave({ ...(existing ?? {}), Name: n, MuscleGroup: group, SortOrder: existing?.SortOrder ?? nextSortOrder });
  }

  const groups = MUSCLE_GROUPS.includes(group) ? MUSCLE_GROUPS : [group, ...MUSCLE_GROUPS];
  return (
    <section className="card" aria-label={existing ? `Edit ${show(existing.Name)}` : "New exercise"}>
      <label className="field">
        Name
        <input value={name} onChange={(e) => { setName(e.target.value); setError(undefined); }} aria-invalid={!!error} aria-describedby={error ? "ex-error" : undefined} />
      </label>
      {error && <div id="ex-error" className="field-error" role="alert">{error}</div>}
      <label className="field">
        Muscle group
        <select value={group} onChange={(e) => setGroup(e.target.value)}>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>
      <div className="grid-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit}>Save</button>
      </div>
      {onDelete && <ConfirmDelete question={`Delete ${show(existing?.Name)}? Past sets stay in your history.`} onDelete={onDelete} />}
    </section>
  );
}

function RestSetting() {
  const { rows, save } = useData();
  const [value, setValue] = useState(getSetting(rows.Settings ?? [], "restSeconds") ?? "90");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  function submit() {
    const t = value.trim();
    const n = Number(t);
    if (!/^\d+$/.test(t) || n < 15 || n > 600) return setError("Use 15 to 600 seconds");
    setError(undefined);
    void save("Settings", { ID: "restSeconds", Value: String(n) });
    setSaved(true);
  }

  return (
    <section className="card">
      <label className="field">
        Rest timer (seconds)
        <input value={value} inputMode="numeric" onChange={(e) => { setValue(e.target.value); setError(undefined); setSaved(false); }} aria-invalid={!!error} aria-describedby={error ? "rest-error" : undefined} />
      </label>
      {error && <div id="rest-error" className="field-error" role="alert">{error}</div>}
      <div className="row-between">
        <span className="small muted">{saved ? "Saved" : "The starting time for the rest timer."}</span>
        <button className="btn btn-secondary" onClick={submit}>Save rest time</button>
      </div>
    </section>
  );
}
