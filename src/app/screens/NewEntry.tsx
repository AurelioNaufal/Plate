import { useMemo, useState } from "react";
import { useData } from "../store";
import { todayTaipei } from "../../shared/dates";
import { parseAmountInput } from "../../shared/money";
import type { Row, TxType } from "../../shared/schema";

type Props = { editId?: string; today?: string; onDone(): void };

export function NewEntry({ editId, today = todayTaipei(), onDone }: Props) {
  const { rows, save, remove } = useData();
  const existing = editId ? rows.Transactions.find((t) => t.ID === editId) : undefined;

  const [type, setType] = useState<TxType>(existing?.Type === "income" ? "income" : "expense");
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
    <main className="screen">
      <header className="row-between" style={{ paddingTop: 12 }}>
        <button className="icon-btn" aria-label="Close" onClick={onDone} style={{ marginLeft: -10 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <h1 style={{ fontSize: 17 }}>{existing ? "Edit entry" : "New entry"}</h1>
        <span style={{ width: 44 }} />
      </header>

      <div className="segmented" role="tablist" aria-label="Entry type">
        <button role="tab" aria-selected={false} disabled title="Meal logging arrives in the next update">Meal</button>
        <button role="tab" aria-selected={type === "expense"} onClick={() => setType("expense")}>Expense</button>
        <button role="tab" aria-selected={type === "income"} onClick={() => setType("income")}>Income</button>
      </div>

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
    </main>
  );
}
