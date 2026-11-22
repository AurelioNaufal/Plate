import { useState } from "react";
import { useData } from "../store";
import type { Change } from "../../shared/changes";
import type { Row } from "../../shared/schema";
import { BackHeader } from "../components/BackHeader";

const bySortOrder = (a: Row, b: Row) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0);

/** A monthly NT$ limit per visible expense category; blank means no budget. */
export function Budgets({ onBack }: { onBack(): void }) {
  const { rows, apply } = useData();
  const categories = (rows.Categories ?? []).filter((c) => c.Type === "expense" && !c.Hidden).sort(bySortOrder);
  const budgets = rows.Budgets ?? [];
  const budgetFor = (name: string) => budgets.find((b) => String(b.Category ?? "") === name);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => {
      const limit = budgetFor(String(c.Name))?.MonthlyLimit;
      return [String(c.Name), typeof limit === "number" ? String(limit) : ""];
    })),
  );
  const [bad, setBad] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    const changes: Change[] = [];
    for (const c of categories) {
      const name = String(c.Name);
      const text = (values[name] ?? "").trim().replace(/,/g, "");
      const existing = budgetFor(name);
      if (!text) {
        if (existing) changes.push({ tab: "Budgets", removeId: String(existing.ID) });
        continue;
      }
      if (!/^\d+$/.test(text) || Number(text) <= 0) return setBad(name);
      const limit = Number(text);
      if (existing?.MonthlyLimit === limit) continue;
      changes.push({ tab: "Budgets", row: existing ? { ...existing, MonthlyLimit: limit } : { Category: name, MonthlyLimit: limit } });
    }
    setBad(null);
    if (changes.length) void apply(changes);
    setSaved(true);
  }

  return (
    <main className="screen">
      <BackHeader title="Budgets" onBack={onBack} />
      <p className="small muted" style={{ margin: 0 }}>
        A monthly limit per category. Recurring charges count. Leave a field blank for no budget.
      </p>
      <section className="card">
        {categories.map((c) => {
          const name = String(c.Name);
          return (
            <div key={name}>
              <label className="field">
                {`${name} monthly limit`}
                <input
                  inputMode="numeric"
                  placeholder="No budget"
                  value={values[name] ?? ""}
                  aria-invalid={bad === name}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [name]: e.target.value }));
                    setSaved(false);
                  }}
                />
              </label>
              {bad === name && <div className="field-error" role="alert">Use a whole NT$ amount above 0</div>}
            </div>
          );
        })}
      </section>
      <button className="btn btn-primary" onClick={save}>Save budgets</button>
      {saved && <span className="small muted">Saved</span>}
    </main>
  );
}
