import { useState } from "react";
import { useData } from "../store";
import type { Row, TxType } from "../../shared/schema";

export function Categories({ onBack }: { onBack(): void }) {
  return (
    <main className="screen">
      <header className="screen-header" style={{ justifyContent: "flex-start" }}>
        <button className="icon-btn" aria-label="Back" onClick={onBack} style={{ marginLeft: -12 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h1 style={{ fontSize: 24 }}>Categories</h1>
      </header>
      <p className="muted small" style={{ margin: 0 }}>
        Shared with your Google Sheet: changes here show up in its dropdowns and Summary. Hiding keeps past entries.
      </p>
      <CategorySection type="expense" title="Expense categories" />
      <CategorySection type="income" title="Income categories" />
    </main>
  );
}

function CategorySection({ type, title }: { type: TxType; title: string }) {
  const { rows, save } = useData();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const list = (rows.Categories ?? []).filter((c) => c.Type === type).sort((a, b) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0));

  function add() {
    const n = name.trim();
    if (!n) return setError("Type a name");
    if (list.some((c) => String(c.Name).trim().toLowerCase() === n.toLowerCase())) return setError("Already exists");
    const sortOrder = Math.max(0, ...list.map((c) => Number(c.SortOrder ?? 0))) + 1;
    void save("Categories", { Name: n, Type: type, Hidden: false, SortOrder: sortOrder });
    setName("");
    setError(undefined);
  }

  return (
    <section className="card" aria-label={title}>
      <h2>{title}</h2>
      <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {list.map((c) => (
          <CategoryItem key={String(c.ID)} category={c} />
        ))}
      </ul>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <label className="field" style={{ flex: 1 }}>
          New {type} category
          <input value={name} onChange={(e) => { setName(e.target.value); setError(undefined); }} onKeyDown={(e) => e.key === "Enter" && add()} />
        </label>
        <button className="btn btn-secondary" aria-label={`Add ${type} category`} onClick={add}>Add</button>
      </div>
      {error && <div className="field-error" role="alert">{error}</div>}
    </section>
  );
}

function CategoryItem({ category }: { category: Row }) {
  const { save, renameCategory } = useData();
  const name = String(category.Name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function rename() {
    const n = draft.trim();
    if (!n || n === name) return setEditing(false);
    setBusy(true);
    const res = await renameCategory(String(category.ID), n);
    setBusy(false);
    if (res.ok) setEditing(false);
    else setError(res.error);
  }

  return (
    <li aria-label={name} style={{ borderBottom: "1px solid var(--border)", padding: "6px 0" }}>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="field">
            New name for {name}
            <input value={draft} onChange={(e) => { setDraft(e.target.value); setError(undefined); }} autoFocus />
          </label>
          {error && <div className="field-error" role="alert">{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={rename} disabled={busy}>{busy ? "Saving…" : "Save name"}</button>
            <button className="btn btn-secondary" onClick={() => { setEditing(false); setDraft(name); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="row-between" style={{ minHeight: 44 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: category.Hidden ? "var(--muted)" : undefined }}>
            {name} {category.Hidden && <span className="small">(hidden)</span>}
          </span>
          <span style={{ display: "flex", gap: 12 }}>
            <button className="btn-link" onClick={() => setEditing(true)}>Rename</button>
            <button className="btn-link" onClick={() => void save("Categories", { ...category, Hidden: !category.Hidden })}>
              {category.Hidden ? "Unhide" : "Hide"}
            </button>
          </span>
        </div>
      )}
    </li>
  );
}
