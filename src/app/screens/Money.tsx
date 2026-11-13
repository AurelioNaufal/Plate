import { useMemo, useState } from "react";
import { useData } from "../store";
import { inPeriod, periodFor, summarize, type Period } from "../../shared/aggregate";
import { todayTaipei } from "../../shared/dates";
import { formatNT } from "../../shared/money";
import { changeId } from "../../shared/changes";
import { PeriodSwitcher } from "../components/PeriodSwitcher";
import { CategoryBreakdown } from "../components/CategoryBreakdown";
import { TransactionList } from "../components/TransactionList";

type Props = { today?: string; onOpen(id: string): void };

export function Money({ today = todayTaipei(), onOpen }: Props) {
  const { rows, pending } = useData();
  const [period, setPeriod] = useState<Period>(() => periodFor("week", today));
  const [category, setCategory] = useState("");

  const txs = rows.Transactions;
  const s = useMemo(() => summarize(txs, period, today), [txs, period, today]);
  const categoryNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of rows.Categories ?? []) if (!c.Hidden) names.add(String(c.Name));
    for (const t of txs) if (t.Category) names.add(String(t.Category));
    return [...names];
  }, [rows.Categories, txs]);

  const listed = txs.filter((t) => inPeriod(t, period) && (!category || t.Category === category));
  // Every row in a pending request shows "saving…", not just the first one.
  const pendingIds = new Set(pending.flatMap((p) => p.changes.map(changeId)));

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">Synced with your Google Sheet</div>
          <h1>Money</h1>
        </div>
      </header>

      <PeriodSwitcher period={period} today={today} onChange={setPeriod} />

      <section className="card" aria-label="Period summary">
        <div className="row-between" style={{ alignItems: "flex-end" }}>
          <div>
            <div className="stat-label">Spent</div>
            <div className="stat-big">{formatNT(s.spent)}</div>
          </div>
          <span className="small muted">{formatNT(s.perDay)} / day</span>
        </div>
        <div className="grid-2">
          <div>
            <div className="stat-label">Income</div>
            <div style={{ fontWeight: 700 }}>{formatNT(s.income)}</div>
          </div>
          <div>
            <div className="stat-label">Net</div>
            <div style={{ fontWeight: 700 }}>{s.net < 0 ? "−" : ""}{formatNT(Math.abs(s.net))}</div>
          </div>
        </div>
        <CategoryBreakdown byCategory={s.byCategory} />
      </section>

      <section className="card" aria-labelledby="tx-heading">
        <div className="row-between">
          <h2 id="tx-heading">Transactions</h2>
          <select
            aria-label="Category filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 600, minHeight: 34 }}
          >
            <option value="">All categories</option>
            {categoryNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <TransactionList transactions={listed} pendingIds={pendingIds} onOpen={onOpen} />
      </section>
    </main>
  );
}
