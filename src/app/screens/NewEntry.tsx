import { useMemo, useState } from "react";
import { useData } from "../store";
import { todayTaipei } from "../../shared/dates";
import { parseAmountInput } from "../../shared/money";
import type { Row, TxType } from "../../shared/schema";
import { MealForm } from "../components/MealForm";

type Props = { editId?: string; editMealId?: string; today?: string; onDone(): void };
type EntryTab = "meal" | TxType;

export function NewEntry({ editId, editMealId, today = todayTaipei(), onDone }: Props) {
  const { rows } = useData();
  const meals = rows.Meals ?? [];
  const tx = editId ? rows.Transactions.find((t) => t.ID === editId) : undefined;
  // A meal's expense is edited as the meal, so the two stay in step.
  const meal = editMealId
    ? meals.find((m) => m.ID === editMealId)
    : tx?.MealID
      ? meals.find((m) => m.ID === tx.MealID)
      : undefined;

  if (meal) {
    return (
      <main className="screen">
        <EntryHeader title="Edit meal" onClose={onDone} />
        <MealForm meal={meal} today={today} onDone={onDone} />
      </main>
    );
  }
  return <TxOrNewEntry existing={tx} today={today} onDone={onDone} />;
}

function EntryHeader({ title, onClose }: { title: string; onClose(): void }) {
  return (
    <header className="row-between" style={{ paddingTop: 12 }}>
      <button className="icon-btn" aria-label="Close" onClick={onClose} style={{ marginLeft: -10 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <h1 style={{ fontSize: 17 }}>{title}</h1>
      <span style={{ width: 44 }} />
    </header>
  );
}

function TxOrNewEntry({ existing, today, onDone }: { existing?: Row; today: string; onDone(): void }) {
  const { rows, save, remove } = useData();
  const [tab, setTab] = useState<EntryTab>(existing ? (existing.Type === "income" ? "income" : "expense") : "meal");
  const type: TxType = tab === "income" ? "income" : "expense";

  return (
    <main className="screen">
      <EntryHeader title={existing ? "Edit entry" : "New entry"} onClose={onDone} />

      <div className="segmented" role="tablist" aria-label="Entry type">
        {/* An existing expense or income can't become a meal; log a new meal instead. */}
        <button role="tab" aria-selected={tab === "meal"} disabled={!!existing} onClick={() => setTab("meal")}>Meal</button>
        <button role="tab" aria-selected={tab === "expense"} onClick={() => setTab("expense")}>Expense</button>
        <button role="tab" aria-selected={tab === "income"} onClick={() => setTab("income")}>Income</button>
      </div>

      {tab === "meal" ? (
        <MealForm today={today} onDone={onDone} />
      ) : (
        <TxFields existing={existing} type={type} today={today} rows={rows} save={save} remove={remove} onDone={onDone} />
      )}
    </main>
  );
}

type TxFieldsProps = {
  existing?: Row;
  type: TxType;
  today: string;
  rows: ReturnType<typeof useData>["rows"];
  save: ReturnType<typeof useData>["save"];
  remove: ReturnType<typeof useData>["remove"];
  onDone(): void;
};

function TxFields({ existing, type, today, rows, save, remove, onDone }: TxFieldsProps) {
  const [amount, setAmount] = useState(existing ? String(existing.Amount ?? "") : "");
  const [description, setDescription] = useState(existing?.Description ? String(existing.Description) : "");
  const [date, setDate] = useState(existing?.Date ? String(existing.Date) : today);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  const options = useMemo(() => {
    const visible = (rows.Categories ?? [])
      .filter((c) => c.Type === type && !c.Hidden)
      .sort((a, b) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0))
      .map((c) => String(c.Name));
    // An entry being edited keeps its category even if that one is now hidden.
    if (existing?.Category && existing.Type === type && !visible.includes(String(existing.Category))) visible.unshift(String(existing.Category));
    return visible;
  }, [rows.Categories, type, existing]);

  const [category, setCategory] = useState(existing?.Category ? String(existing.Category) : "");
  const chosen = options.includes(category) ? category : (options[0] ?? "");

  function submit() {
    const parsed = parseAmountInput(amount);
    if (!parsed.ok) return setError(parsed.error);
    if (!chosen) return setError("Add a category first (Body › Settings › Categories)");
    const row: Row = {
      ...(existing ?? {}),
      Type: type,
      Date: date || today,
      Amount: parsed.value,
      Description: description.trim() || null,
      Category: chosen,
      // An edited import becomes app-owned so a migration re-run can't overwrite it.
      Source: !existing || existing.Source === "migrated" ? "app" : existing.Source,
    };
    void save("Transactions", row);
    onDone();
  }

  function confirmDelete() {
    if (!existing) return;
    void remove("Transactions", String(existing.ID));
    onDone();
  }

  return (
    <>
      <section className="card">
        <label className="field">
          Amount (NT$)
          <input
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(undefined);
            }}
            inputMode="numeric"
            autoFocus={!existing}
            aria-invalid={!!error}
            aria-describedby={error ? "amount-error" : undefined}
          />
        </label>
        {error && <div id="amount-error" className="field-error" role="alert">{error}</div>}
        <label className="field">
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === "expense" ? "e.g. Lunch" : "e.g. Part-time pay"} />
        </label>
        <label className="field">
          Category
          <select value={chosen} onChange={(e) => setCategory(e.target.value)}>
            {options.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </section>

      <button className="btn btn-primary" onClick={submit}>Save</button>

      {existing &&
        (confirming ? (
          <div className="row-between">
            <span className="small">Delete this entry from your Sheet?</span>
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
