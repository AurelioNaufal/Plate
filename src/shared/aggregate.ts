import type { Row } from "./schema";
import { addDays, addMonths, daysBetween, monthKey, monthRange, weekRange } from "./dates";

export type PeriodKind = "week" | "month" | "year" | "all" | "custom";
export type Period = { kind: PeriodKind; start: string; end: string };

const yearRange = (year: number) => ({ start: `${year}-01-01`, end: `${year}-12-31` });

/** The period of that kind holding today. "all" runs from the earliest transaction to today. */
export function periodFor(kind: "week" | "month" | "year" | "all", today: string, txs: Row[] = []): Period {
  if (kind === "week") return { kind, ...weekRange(today) };
  if (kind === "month") return { kind, ...monthRange(monthKey(today)) };
  if (kind === "year") return { kind, ...yearRange(Number(today.slice(0, 4))) };
  let start = today;
  for (const t of txs) if (typeof t.Date === "string" && t.Date && t.Date < start) start = t.Date;
  return { kind, start, end: today };
}

export function shiftPeriod(p: Period, dir: -1 | 1): Period {
  if (p.kind === "all") return p;
  if (p.kind === "year") return { kind: "year", ...yearRange(Number(p.start.slice(0, 4)) + dir) };
  if (p.kind === "week") return { kind: "week", ...weekRange(addDays(p.start, 7 * dir)) };
  if (p.kind === "month") return { kind: "month", ...monthRange(addMonths(monthKey(p.start), dir)) };
  const length = daysBetween(p.start, p.end) + 1;
  return { kind: "custom", start: addDays(p.start, length * dir), end: addDays(p.end, length * dir) };
}

export const inPeriod = (r: Row, p: Period) => typeof r.Date === "string" && r.Date >= p.start && r.Date <= p.end;

export type CategoryTotal = { category: string; amount: number; count: number; share: number };

export type Summary = {
  spent: number;
  income: number;
  net: number;
  perDay: number;
  spentCount: number;
  incomeCount: number;
  byCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  top: { category: string; amount: number } | null;
  /** Net ÷ income; null when there was no income. */
  savingsRate: number | null;
};

const categoryOf = (t: Row) => String(t.Category ?? "Uncategorised") || "Uncategorised";

function totals(map: Map<string, { amount: number; count: number }>, sum: number): CategoryTotal[] {
  return [...map]
    .map(([category, { amount, count }]) => ({ category, amount, count, share: sum ? amount / sum : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export function summarize(txs: Row[], p: Period, today: string): Summary {
  let spent = 0;
  let income = 0;
  let spentCount = 0;
  let incomeCount = 0;
  const byCat = new Map<string, { amount: number; count: number }>();
  const byIncome = new Map<string, { amount: number; count: number }>();
  const add = (map: typeof byCat, c: string, amount: number) => {
    const cur = map.get(c) ?? { amount: 0, count: 0 };
    map.set(c, { amount: cur.amount + amount, count: cur.count + 1 });
  };
  for (const t of txs) {
    if (!inPeriod(t, p)) continue;
    const amount = Number(t.Amount) || 0;
    if (t.Type === "income") {
      income += amount;
      incomeCount++;
      add(byIncome, categoryOf(t), amount);
    } else if (t.Type === "expense") {
      spent += amount;
      spentCount++;
      add(byCat, categoryOf(t), amount);
    }
  }
  const lastDay = today < p.end ? today : p.end;
  const days = today < p.start ? 0 : daysBetween(p.start, lastDay) + 1;
  const byCategory = totals(byCat, spent);
  return {
    spent,
    income,
    net: income - spent,
    perDay: days > 0 ? Math.round(spent / days) : 0,
    spentCount,
    incomeCount,
    byCategory,
    incomeByCategory: totals(byIncome, income),
    top: byCategory[0] ? { category: byCategory[0].category, amount: byCategory[0].amount } : null,
    savingsRate: income ? (income - spent) / income : null,
  };
}

/** The months from start's month to end's month, oldest first. */
function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let m = monthKey(start); m <= monthKey(end); m = addMonths(m, 1)) out.push(m);
  return out;
}

/** The months a by-month view covers: Year and All show their own; any other period, the 12 months up to its end. */
export function cashFlowRange(p: Period): { start: string; end: string } {
  if (p.kind === "year" || p.kind === "all") return { start: p.start, end: p.end };
  const last = monthKey(p.end);
  return { start: monthRange(addMonths(last, -11)).start, end: monthRange(last).end };
}

export type MonthFlow = { month: string; income: number; spent: number; net: number; savingsRate: number | null };

/** Income and spending per month in [start, end], empty months included, oldest first. */
export function monthlyCashFlow(txs: Row[], start: string, end: string): MonthFlow[] {
  const flows = new Map(monthsBetween(start, end).map((m) => [m, { income: 0, spent: 0 }]));
  for (const t of txs) {
    if (typeof t.Date !== "string" || t.Date < start || t.Date > end) continue;
    const f = flows.get(monthKey(t.Date));
    if (!f) continue;
    const amount = Number(t.Amount) || 0;
    if (t.Type === "income") f.income += amount;
    else if (t.Type === "expense") f.spent += amount;
  }
  return [...flows].map(([month, { income, spent }]) => ({
    month, income, spent, net: income - spent, savingsRate: income ? (income - spent) / income : null,
  }));
}

export type CategoryMonth = { month: string; amount: number; count: number; share: number };

/** One expense category's spending per month in [start, end]; share is that month's part of the category total. */
export function categoryByMonth(txs: Row[], category: string, start: string, end: string): CategoryMonth[] {
  const months = new Map(monthsBetween(start, end).map((m) => [m, { amount: 0, count: 0 }]));
  let total = 0;
  for (const t of txs) {
    if (t.Type !== "expense" || categoryOf(t) !== category) continue;
    if (typeof t.Date !== "string" || t.Date < start || t.Date > end) continue;
    const m = months.get(monthKey(t.Date));
    if (!m) continue;
    const amount = Number(t.Amount) || 0;
    m.amount += amount;
    m.count++;
    total += amount;
  }
  return [...months].map(([month, { amount, count }]) => ({ month, amount, count, share: total ? amount / total : 0 }));
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
