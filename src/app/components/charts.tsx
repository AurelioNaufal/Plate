// Small SVG charts (no chart library). Following the dataviz rules: thin marks
// (2px lines, 8px+ dots, 4px rounded bar ends on a square baseline, 2px gaps),
// recessive axes, one y-axis, a legend for two series, text in text colours,
// and a tap/hover readout instead of a number on every mark.
import { useState, type ReactNode } from "react";

const W = 320;
const H = 150;
const PAD = { left: 38, right: 10, top: 10, bottom: 22 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const formatDate = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`)); // "Nov 18"
const dayNumber = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;
const tidy = (n: number) => String(Math.round(n * 10) / 10);

function Frame({ label, readout, hint, children, legend }: { label: string; readout: string | null; hint: string; children: ReactNode; legend?: ReactNode }) {
  return (
    <figure className="chart">
      {legend}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="chart-svg">
        {children}
      </svg>
      <figcaption className="chart-readout small" aria-live="polite">{readout ?? hint}</figcaption>
    </figure>
  );
}

const Empty = () => <p className="muted small" style={{ margin: 0 }}>No data yet</p>;

type Point = { x: string; y: number };

/** Dots for each point. With `trend`, a line for the trend; without, a line through the points. */
export function LineChart({ points, trend, unit, label }: { points: Point[]; trend?: Point[]; unit: string; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return <Empty />;

  const all = [...points, ...(trend ?? [])];
  const xs = all.map((p) => dayNumber(p.x));
  const ys = all.map((p) => p.y);
  let [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  let [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  if (x0 === x1) [x0, x1] = [x0 - 1, x1 + 1];
  if (y0 === y1) [y0, y1] = [y0 - 1, y1 + 1];
  const padY = (y1 - y0) * 0.1;
  [y0, y1] = [y0 - padY, y1 + padY];
  const sx = (d: string) => PAD.left + ((dayNumber(d) - x0) / (x1 - x0)) * PLOT_W;
  const sy = (v: number) => PAD.top + (1 - (v - y0) / (y1 - y0)) * PLOT_H;
  const line = (ps: Point[]) => ps.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const shown = active === null ? null : points[active];
  const first = all.reduce((a, b) => (a.x < b.x ? a : b)).x;
  const last = all.reduce((a, b) => (a.x > b.x ? a : b)).x;

  return (
    <Frame label={label} readout={shown ? `${formatDate(shown.x)} · ${tidy(shown.y)} ${unit}` : null} hint="Tap a dot for its value">
      <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + PLOT_H} y2={PAD.top + PLOT_H} className="chart-axis" />
      <text x={PAD.left - 6} y={sy(y1 - padY) + 4} className="chart-tick" textAnchor="end">{tidy(y1 - padY)}</text>
      <text x={PAD.left - 6} y={sy(y0 + padY) + 4} className="chart-tick" textAnchor="end">{tidy(y0 + padY)}</text>
      <text x={PAD.left} y={H - 6} className="chart-tick">{formatDate(first)}</text>
      {last !== first && <text x={W - PAD.right} y={H - 6} className="chart-tick" textAnchor="end">{formatDate(last)}</text>}
      {trend && trend.length > 1 && <polyline data-trend points={line(trend)} className="chart-line" />}
      {!trend && points.length > 1 && <polyline points={line(points)} className="chart-line" />}
      {points.map((p, i) => (
        <circle key={`${p.x}-${i}`} data-point cx={sx(p.x)} cy={sy(p.y)} r={i === active ? 6 : 4} className={trend ? "chart-dot chart-dot-soft" : "chart-dot"} />
      ))}
      {points.map((p, i) => (
        <circle
          key={`hit-${p.x}-${i}`}
          data-hit
          cx={sx(p.x)}
          cy={sy(p.y)}
          r={14}
          className="chart-hit"
          onClick={() => setActive(i)}
          onPointerEnter={() => setActive(i)}
        >
          <title>{`${formatDate(p.x)}: ${tidy(p.y)} ${unit}`}</title>
        </circle>
      ))}
    </Frame>
  );
}

/** A bar whose top corners are rounded and whose base sits square on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return `M${x},${y}h${w}`;
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function scaleY(max: number) {
  const top = max > 0 ? max : 1;
  return (v: number) => PAD.top + PLOT_H - (Math.max(v, 0) / top) * PLOT_H;
}

type Bar = { label: string; value: number };

export function BarChart({ bars, label, format }: { bars: Bar[]; label: string; format(v: number): string }) {
  const [active, setActive] = useState<number | null>(null);
  if (bars.length === 0) return <Empty />;
  const max = Math.max(...bars.map((b) => b.value), 0);
  const sy = scaleY(max);
  const slot = PLOT_W / bars.length;
  const bw = Math.max(2, Math.min(28, slot - 2)); // 2px gap between bars
  const every = Math.ceil(bars.length / 12);
  const shown = active === null ? null : bars[active];
  const base = PAD.top + PLOT_H;

  return (
    <Frame label={label} readout={shown ? `${shown.label} · ${format(shown.value)}` : null} hint="Tap a bar for its value">
      <text x={PAD.left - 6} y={PAD.top + 4} className="chart-tick" textAnchor="end">{format(max)}</text>
      <line x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} className="chart-axis" />
      {bars.map((b, i) => {
        const x = PAD.left + i * slot + (slot - bw) / 2;
        const y = sy(b.value);
        return (
          <g key={`${b.label}-${i}`}>
            <path data-bar d={barPath(x, y, bw, base - y)} className={`chart-bar${i === active ? " is-active" : ""}`} />
            {i % every === 0 && <text x={x + bw / 2} y={H - 6} className="chart-tick" textAnchor="middle">{b.label}</text>}
            <rect data-hit x={PAD.left + i * slot} y={PAD.top} width={slot} height={PLOT_H} className="chart-hit" onClick={() => setActive(i)} onPointerEnter={() => setActive(i)}>
              <title>{`${b.label}: ${format(b.value)}`}</title>
            </rect>
          </g>
        );
      })}
    </Frame>
  );
}

type Pair = { label: string; a: number; b: number };

/** Two series side by side per group (e.g. income vs spent), with a legend. */
export function PairBarChart({ groups, aName, bName, label, format }: { groups: Pair[]; aName: string; bName: string; label: string; format(v: number): string }) {
  const [active, setActive] = useState<number | null>(null);
  if (groups.length === 0) return <Empty />;
  const max = Math.max(...groups.flatMap((g) => [g.a, g.b]), 0);
  const sy = scaleY(max);
  const slot = PLOT_W / groups.length;
  const bw = Math.max(2, Math.min(14, (slot - 6) / 2));
  const every = Math.ceil(groups.length / 12);
  const base = PAD.top + PLOT_H;
  const shown = active === null ? null : groups[active];

  const legend = (
    <div className="chart-legend small">
      <span><span className="swatch" style={{ background: "var(--series-1)" }} /> {aName}</span>
      <span><span className="swatch" style={{ background: "var(--series-2)" }} /> {bName}</span>
    </div>
  );

  return (
    <Frame
      label={label}
      legend={legend}
      readout={shown ? `${shown.label} · ${aName} ${format(shown.a)} · ${bName} ${format(shown.b)}` : null}
      hint="Tap a month for its numbers"
    >
      <text x={PAD.left - 6} y={PAD.top + 4} className="chart-tick" textAnchor="end">{format(max)}</text>
      <line x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} className="chart-axis" />
      {groups.map((g, i) => {
        const x = PAD.left + i * slot + (slot - (bw * 2 + 2)) / 2;
        return (
          <g key={`${g.label}-${i}`} className={i === active ? "is-active" : undefined}>
            <path data-bar d={barPath(x, sy(g.a), bw, base - sy(g.a))} className="chart-bar" style={{ fill: "var(--series-1)" }} />
            <path data-bar d={barPath(x + bw + 2, sy(g.b), bw, base - sy(g.b))} className="chart-bar" style={{ fill: "var(--series-2)" }} />
            {i % every === 0 && <text x={x + bw + 1} y={H - 6} className="chart-tick" textAnchor="middle">{g.label}</text>}
            <rect data-hit x={PAD.left + i * slot} y={PAD.top} width={slot} height={PLOT_H} className="chart-hit" onClick={() => setActive(i)} onPointerEnter={() => setActive(i)}>
              <title>{`${g.label}: ${aName} ${format(g.a)}, ${bName} ${format(g.b)}`}</title>
            </rect>
          </g>
        );
      })}
    </Frame>
  );
}
