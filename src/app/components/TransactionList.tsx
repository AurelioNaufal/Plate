import { groupByDay } from "../../shared/aggregate";
import { formatNT } from "../../shared/money";
import { proteinValueText } from "../../shared/meals";
import type { Row } from "../../shared/schema";
import { formatDay, formatPct } from "../format";

type Props = {
  transactions: Row[];
  pendingIds: Set<string>;
  mealsById?: Map<string, Row>;
  /** Each row's part of the list's total, shown as a percent; null hides it. */
  shareOf?(t: Row): number | null;
  onOpen(id: string): void;
};

/** "· 32 g · 650 kcal · 4.6 g per NT$10" for a paid meal; blank values are left out. */
function nutritionLine(meal: Row | undefined, price: unknown): string {
  if (!meal) return "";
  const parts: string[] = [];
  if (typeof meal.Protein === "number") parts.push(`${meal.Protein} g`);
  if (typeof meal.Kcal === "number") parts.push(`${meal.Kcal} kcal`);
  const value = proteinValueText(meal.Protein, price);
  if (value) parts.push(value);
  return parts.map((p) => `· ${p}`).join(" ");
}

export function TransactionList({ transactions, pendingIds, mealsById, shareOf, onOpen }: Props) {
  if (transactions.length === 0) return <p className="muted small" style={{ margin: 0 }}>No transactions here yet.</p>;
  return (
    <ul aria-label="Transactions" className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {groupByDay(transactions).map((g) => (
        <li key={g.date}>
          <div className="day-label">{formatDay(g.date)}</div>
          {g.items.map((t) => (
            <button key={String(t.ID)} className="list-row" onClick={() => onOpen(String(t.ID))}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{t.Description || t.Category}</span>
                <span className="small muted" style={{ display: "flex", flexWrap: "wrap", columnGap: 6, alignItems: "center" }}>
                  {t.Category}
                  {t.MealID && mealsById && <span>{nutritionLine(mealsById.get(String(t.MealID)), Number(t.Amount))}</span>}
                  {t.Source === "recurring" && <span className="tag">auto</span>}
                  {pendingIds.has(String(t.ID)) && <span className="tag">saving…</span>}
                  {shareOf && shareOf(t) !== null && <span>{formatPct(shareOf(t)!)}</span>}
                </span>
              </span>
              <b style={{ fontSize: 14, color: t.Type === "income" ? "var(--accent)" : undefined }}>
                {t.Type === "income" ? "+" : ""}
                {formatNT(Number(t.Amount))}
              </b>
            </button>
          ))}
        </li>
      ))}
    </ul>
  );
}
