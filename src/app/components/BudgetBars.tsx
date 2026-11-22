import type { BudgetStatus } from "../../shared/budgets";
import { formatNT } from "../../shared/money";
import { formatPct } from "../format";

const FILL = { ok: "var(--accent)", warn: "var(--kcal)", over: "var(--danger)" } as const;

/** One bar per budget. The words carry the state ("left" / "over"); colour only repeats it. */
export function BudgetBars({ status }: { status: BudgetStatus[] }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {status.map((b) => (
        <li key={b.category} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="row-between" style={{ fontSize: 14 }}>
            <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.category}</span>
            <b style={{ whiteSpace: "nowrap", color: b.level === "over" ? "var(--danger)" : undefined }}>
              {b.left < 0 ? `${formatNT(-b.left)} over` : `${formatNT(b.left)} left`}
            </b>
          </div>
          <div
            className="bar"
            role="meter"
            aria-label={`${b.category} budget`}
            aria-valuemin={0}
            aria-valuemax={b.limit}
            aria-valuenow={Math.min(b.spent, b.limit)}
            aria-valuetext={`${formatNT(b.spent)} of ${formatNT(b.limit)}`}
          >
            <span style={{ width: `${Math.min(b.share, 1) * 100}%`, background: FILL[b.level] }} />
          </div>
          <span className="small muted">{`${formatNT(b.spent)} of ${formatNT(b.limit)} · ${formatPct(b.share)}`}</span>
        </li>
      ))}
    </ul>
  );
}
