import { useMemo } from "react";
import { useData } from "../store";
import { cashFlowRange, categoryByMonth, categoryOf, inPeriod, type Period } from "../../shared/aggregate";
import { formatNT } from "../../shared/money";
import { changeId } from "../../shared/changes";
import { BackHeader } from "../components/BackHeader";
import { BarChart } from "../components/charts";
import { TransactionList } from "../components/TransactionList";
import { entryCount } from "../components/CategoryBreakdown";
import { formatDay, formatFullDate, formatMonth, formatMonthShort, formatPct } from "../format";

type Props = { category: string; period: Period; onBack(): void; onOpen(id: string): void };

const periodLabel = (p: Period) =>
  p.kind === "month" ? formatMonth(p.start)
  : p.kind === "year" ? p.start.slice(0, 4)
  : p.kind === "all" ? `All time · since ${formatFullDate(p.start)}`
  : `${formatDay(p.start)} – ${formatDay(p.end)}`;

/** One expense category: its total for the Money period, month by month, and its entries. */
export function CategoryDetail({ category, period, onBack, onOpen }: Props) {
  const { rows, pending } = useData();
  const txs = rows.Transactions;
  const entries = useMemo(
    () => txs.filter((t) => t.Type === "expense" && categoryOf(t) === category && inPeriod(t, period)),
    [txs, category, period],
  );
  const total = entries.reduce((s, t) => s + (Number(t.Amount) || 0), 0);
  const range = cashFlowRange(period);
  const months = useMemo(() => categoryByMonth(txs, category, range.start, range.end), [txs, category, range.start, range.end]);
  const withYear = range.start.slice(0, 4) !== range.end.slice(0, 4);
  const rangeLabel = period.kind === "year" ? period.start.slice(0, 4) : period.kind === "all" ? "all time" : "last 12 months";
  const mealsById = useMemo(() => new Map((rows.Meals ?? []).map((m) => [String(m.ID), m])), [rows.Meals]);
  const pendingIds = new Set(pending.flatMap((p) => p.changes.map(changeId)));

  return (
    <main className="screen">
      <BackHeader title={category} onBack={onBack} />

      <section className="card" aria-label="Category total">
        <div className="stat-label">{periodLabel(period)}</div>
        <div className="row-between" style={{ alignItems: "flex-end" }}>
          <div className="stat-big">{formatNT(total)}</div>
          <span className="small muted">{entryCount(entries.length)}</span>
        </div>
      </section>

      <section className="card" aria-label="By month">
        <div className="row-between">
          <h2>By month</h2>
          <span className="small muted">{rangeLabel === "all time" ? "All time" : rangeLabel === "last 12 months" ? "Last 12 months" : rangeLabel}</span>
        </div>
        <BarChart
          bars={months.map((m) => ({ label: formatMonthShort(m.month, withYear), value: m.amount }))}
          label={`${category} spending by month, ${rangeLabel}`}
          format={formatNT}
        />
        <table className="data-table">
          <caption className="small muted">Amounts in NT$ · share of this category's total</caption>
          <thead>
            <tr><th scope="col">Month</th><th scope="col">Spent</th><th scope="col">Share</th></tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row">{formatMonthShort(m.month, withYear)}</th>
                <td>{Math.round(m.amount).toLocaleString("en-US")}</td>
                <td>{formatPct(m.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" aria-labelledby="cat-entries">
        <h2 id="cat-entries">Entries</h2>
        <TransactionList
          transactions={entries}
          pendingIds={pendingIds}
          mealsById={mealsById}
          shareOf={(t) => (total ? (Number(t.Amount) || 0) / total : null)}
          onOpen={onOpen}
        />
      </section>
    </main>
  );
}
