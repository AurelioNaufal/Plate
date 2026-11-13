import { useMemo, useState } from "react";
import { useData } from "../store";
import { todayTaipei } from "../../shared/dates";
import { formatNT, parseAmountInput } from "../../shared/money";
import { describeSchedule, recurringProblem } from "../../shared/recurring";
import type { Row } from "../../shared/schema";
import { BackHeader } from "../components/BackHeader";
import { ConfirmDelete } from "../components/ConfirmDelete";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const show = (v: unknown) => (v === null || v === undefined ? "" : String(v));

type Props = { today?: string; onBack(): void };

export function Recurring({ today = todayTaipei(), onBack }: Props) {
  const { rows, save, remove } = useData();
  const items = useMemo(() => [...(rows.Recurring ?? [])].sort((a, b) => show(a.Name).localeCompare(show(b.Name))), [rows.Recurring]);
  const [editing, setEditing] = useState<string | null>(null);
  const current = editing && editing !== "new" ? items.find((r) => r.ID === editing) : undefined;

  // Back on: charging restarts today, so the weeks it was off are not filled in.
  const toggle = (item: Row) =>
    void save("Recurring", item.Active === true ? { ...item, Active: false } : { ...item, Active: true, ActiveSince: today });

  return (
    <main className="screen">
      <BackHeader title="Recurring charges" onBack={onBack} />
      <p className="muted small" style={{ margin: 0 }}>
        These are added to your transactions automatically on their day. Don't also type them in by hand.
      </p>

      {editing ? (
        <RecurringForm
          key={editing}
          existing={current}
          today={today}
          categories={rows.Categories ?? []}
          onSave={(row) => { void save("Recurring", row); setEditing(null); }}
          onDelete={current ? () => { void remove("Recurring", String(current.ID)); setEditing(null); } : undefined}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button className="btn btn-secondary" onClick={() => setEditing("new")}>Add recurring charge</button>
      )}

      <section className="card">
        {items.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No recurring charges yet.</p>
        ) : (
          <ul className="list" aria-label="Recurring charges" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((item) => (
              <li key={String(item.ID)} className="row-between" style={{ gap: 8 }}>
                <button className="list-row" onClick={() => setEditing(String(item.ID))}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{show(item.Name)}</span>
                    {recurringProblem(item) ? (
                      <span className="small" style={{ color: "var(--danger)", fontWeight: 600 }}>
                        {`Fix this row in the Sheet: ${recurringProblem(item)}`}
                      </span>
                    ) : (
                      <span className="small muted">{`${formatNT(Number(item.Amount))} · ${describeSchedule(item)}`}</span>
                    )}
                  </span>
                </button>
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  aria-label={show(item.Name)}
                  checked={item.Active === true}
                  aria-checked={item.Active === true}
                  onChange={() => toggle(item)}
                />
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
  today: string;
  categories: Row[];
  onSave(row: Row): void;
  onDelete?(): void;
  onCancel(): void;
};

type Field = "name" | "amount" | "monthDay" | "startDate";

function RecurringForm({ existing, today, categories, onSave, onDelete, onCancel }: FormProps) {
  const options = useMemo(() => {
    const visible = categories
      .filter((c) => c.Type === "expense" && !c.Hidden)
      .sort((a, b) => Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0))
      .map((c) => show(c.Name));
    if (existing?.Category && !visible.includes(show(existing.Category))) visible.unshift(show(existing.Category));
    return visible;
  }, [categories, existing]);

  const [name, setName] = useState(show(existing?.Name));
  const [amount, setAmount] = useState(show(existing?.Amount));
  const [category, setCategory] = useState(show(existing?.Category) || options[0] || "");
  const [frequency, setFrequency] = useState(existing?.Frequency === "monthly" ? "monthly" : "weekly");
  const [weekdayValue, setWeekdayValue] = useState(typeof existing?.Weekday === "number" ? String(existing.Weekday) : "0");
  const [monthDay, setMonthDay] = useState(typeof existing?.MonthDay === "number" ? String(existing.MonthDay) : "1");
  const [startDate, setStartDate] = useState(show(existing?.StartDate) || today);
  const [active, setActive] = useState(existing ? existing.Active === true : true);
  const [error, setError] = useState<{ field: Field; message: string }>();

  function submit() {
    const n = name.trim();
    if (!n) return setError({ field: "name", message: "Enter a name" });
    const a = parseAmountInput(amount);
    if (!a.ok) return setError({ field: "amount", message: a.error });
    let day: number | null = null;
    if (frequency === "monthly") {
      day = Number(monthDay.trim());
      if (!/^\d+$/.test(monthDay.trim()) || day < 1 || day > 31) return setError({ field: "monthDay", message: "Use a day from 1 to 31" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return setError({ field: "startDate", message: "Pick a start date" });
    const turnedOn = active && existing?.Active !== true;
    onSave({
      ...(existing ?? {}),
      Name: n,
      Amount: a.value,
      Category: category || options[0] || null,
      Frequency: frequency,
      Weekday: frequency === "weekly" ? Number(weekdayValue) : null,
      MonthDay: day,
      StartDate: startDate,
      Active: active,
      // Switching an existing item back on here starts it today, like the list switch.
      ActiveSince: existing && turnedOn ? today : (existing?.ActiveSince ?? null),
    });
  }

  const errorFor = (field: Field) =>
    error?.field === field ? <div id={`${field}-error`} className="field-error" role="alert">{error.message}</div> : null;
  const invalid = (field: Field) => ({
    "aria-invalid": error?.field === field,
    "aria-describedby": error?.field === field ? `${field}-error` : undefined,
  });
  const clear = () => setError(undefined);

  return (
    <section className="card" aria-label={existing ? `Edit ${show(existing.Name)}` : "New recurring charge"}>
      <label className="field">
        Name
        <input value={name} onChange={(e) => { setName(e.target.value); clear(); }} placeholder="e.g. YouTube Premium" {...invalid("name")} />
      </label>
      {errorFor("name")}
      <label className="field">
        Amount (NT$)
        <input value={amount} onChange={(e) => { setAmount(e.target.value); clear(); }} inputMode="numeric" {...invalid("amount")} />
      </label>
      {errorFor("amount")}
      <label className="field">
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      <div className="grid-2">
        <label className="field">
          Frequency
          <select value={frequency} onChange={(e) => { setFrequency(e.target.value); clear(); }}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        {frequency === "weekly" ? (
          <label className="field">
            Day of week
            <select value={weekdayValue} onChange={(e) => setWeekdayValue(e.target.value)}>
              {WEEKDAYS.map((d, i) => <option key={d} value={String(i)}>{d}</option>)}
            </select>
          </label>
        ) : (
          <label className="field">
            Day of month
            <input value={monthDay} onChange={(e) => { setMonthDay(e.target.value); clear(); }} inputMode="numeric" {...invalid("monthDay")} />
          </label>
        )}
      </div>
      {errorFor("monthDay")}
      {frequency === "monthly" && Number(monthDay) >= 29 && Number(monthDay) <= 31 && (
        <span className="small muted">In shorter months it's charged on the last day.</span>
      )}
      <label className="field">
        Start date
        <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); clear(); }} {...invalid("startDate")} />
      </label>
      {errorFor("startDate")}
      <span className="small muted">The first charge is on or after this date. Pick your next billing day so past months aren't added.</span>
      <label className="row-between field" style={{ flexDirection: "row" }}>
        <span>Active</span>
        <input type="checkbox" role="switch" className="switch" checked={active} aria-checked={active} onChange={(e) => setActive(e.target.checked)} />
      </label>
      <div className="grid-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit}>Save</button>
      </div>
      {onDelete && (
        <ConfirmDelete question={`Delete ${show(existing?.Name)}? Past charges stay in your transactions.`} onDelete={onDelete} />
      )}
    </section>
  );
}
