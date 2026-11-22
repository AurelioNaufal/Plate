// The shared list-and-form for Saved foods and Quick-add buttons. Editing a
// food here never changes meals already logged with it.
import { useMemo, useState } from "react";
import { useData } from "../store";
import { parseAmountInput } from "../../shared/money";
import { parseNutritionInput, proteinPerTen, proteinValueText, roundKcal, roundProtein } from "../../shared/meals";
import type { Change } from "../../shared/changes";
import type { Row } from "../../shared/schema";
import { BackHeader } from "./BackHeader";
import { ConfirmDelete } from "./ConfirmDelete";

type Props = {
  tab: "SavedFoods" | "QuickAdd";
  title: string;
  addLabel: string;
  withPrice: boolean;
  reorderable: boolean;
  onBack(): void;
};

type Field = "name" | "price" | "kcal" | "protein";
const show = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const bySortOrder = (a: Row, b: Row) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0);

function summary(r: Row, withPrice: boolean): string {
  const parts: string[] = [];
  if (withPrice && typeof r.Price === "number") parts.push(`NT$${r.Price.toLocaleString("en-US")}`);
  if (typeof r.Protein === "number") parts.push(`${r.Protein} g`);
  if (typeof r.Kcal === "number") parts.push(`${r.Kcal.toLocaleString("en-US")} kcal`);
  return parts.join(" · ") || "no numbers yet";
}

/** Highest protein per NT$10 first; foods without a value keep their order at the end. */
function byValue(a: Row, b: Row): number {
  const va = proteinPerTen(a.Protein, a.Price);
  const vb = proteinPerTen(b.Protein, b.Price);
  if (va === null || vb === null) return va === null ? (vb === null ? 0 : 1) : -1;
  return vb - va;
}

export function FoodList({ tab, title, addLabel, withPrice, reorderable, onBack }: Props) {
  const { rows, save, remove, apply } = useData();
  const items = useMemo(() => [...(rows[tab] ?? [])].sort(bySortOrder), [rows, tab]);
  const [sort, setSort] = useState<"order" | "value">("order");
  const shown = withPrice && sort === "value" ? [...items].sort(byValue) : items;
  // null: just the list; "new": adding; otherwise the ID being edited.
  const [editing, setEditing] = useState<string | null>(null);

  function move(index: number, by: -1 | 1) {
    const next = [...items];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    const changes: Change[] = next
      .map((r, i) => ({ r, order: i + 1 }))
      .filter(({ r, order }) => r.SortOrder !== order)
      .map(({ r, order }) => ({ tab, row: { ...r, SortOrder: order } }));
    if (changes.length) void apply(changes);
  }

  const current = editing && editing !== "new" ? items.find((r) => r.ID === editing) : undefined;

  return (
    <main className="screen">
      <BackHeader title={title} onBack={onBack} />

      {editing ? (
        <FoodForm
          key={editing}
          existing={current}
          others={items.filter((r) => r.ID !== current?.ID)}
          withPrice={withPrice}
          nextSortOrder={items.reduce((m, r) => Math.max(m, Number(r.SortOrder ?? 0)), 0) + 1}
          onSave={(row) => { void save(tab, row); setEditing(null); }}
          onDelete={current ? () => { void remove(tab, String(current.ID)); setEditing(null); } : undefined}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button className="btn btn-secondary" onClick={() => setEditing("new")}>{addLabel}</button>
      )}

      {withPrice && items.length > 1 && (
        <div className="segmented" role="tablist" aria-label="Sort">
          <button role="tab" aria-selected={sort === "order"} onClick={() => setSort("order")}>Your order</button>
          <button role="tab" aria-selected={sort === "value"} onClick={() => setSort("value")}>Best protein value</button>
        </div>
      )}

      <section className="card">
        {items.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Nothing here yet.</p>
        ) : (
          <ul className="list" aria-label={title} style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {shown.map((r, i) => (
              <li key={String(r.ID)} className="row-between" style={{ gap: 4 }}>
                <button className="list-row" onClick={() => setEditing(String(r.ID))}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{show(r.Name)}</span>
                    <span className="small muted">{summary(r, withPrice)}</span>
                    {withPrice && proteinPerTen(r.Protein, r.Price) !== null && (
                      <span className="small" style={{ color: "var(--accent)", fontWeight: 600 }}>{proteinValueText(r.Protein, r.Price)}</span>
                    )}
                  </span>
                </button>
                {reorderable && sort === "order" && (
                  <span style={{ display: "flex" }}>
                    <button className="icon-btn" aria-label={`Move ${show(r.Name)} up`} disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                    <button className="icon-btn" aria-label={`Move ${show(r.Name)} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>▼</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

type FormProps = {
  existing?: Row;
  others: Row[];
  withPrice: boolean;
  nextSortOrder: number;
  onSave(row: Row): void;
  onDelete?(): void;
  onCancel(): void;
};

function FoodForm({ existing, others, withPrice, nextSortOrder, onSave, onDelete, onCancel }: FormProps) {
  const [name, setName] = useState(show(existing?.Name));
  const [price, setPrice] = useState(show(existing?.Price));
  const [kcal, setKcal] = useState(show(existing?.Kcal));
  const [protein, setProtein] = useState(show(existing?.Protein));
  const [error, setError] = useState<{ field: Field; message: string }>();

  function submit() {
    const n = name.trim();
    if (!n) return setError({ field: "name", message: "Enter a name" });
    if (others.some((r) => show(r.Name).trim().toLowerCase() === n.toLowerCase())) return setError({ field: "name", message: "Already exists" });
    let priceValue: number | null = null;
    if (withPrice && price.trim()) {
      const p = parseAmountInput(price);
      if (!p.ok) return setError({ field: "price", message: p.error });
      priceValue = p.value;
    }
    const k = parseNutritionInput(kcal);
    if (!k.ok) return setError({ field: "kcal", message: k.error });
    const p = parseNutritionInput(protein);
    if (!p.ok) return setError({ field: "protein", message: p.error });
    onSave({
      ...(existing ?? {}),
      Name: n,
      ...(withPrice ? { Price: priceValue } : {}),
      Kcal: k.value === null ? null : roundKcal(k.value),
      Protein: p.value === null ? null : roundProtein(p.value),
      SortOrder: existing?.SortOrder ?? nextSortOrder,
    });
  }

  const input = (field: Field, label: string, value: string, set: (v: string) => void, mode: "numeric" | "decimal" | "text") => (
    <>
      <label className="field">
        {label}
        <input
          value={value}
          onChange={(e) => { set(e.target.value); setError(undefined); }}
          inputMode={mode}
          aria-invalid={error?.field === field}
          aria-describedby={error?.field === field ? `${field}-error` : undefined}
        />
      </label>
      {error?.field === field && <div id={`${field}-error`} className="field-error" role="alert">{error.message}</div>}
    </>
  );

  return (
    <section className="card" aria-label={existing ? `Edit ${show(existing.Name)}` : "New item"}>
      {input("name", "Name", name, setName, "text")}
      {withPrice && input("price", "Price (NT$)", price, setPrice, "numeric")}
      <div className="grid-2">
        <div>{input("kcal", "Kcal", kcal, setKcal, "decimal")}</div>
        <div>{input("protein", "Protein (g)", protein, setProtein, "decimal")}</div>
      </div>
      <span className="small muted">Leave blank if you don't know</span>
      <div className="grid-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit}>Save</button>
      </div>
      {onDelete && <ConfirmDelete question={`Delete ${show(existing?.Name)}? Meals you already logged stay as they are.`} onDelete={onDelete} />}
    </section>
  );
}
