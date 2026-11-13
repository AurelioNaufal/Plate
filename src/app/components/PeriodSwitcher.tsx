import { periodFor, shiftPeriod, type Period, type PeriodKind } from "../../shared/aggregate";
import { formatDay, formatMonth } from "../format";

type Props = { period: Period; today: string; onChange(p: Period): void };

const KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: "week", label: "Week" },
  { kind: "month", label: "Month" },
  { kind: "custom", label: "Custom" },
];

export function PeriodSwitcher({ period, today, onChange }: Props) {
  const pick = (kind: PeriodKind) => {
    if (kind === "custom") onChange({ kind, start: period.start, end: period.end });
    else onChange(periodFor(kind, today));
  };
  const label = period.kind === "month" ? formatMonth(period.start) : `${formatDay(period.start)} – ${formatDay(period.end)}`;

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
