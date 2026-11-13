import type { Summary } from "../../shared/aggregate";
import { formatNT } from "../../shared/money";

// Distinct in lightness as well as hue, in both themes.
const COLORS = ["var(--accent)", "var(--kcal)", "var(--ink)", "#8FB0EB", "#E7A774", "var(--muted)"];

export function CategoryBreakdown({ byCategory }: { byCategory: Summary["byCategory"] }) {
  if (byCategory.length === 0) return <p className="muted small" style={{ margin: 0 }}>No spending in this period.</p>;
  const top = byCategory.slice(0, COLORS.length - 1);
  const rest = byCategory.slice(COLORS.length - 1);
  const shown = rest.length
    ? [...top, { category: `Other (${rest.length})`, amount: rest.reduce((s, c) => s + c.amount, 0), share: rest.reduce((s, c) => s + c.share, 0) }]
    : top;

  return (
    <>
      <div className="bar" aria-hidden="true">
        {shown.map((c, i) => (
          <span key={c.category} style={{ width: `${c.share * 100}%`, background: COLORS[i] }} />
        ))}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
        {shown.map((c, i) => (
          <li key={c.category} className="row-between">
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="swatch" style={{ background: COLORS[i] }} />
              {c.category}
            </span>
            <span>
              <b>{formatNT(c.amount)}</b> <span className="muted">· {Math.round(c.share * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
