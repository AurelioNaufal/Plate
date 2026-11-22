import type { CategoryTotal } from "../../shared/aggregate";
import { formatNT } from "../../shared/money";
import { formatPct } from "../format";

// Distinct in lightness as well as hue, in both themes. The last one is "Other".
const COLORS = ["var(--accent)", "var(--kcal)", "var(--ink)", "#8FB0EB", "#E7A774", "var(--muted)"];
const OTHER = COLORS.length - 1;

const entries = (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`;
export { entries as entryCount };

type Props = { byCategory: CategoryTotal[]; onOpen?(category: string): void };

/** A stacked share bar plus one row per category; the sixth and later share the "Other" colour. */
export function CategoryBreakdown({ byCategory, onOpen }: Props) {
  if (byCategory.length === 0) return <p className="muted small" style={{ margin: 0 }}>No spending in this period.</p>;
  const top = byCategory.slice(0, OTHER);
  const rest = byCategory.slice(OTHER);
  const segments = rest.length ? [...top, { category: "Other", share: rest.reduce((s, c) => s + c.share, 0) }] : top;
  const color = (i: number) => COLORS[Math.min(i, OTHER)];

  return (
    <>
      <div className="bar" aria-hidden="true">
        {segments.map((c, i) => (
          <span key={c.category} style={{ width: `${c.share * 100}%`, background: color(i) }} />
        ))}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {byCategory.map((c, i) => (
          <li key={c.category}>
            <button className="list-row" style={{ minHeight: 48 }} onClick={() => onOpen?.(c.category)}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span className="swatch" style={{ background: color(i), flexShrink: 0 }} />
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.category}</span>
                  <span className="small muted">{entries(c.count)}</span>
                </span>
              </span>
              <span style={{ fontSize: 14, whiteSpace: "nowrap" }}>
                <b>{formatNT(c.amount)}</b> <span className="muted">· {formatPct(c.share)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
