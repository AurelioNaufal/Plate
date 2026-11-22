import { useMemo, useState, type ReactNode } from "react";
import { useData } from "../store";
import { addDays, daysBetween, todayTaipei } from "../../shared/dates";
import { bmi, dailyWeights, profileFrom, weightTrend } from "../../shared/body";
import type { Row } from "../../shared/schema";
import { formatShortDay } from "../format";
import { LineChart } from "../components/charts";
import { ConfirmDelete } from "../components/ConfirmDelete";

type Props = {
  today?: string;
  onOpenProfile(): void;
  onOpenSettings(): void;
  onOpenTargets(): void;
  onOpenReviews?(): void;
  /** Slot for the target suggestion card (Task 10). */
  suggestion?: ReactNode;
};

const show = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

type Field = "weight" | "fat" | "waist" | "arm";

/** "" → null; a number in (min, max) → that number; anything else → undefined (invalid). */
function parseStat(s: string, min: number, max: number, minOk = false): number | null | undefined {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  const n = Number(t);
  return (minOk ? n >= min : n > min) && n < max ? n : undefined;
}

export function Body({ today = todayTaipei(), onOpenProfile, onOpenSettings, onOpenTargets, onOpenReviews, suggestion }: Props) {
  const { rows, save, remove } = useData();
  const body = rows.Body ?? [];
  const daily = useMemo(() => dailyWeights(body), [body]);
  const trend = useMemo(() => weightTrend(daily), [daily]);
  const profile = profileFrom(rows.Settings ?? []);
  const latest = daily.at(-1) ?? null;
  const latestTrend = trend.at(-1) ?? null;

  const [date, setDate] = useState(today);
  const rowFor = (d: string) => [...body].reverse().find((r) => r.Date === d);
  const [form, setForm] = useState(() => fill(rowFor(today)));
  const [more, setMore] = useState(() => hasExtras(rowFor(today)));
  const [error, setError] = useState<{ field: Field; message: string }>();
  const [saved, setSaved] = useState(false);

  function pickDate(d: string) {
    setDate(d);
    const r = rowFor(d);
    setForm(fill(r));
    if (hasExtras(r)) setMore(true);
    setError(undefined);
    setSaved(false);
  }

  function submit() {
    if (!form.weight.trim()) return setError({ field: "weight", message: "Enter your weight" });
    const kg = parseStat(form.weight, 0, 500);
    if (kg === undefined || kg === null) return setError({ field: "weight", message: "Check the number" });
    const fat = parseStat(form.fat, 0, 100.0001, true);
    if (fat === undefined) return setError({ field: "fat", message: "Check the number" });
    const waist = parseStat(form.waist, 0, 1000);
    if (waist === undefined) return setError({ field: "waist", message: "Check the number" });
    const arm = parseStat(form.arm, 0, 1000);
    if (arm === undefined) return setError({ field: "arm", message: "Check the number" });
    const existing = rowFor(date);
    void save("Body", { ...(existing ?? {}), Date: date, WeightKg: kg, BodyFatPct: fat, WaistCm: waist, ArmCm: arm });
    setError(undefined);
    setSaved(true);
  }

  const since = (() => {
    if (!latestTrend || trend.length < 2) return null;
    const target = addDays(latestTrend.date, -7);
    const base = [...trend].reverse().find((p) => p.date <= target) ?? trend[0];
    if (base.date === latestTrend.date) return null;
    const change = Math.round((latestTrend.kg - base.kg) * 10) / 10;
    return `${change === 0 ? "No change" : `${signed(change)} kg`} in ${daysBetween(base.date, latestTrend.date)} days`;
  })();

  const from = addDays(today, -89);
  const recent = daily.filter((d) => d.date >= from);
  const recentTrend = trend.filter((d) => d.date >= from);
  const b = bmi(latest?.kg ?? null, profile.heightCm);
  const history = [...body]
    .filter((r) => typeof r.Date === "string")
    .sort((x, y) => (String(x.Date) < String(y.Date) ? 1 : -1))
    .slice(0, 20);
  const existing = rowFor(date);

  const input = (field: Field, label: string, value: string, mode: "decimal" = "decimal") => (
    <>
      <label className="field">
        {label}
        <input
          value={value}
          inputMode={mode}
          onChange={(e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setError(undefined); setSaved(false); }}
          aria-invalid={error?.field === field}
          aria-describedby={error?.field === field ? `${field}-error` : undefined}
        />
      </label>
      {error?.field === field && <div id={`${field}-error`} className="field-error" role="alert">{error.message}</div>}
    </>
  );

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">Weight, trend and targets</div>
          <h1>Body</h1>
        </div>
      </header>

      <section className="card" aria-label="Log weight">
        <div className="grid-2">
          <div>{input("weight", "Weight (kg)", form.weight)}</div>
          <label className="field">
            Date
            <input type="date" value={date} max={today} onChange={(e) => e.target.value && pickDate(e.target.value)} />
          </label>
        </div>
        {more ? (
          <div className="grid-2">
            <div>{input("fat", "Body fat (%)", form.fat)}</div>
            <div>{input("waist", "Waist (cm)", form.waist)}</div>
            <div>{input("arm", "Arm (cm)", form.arm)}</div>
          </div>
        ) : (
          <button className="btn-link" style={{ alignSelf: "flex-start" }} onClick={() => setMore(true)}>More</button>
        )}
        <div className="row-between">
          <span className="small muted">{saved ? "Saved" : existing ? `Editing ${formatShortDay(date)}` : "Optional stats can stay blank."}</span>
          <button className="btn btn-primary" onClick={submit}>Save weigh-in</button>
        </div>
        {existing && <ConfirmDelete question={`Delete the weigh-in for ${formatShortDay(date)}?`} onDelete={() => { void remove("Body", String(existing.ID)); pickDate(today); }} />}
      </section>

      {suggestion}

      <section className="card" aria-label="Weight trend">
        <div className="row-between" style={{ alignItems: "flex-end" }}>
          <div>
            <div className="stat-label">Trend (7-day average)</div>
            <div className="stat-big">{latestTrend ? `${latestTrend.kg} kg` : "—"}</div>
          </div>
          {since && <span className="small muted">{since}</span>}
        </div>
        <LineChart
          points={recent.map((d) => ({ x: d.date, y: d.kg }))}
          trend={recentTrend.map((d) => ({ x: d.date, y: d.kg }))}
          unit="kg"
          label={latestTrend ? `Weight over the last 90 days: ${recent.length} weigh-ins, trend now ${latestTrend.kg} kg` : "Weight over the last 90 days"}
        />
      </section>

      <section className="card" aria-label="BMI">
        {b ? (
          <div className="row-between">
            <span style={{ fontWeight: 700 }}>{`BMI ${b.value} · ${b.label}`}</span>
            <span className="small muted">{`${profile.heightCm} cm`}</span>
          </div>
        ) : latest ? (
          <button className="btn-link" style={{ alignSelf: "flex-start" }} onClick={onOpenProfile}>Add your height in Profile</button>
        ) : (
          <span className="small muted">Log a weight to see your BMI.</span>
        )}
      </section>

      <section className="card" aria-label="Weigh-ins">
        <h2>Weigh-ins</h2>
        {history.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No weigh-ins yet.</p>
        ) : (
          <div className="list">
            {history.map((r) => (
              <button key={String(r.ID)} className="list-row" onClick={() => pickDate(String(r.Date))}>
                <span style={{ fontSize: 14 }}>{historyLine(r)}</span>
                <span className="muted">›</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <button className="list-row" onClick={onOpenProfile}><span>Profile</span><span className="muted">›</span></button>
        <button className="list-row" onClick={onOpenTargets}><span>Targets</span><span className="muted">›</span></button>
        {onOpenReviews && <button className="list-row" onClick={onOpenReviews}><span>Weekly reviews</span><span className="muted">›</span></button>}
        <button className="list-row" onClick={onOpenSettings}><span>Settings</span><span className="muted">›</span></button>
      </section>
    </main>
  );
}

function fill(r: Row | undefined) {
  return { weight: show(r?.WeightKg), fat: show(r?.BodyFatPct), waist: show(r?.WaistCm), arm: show(r?.ArmCm) };
}

function hasExtras(r: Row | undefined) {
  return !!r && [r.BodyFatPct, r.WaistCm, r.ArmCm].some((v) => typeof v === "number");
}

function historyLine(r: Row): string {
  const parts = [formatShortDay(String(r.Date))];
  if (typeof r.WeightKg === "number") parts.push(`${r.WeightKg} kg`);
  if (typeof r.BodyFatPct === "number") parts.push(`${r.BodyFatPct}% fat`);
  if (typeof r.WaistCm === "number") parts.push(`waist ${r.WaistCm} cm`);
  if (typeof r.ArmCm === "number") parts.push(`arm ${r.ArmCm} cm`);
  return parts.join(" · ");
}
