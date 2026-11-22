import { useMemo, useState } from "react";
import { useData } from "../store";
import { cashFlowRange, inPeriod, monthlyCashFlow, periodFor, summarize, type Period } from "../../shared/aggregate";
import { todayTaipei } from "../../shared/dates";
import { formatNT } from "../../shared/money";
import { changeId } from "../../shared/changes";
import type { Row } from "../../shared/schema";
import { PeriodSwitcher } from "../components/PeriodSwitcher";
import { CategoryBreakdown, entryCount } from "../components/CategoryBreakdown";
import { TransactionList } from "../components/TransactionList";
import { PairBarChart } from "../components/charts";
import { formatMonthShort, formatPct } from "../format";


type Props = {
  today?: string;
  /** When given, the period lives with the caller, so it survives opening a category or an entry. */
  period?: Period;
  onPeriodChange?(p: Period): void;
  onOpen(id: string): void;
  onOpenCategory?(category: string): void;
};
type Shown = "all" | "expense" | "income";

const SHOWN: { kind: Shown; label: string }[] = [
  { kind: "all", label: "All" },
  { kind: "expense", label: "Expenses" },
  { kind: "income", label: "Income" },
];

/** "−NT$1,195" for a negative amount. */
const signedNT = (n: number) => `${n < 0 ? "−" : ""}${formatNT(Math.abs(n))}`;
/** Plain thousands for the cash-flow table, where "NT$" on every cell won't fit at 360 px. */
const plain = (n: number) => `${n < 0 ? "−" : ""}${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export function Money({ today = todayTaipei(), period: given, onPeriodChange, onOpen, onOpenCategory }: Props) {
  const { rows, pending } = useData();
  const txs = rows.Transactions;
  const [own, setOwn] = useState<Period>(() => periodFor("week", today));
  const picked = given ?? own;
  const setPeriod = onPeriodChange ?? setOwn;
  // "All" follows the data: rows that arrive after it was picked still count.
  const period = useMemo(() => (picked.kind === "all" ? periodFor("all", today, txs) : picked), [picked, today, txs]);
  const [shown, setShown] = useState<Shown>("all");
  const [category, setCategory] = useState("");

  const s = useMemo(() => summarize(txs, period, today), [txs, period, today]);
  const flowRange = cashFlowRange(period);
  const flow = useMemo(() => monthlyCashFlow(txs, flowRange.start, flowRange.end), [txs, flowRange.start, flowRange.end]);
  const withYear = flowRange.start.slice(0, 4) !== flowRange.end.slice(0, 4);

  const categoryNames = useMemo(() => {
    const names = new Set<string>();
    const fits = (type: unknown) => shown === "all" || type === shown;
    for (const c of rows.Categories ?? []) if (!c.Hidden && fits(c.Type)) names.add(String(c.Name));
    for (const t of txs) if (t.Category && fits(t.Type)) names.add(String(t.Category));
    return [...names];
  }, [rows.Categories, txs, shown]);

  const listed = txs.filter(
    (t) => inPeriod(t, period) && (shown === "all" || t.Type === shown) && (!category || t.Category === category),
  );
  const totals = { expense: 0, income: 0 };
  for (const t of listed) if (t.Type === "expense" || t.Type === "income") totals[t.Type] += Number(t.Amount) || 0;
  // In "All" each row's share is of its own kind's total: income and spending don't add up.
  const shareOf = (t: Row) => {
    const total = t.Type === "income" ? totals.income : t.Type === "expense" ? totals.expense : 0;
    return total ? (Number(t.Amount) || 0) / total : null;
  };

  const mealsById = useMemo(() => new Map((rows.Meals ?? []).map((m) => [String(m.ID), m])), [rows.Meals]);
  // Every row in a pending request shows "saving…", not just the first one.
  const pendingIds = new Set(pending.flatMap((p) => p.changes.map(changeId)));
  const flowLabel = period.kind === "year" ? period.start.slice(0, 4) : period.kind === "all" ? "all time" : "last 12 months";

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">Synced with your Google Sheet</div>
          <h1>Money</h1>
        </div>
      </header>

      <PeriodSwitcher period={period} today={today} txs={txs} onChange={(p) => setPeriod(p)} />

      <section className="card" aria-label="Period summary">
        <div className="grid-2">
          <div>
            <div className="stat-label">Spent</div>
            <div className="stat-value">{formatNT(s.spent)}</div>
            <div className="small muted">{entryCount(s.spentCount)}</div>
          </div>
          <div>
            <div className="stat-label">Income</div>
            <div className="stat-value">{formatNT(s.income)}</div>
            <div className="small muted">{entryCount(s.incomeCount)}</div>
          </div>
          <div>
            <div className="stat-label">Net</div>
            <div className="stat-value">{signedNT(s.net)}</div>
            <div className="small muted">{s.savingsRate === null ? "Saved —" : `Saved ${s.savingsRate < 0 ? "−" : ""}${formatPct(Math.abs(s.savingsRate))}`}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="stat-label">Top category</div>
            <div style={{ fontWeight: 700, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.top ? `${s.top.category} ${formatNT(s.top.amount)}` : "—"}
            </div>
            <div className="small muted">{formatNT(s.perDay)} / day</div>
          </div>
        </div>
      </section>

      <section className="card" aria-label="Expense categories">
        <h2>Spending by category</h2>
        <CategoryBreakdown byCategory={s.byCategory} onOpen={onOpenCategory} />
      </section>

      <section className="card" aria-label="Monthly cash flow">
        <div className="row-between">
          <h2>Monthly cash flow</h2>
          <span className="small muted">{flowLabel === "all time" ? "All time" : flowLabel === "last 12 months" ? "Last 12 months" : flowLabel}</span>
        </div>
        <PairBarChart
          groups={flow.map((f) => ({ label: formatMonthShort(f.month, withYear), a: f.income, b: f.spent }))}
          aName="Income"
          bName="Spent"
          label={`Income vs spent by month, ${flowLabel}`}
          format={formatNT}
        />
        <table className="data-table">
          <caption className="small muted">Amounts in NT$</caption>
          <thead>
            <tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Spent</th><th scope="col">Net</th><th scope="col">Saved</th></tr>
          </thead>
          <tbody>
            {flow.map((f) => (
              <tr key={f.month}>
                <th scope="row">{formatMonthShort(f.month, withYear)}</th>
                <td>{plain(f.income)}</td>
                <td>{plain(f.spent)}</td>
                <td>{plain(f.net)}</td>
                <td>{f.savingsRate === null ? "—" : `${f.savingsRate < 0 ? "−" : ""}${formatPct(Math.abs(f.savingsRate))}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" aria-label="Income by category">
        <h2>Income</h2>
        {s.incomeByCategory.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No income in this period.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
            {s.incomeByCategory.map((c) => (
              <li key={c.category} className="row-between">
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.category}</span>
                  <span className="small muted">{entryCount(c.count)}</span>
                </span>
                <span style={{ whiteSpace: "nowrap" }}>
                  <b>{formatNT(c.amount)}</b> <span className="muted">· {formatPct(c.share)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="tx-heading">
        <div className="row-between">
          <h2 id="tx-heading">Transactions</h2>
          <select
            aria-label="Category filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            // Long category names must not push the card past the screen edge.
            style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 600, minHeight: 34, minWidth: 0, maxWidth: "60%", textOverflow: "ellipsis" }}
          >
            <option value="">All categories</option>
            {categoryNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="segmented" role="tablist" aria-label="Entries shown">
          {SHOWN.map(({ kind, label }) => (
            <button
              key={kind}
              role="tab"
              aria-selected={shown === kind}
              onClick={() => {
                setShown(kind);
                setCategory("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="small" style={{ fontWeight: 600 }}>
          {shown === "income" ? `Total ${formatNT(totals.income)}`
            : shown === "expense" ? `Total ${formatNT(totals.expense)}`
            : `Spent ${formatNT(totals.expense)} · Income ${formatNT(totals.income)}`}
        </div>
        <TransactionList transactions={listed} pendingIds={pendingIds} mealsById={mealsById} shareOf={shareOf} onOpen={onOpen} />
      </section>
    </main>
  );
}
