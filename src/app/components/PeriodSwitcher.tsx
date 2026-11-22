import { periodFor, shiftPeriod, type Period, type PeriodKind } from "../../shared/aggregate";
import type { Row } from "../../shared/schema";
import { formatDay, formatFullDate, formatMonth } from "../format";

/** txs lets "All" start at the earliest transaction. */
type Props = { period: Period; today: string; txs?: Row[]; onChange(p: Period): void };

const KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: "week", label: "Week" },
  { kind: "month", label: "Month" },
  { kind: "year", label: "Year" },
  { kind: "all", label: "All" },
  { kind: "custom", label: "Custom" },
];

export function PeriodSwitcher({ period, today, txs = [], onChange }: Props) {
  const pick = (kind: PeriodKind) => {
    if (kind === "custom") onChange({ kind, start: period.start, end: period.end });
    else onChange(periodFor(kind, today, txs));
  };
  const label =
    period.kind === "month" ? formatMonth(period.start)
    : period.kind === "year" ? period.start.slice(0, 4)
    : period.kind === "all" ? `All time · since ${formatFullDate(period.start)}`
    : `${formatDay(period.start)} – ${formatDay(period.end)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="segmented" role="tablist" aria-label="Period">
        {KINDS.map(({ kind, label }) => (
          <button key={kind} role="tab" aria-selected={period.kind === kind} onClick={() => pick(kind)}>
            {label}
          </button>
        ))}
      </div>
      {period.kind === "custom" ? (
        <div className="grid-2">
          <label className="field">
            From
            <input type="date" value={period.start} max={period.end} onChange={(e) => e.target.value && onChange({ ...period, start: e.target.value })} />
          </label>
          <label className="field">
            To
            <input type="date" value={period.end} min={period.start} onChange={(e) => e.target.value && onChange({ ...period, end: e.target.value })} />
          </label>
        </div>
      ) : period.kind === "all" ? (
        <div style={{ fontWeight: 600, fontSize: 14, textAlign: "center", minHeight: 34, display: "grid", placeItems: "center" }}>{label}</div>
      ) : (
        <div className="row-between">
          <button className="icon-btn" aria-label="Previous period" onClick={() => onChange(shiftPeriod(period, -1))}>‹</button>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
          <button className="icon-btn" aria-label="Next period" onClick={() => onChange(shiftPeriod(period, 1))}>›</button>
        </div>
      )}
    </div>
  );
}
