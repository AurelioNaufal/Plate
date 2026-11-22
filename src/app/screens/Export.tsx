import { useState } from "react";
import { useData } from "../store";
import { exportFileName, exportRows, toCsv, type ExportRange, type ExportTab } from "../../shared/csv";
import { monthKey, todayTaipei } from "../../shared/dates";
import { BackHeader } from "../components/BackHeader";
import { shareOrDownload } from "../download";

const TYPES: { tab: ExportTab; label: string }[] = [
  { tab: "Transactions", label: "Transactions" },
  { tab: "Meals", label: "Meals" },
  { tab: "Recurring", label: "Recurring" },
  { tab: "SavedFoods", label: "Saved foods" },
  { tab: "Workouts", label: "Workouts" },
  { tab: "Body", label: "Body" },
];
type RangeKind = "this" | "pick" | "all";

export function Export({ today = todayTaipei(), onBack }: { today?: string; onBack(): void }) {
  const { rows } = useData();
  const [picked, setPicked] = useState<Set<ExportTab>>(new Set());
  const [rangeKind, setRangeKind] = useState<RangeKind>("this");
  const [month, setMonth] = useState(monthKey(today));
  const [error, setError] = useState("");

  const toggle = (tab: ExportTab) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(tab)) next.delete(tab);
      else next.add(tab);
      return next;
    });

  async function run() {
    if (picked.size === 0) return setError("Pick at least one");
    if (rangeKind === "pick" && !/^\d{4}-\d{2}$/.test(month)) return setError("Pick a month");
    setError("");
    const range: ExportRange =
      rangeKind === "all" ? { kind: "all" } : { kind: "month", month: rangeKind === "pick" ? month : monthKey(today) };
    const files = TYPES.filter((t) => picked.has(t.tab)).map(({ tab }) => ({
      name: exportFileName(tab, range),
      text: toCsv(tab, exportRows(rows, tab, range)),
    }));
    await shareOrDownload(files);
  }

  return (
    <main className="screen">
      <BackHeader title="Export" onBack={onBack} />
      <section className="card">
        <h2>What</h2>
        {TYPES.map(({ tab, label }) => (
          <label key={tab} className="check-row">
            <input type="checkbox" checked={picked.has(tab)} onChange={() => toggle(tab)} />
            {label}
          </label>
        ))}
      </section>
      <section className="card">
        <h2>When</h2>
        {([["this", "This month"], ["pick", "Pick a month"], ["all", "All time"]] as const).map(([kind, label]) => (
          <label key={kind} className="check-row">
            <input type="radio" name="export-range" checked={rangeKind === kind} onChange={() => setRangeKind(kind)} />
            {label}
          </label>
        ))}
        {rangeKind === "pick" && (
          <label className="field">
            Month
            <input type="month" value={month} max={monthKey(today)} onChange={(e) => setMonth(e.target.value)} />
          </label>
        )}
      </section>
      {error && <div className="field-error" role="alert">{error}</div>}
      <button className="btn btn-primary" onClick={run}>Export</button>
      <p className="small muted" style={{ margin: 0 }}>
        One CSV file per type, ready for Excel or Google Sheets. Full backup: open your Plate Sheet → File → Download → Microsoft Excel (.xlsx).
      </p>
    </main>
  );
}
