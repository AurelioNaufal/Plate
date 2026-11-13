import { useMemo, useState } from "react";
import { useData } from "../store";
import { itemsLabel, parseNutritionInput, planMealDelete, planMealSave, roundKcal, roundProtein } from "../../shared/meals";
import type { Row } from "../../shared/schema";

type Props = {
  /** The meal being edited; omit for a new one. */
  meal?: Row;
  today: string;
  /** "HH:MM" in Taipei; defaults to now. */
  nowTime?: string;
  onDone(): void;
};

type Field = "name" | "price" | "kcal" | "protein";
type Count = { id: string; name: string; count: number };

const bySortOrder = (a: Row, b: Row) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0);
const newId = () => crypto.randomUUID();

function taipeiTime(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(11, 16);
}

/** Current field value as a number, blank or unreadable counting as 0. */
function current(s: string): number {
  const p = parseNutritionInput(s);
  return p.ok && p.value !== null ? p.value : 0;
}

const show = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function MealForm({ meal, today, nowTime, onDone }: Props) {
  const { rows, apply } = useData();
  const existingTx = meal?.TransactionID ? (rows.Transactions ?? []).find((t) => t.ID === meal.TransactionID) : undefined;

  const [name, setName] = useState(show(meal?.Name));
  const [price, setPrice] = useState(show(existingTx?.Amount));
  const [inBudget, setInBudget] = useState(meal ? meal.InBudget === true : true);
  const [kcal, setKcal] = useState(show(meal?.Kcal));
  const [protein, setProtein] = useState(show(meal?.Protein));
  const [date, setDate] = useState(show(meal?.Date) || today);
  const [time, setTime] = useState(meal ? show(meal.Time) : (nowTime ?? taipeiTime()));
  const [counts, setCounts] = useState<Count[]>([]);
  // Editing keeps the stored Items text until quick-add or a saved food is used.
  const [itemsTouched, setItemsTouched] = useState(false);
  const [error, setError] = useState<{ field: Field; message: string }>();
  const [confirming, setConfirming] = useState(false);

  const savedFoods = useMemo(() => [...(rows.SavedFoods ?? [])].sort(bySortOrder), [rows.SavedFoods]);
  const quickAdd = useMemo(() => [...(rows.QuickAdd ?? [])].sort(bySortOrder), [rows.QuickAdd]);

  const clearError = () => setError(undefined);

  function pickSavedFood(f: Row) {
    setName(show(f.Name));
    setPrice(show(f.Price));
    setKcal(show(f.Kcal));
    setProtein(show(f.Protein));
    if (typeof f.Price === "number") setInBudget(true);
    setCounts([]);
    setItemsTouched(true);
    clearError();
  }

  function addPortion(q: Row, delta: 1 | -1) {
    const id = String(q.ID);
    const k = typeof q.Kcal === "number" ? q.Kcal : 0;
    const p = typeof q.Protein === "number" ? q.Protein : 0;
    setKcal((v) => String(Math.max(0, roundKcal(current(v) + delta * k))));
    setProtein((v) => String(Math.max(0, roundProtein(current(v) + delta * p))));
    setCounts((cs) => {
      const found = cs.find((c) => c.id === id);
      if (found) return cs.map((c) => (c.id === id ? { ...c, count: Math.max(0, c.count + delta) } : c));
      return delta > 0 ? [...cs, { id, name: show(q.Name), count: 1 }] : cs;
    });
    if (delta > 0 && !name.trim()) setName("Prasmanan");
    setItemsTouched(true);
    clearError();
  }

  function submit() {
    const items = itemsTouched ? itemsLabel(counts) : show(meal?.Items);
    const plan = planMealSave(
      { name, price, inBudget, kcal, protein, date: date || today, time, items },
      { existingMeal: meal, existingTx, categories: rows.Categories ?? [], newId, now: new Date() },
    );
    if (!plan.ok) return setError({ field: plan.field, message: plan.error });
    void apply(plan.changes);
    onDone();
  }

  function confirmDelete() {
    if (!meal) return;
    void apply(planMealDelete(meal));
    onDone();
  }

  const errorFor = (field: Field) =>
    error?.field === field ? <div id={`${field}-error`} className="field-error" role="alert">{error.message}</div> : null;
  const invalid = (field: Field) => ({
    "aria-invalid": error?.field === field,
    "aria-describedby": error?.field === field ? `${field}-error` : undefined,
  });

  return (
    <>
      {savedFoods.length > 0 && (
        <section className="card" role="group" aria-label="Saved foods">
          <h2 className="stat-label">Saved foods</h2>
          <div className="chips">
            {savedFoods.map((f) => (
              <button key={String(f.ID)} type="button" className="chip" onClick={() => pickSavedFood(f)}>
                {show(f.Name)}
              </button>
            ))}
          </div>
        </section>
      )}

      {quickAdd.length > 0 && (
        <section className="card" role="group" aria-label="Quick add">
          <h2 className="stat-label">Quick add</h2>
          <div className="quick-grid">
            {quickAdd.map((q) => {
              const n = counts.find((c) => c.id === q.ID)?.count ?? 0;
              return (
                <div key={String(q.ID)} className={`quick-item${n ? " on" : ""}`}>
                  <button type="button" className="quick-add" aria-label={show(q.Name)} onClick={() => addPortion(q, 1)}>
                    <span className="quick-name">{show(q.Name)}</span>
                    <span className="small muted">{show(q.Protein) || "–"} g · {show(q.Kcal) || "–"} kcal</span>
                    {n > 0 && <span className="quick-count">×{n}</span>}
                  </button>
                  {n > 0 && (
                    <button type="button" className="quick-minus" aria-label={`Remove one ${show(q.Name)}`} onClick={() => addPortion(q, -1)}>
                      −
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        <label className="field">
          Name
          <input value={name} onChange={(e) => { setName(e.target.value); clearError(); }} placeholder="e.g. Prasmanan" {...invalid("name")} />
        </label>
        {errorFor("name")}
        <div className="row-between">
          <label className="field" style={{ flex: 1 }}>
            Price (NT$)
            <input value={price} onChange={(e) => { setPrice(e.target.value); clearError(); }} inputMode="numeric" disabled={!inBudget} {...invalid("price")} />
          </label>
          <label className="switch-label">
            <span>Count in budget</span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={inBudget}
              aria-checked={inBudget}
              onChange={(e) => { setInBudget(e.target.checked); clearError(); }}
            />
          </label>
        </div>
        {errorFor("price")}
        <div className="grid-2">
          <label className="field">
            Kcal
            <input value={kcal} onChange={(e) => { setKcal(e.target.value); clearError(); }} inputMode="decimal" {...invalid("kcal")} />
          </label>
          <label className="field">
            Protein (g)
            <input value={protein} onChange={(e) => { setProtein(e.target.value); clearError(); }} inputMode="decimal" {...invalid("protein")} />
          </label>
        </div>
        {errorFor("kcal")}
        {errorFor("protein")}
        <span className="small muted">Leave blank if you don't know</span>
        <div className="grid-2">
          <label className="field">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            Time
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
      </section>

      <button className="btn btn-primary" onClick={submit}>Save</button>

      {meal &&
        (confirming ? (
          <div className="row-between">
            <span className="small">{meal.TransactionID ? "Delete this meal and its expense?" : "Delete this meal?"}</span>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Yes, delete</button>
            </span>
          </div>
        ) : (
          <button className="btn btn-danger" onClick={() => setConfirming(true)}>Delete</button>
        ))}
    </>
  );
}
