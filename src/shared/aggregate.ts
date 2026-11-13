import type { Row } from "./schema";
import { addDays, addMonths, daysBetween, monthKey, monthRange, weekRange } from "./dates";

export type PeriodKind = "week" | "month" | "custom";
export type Period = { kind: PeriodKind; start: string; end: string };

export function periodFor(kind: "week" | "month", today: string): Period {
  return { kind, ...(kind === "week" ? weekRange(today) : monthRange(monthKey(today))) };
}

export function shiftPeriod(p: Period, dir: -1 | 1): Period {
  if (p.kind === "week") return { kind: "week", ...weekRange(addDays(p.start, 7 * dir)) };
  if (p.kind === "month") return { kind: "month", ...monthRange(addMonths(monthKey(p.start), dir)) };
  const length = daysBetween(p.start, p.end) + 1;
  return { kind: "custom", start: addDays(p.start, length * dir), end: addDays(p.end, length * dir) };
}

export const inPeriod = (r: Row, p: Period) => typeof r.Date === "string" && r.Date >= p.start && r.Date <= p.end;

export type Summary = {
  spent: number;
  income: number;
  net: number;
  perDay: number;
  byCategory: { category: string; amount: number; share: number }[];
};

export function summarize(txs: Row[], p: Period, today: string): Summary {
  let spent = 0;
  let income = 0;
  const byCat = new Map<string, number>();
  for (const t of txs) {
    if (!inPeriod(t, p)) continue;
    const amount = Number(t.Amount) || 0;
    if (t.Type === "income") income += amount;
    else if (t.Type === "expense") {
      spent += amount;
      const c = String(t.Category ?? "Uncategorised");
      byCat.set(c, (byCat.get(c) ?? 0) + amount);
    }
  }
  const lastDay = today < p.end ? today : p.end;
  const days = today < p.start ? 0 : daysBetween(p.start, lastDay) + 1;
  return {
    spent,
    income,
    net: income - spent,
    perDay: days > 0 ? Math.round(spent / days) : 0,
    byCategory: [...byCat]
      .map(([category, amount]) => ({ category, amount, share: spent ? amount / spent : 0 }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function groupByDay(txs: Row[]): { date: string; items: Row[] }[] {
  const groups = new Map<string, Row[]>();
  for (const t of txs) {
    const d = String(t.Date ?? "");
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(t);
  }
  return [...groups]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => ({ date, items: [...items].sort((x, y) => String(y.CreatedAt ?? "").localeCompare(String(x.CreatedAt ?? ""))) }));
}
