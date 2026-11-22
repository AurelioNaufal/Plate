import { summarize, shiftPeriod, groupByDay, periodFor, monthlyCashFlow, categoryByMonth, type Period } from "../../src/shared/aggregate";
import type { Row } from "../../src/shared/schema";
import { weekRange } from "../../src/shared/dates";
import { realWeek } from "../fixtures/week";

const today = "2026-11-12";
const week: Period = { kind: "week", ...weekRange(today) };

describe("summarize the owner's week (Nov 8–14, today Nov 12)", () => {
  const s = summarize(realWeek, week, today);

  test("spent excludes income and other weeks", () => {
    expect(s.spent).toBe(1195);
  });
  test("income is counted separately, and net is income minus spent", () => {
    expect(s.income).toBe(5000);
    expect(s.net).toBe(5000 - 1195);
  });
  test("per day divides by the days elapsed so far (5)", () => {
    expect(s.perDay).toBe(239);
  });
  test("categories are sorted by amount with their share", () => {
    expect(s.byCategory[0].category).toBe("Food");
    expect(s.byCategory[0].amount).toBe(955);
    expect(s.byCategory[0].share).toBeCloseTo(0.799, 3);
    expect(s.byCategory.find((c) => c.category === "Utilities")?.amount).toBe(200);
    expect(s.byCategory.find((c) => c.category === "Health")?.amount).toBe(40);
  });
});

test("a period that hasn't started has 0 per day", () => {
  const next = shiftPeriod(week, 1);
  expect(summarize(realWeek, next, today).perDay).toBe(0);
});

test("shifting a week back gives the previous Sun–Sat", () => {
  expect(shiftPeriod(week, -1)).toEqual({ kind: "week", start: "2026-11-01", end: "2026-11-07" });
});

test("shifting a month moves by calendar month", () => {
  expect(shiftPeriod({ kind: "month", start: "2026-11-01", end: "2026-11-30" }, -1)).toEqual({ kind: "month", start: "2026-10-01", end: "2026-10-31" });
});

test("shifting a custom range moves by its own length", () => {
  expect(shiftPeriod({ kind: "custom", start: "2026-11-01", end: "2026-11-10" }, 1)).toEqual({ kind: "custom", start: "2026-11-11", end: "2026-11-20" });
});

test("periodFor builds the current week and month", () => {
  expect(periodFor("week", today)).toEqual(week);
  expect(periodFor("month", today)).toEqual({ kind: "month", start: "2026-11-01", end: "2026-11-30" });
});

test("groupByDay lists newest day first", () => {
  const groups = groupByDay(realWeek);
  expect(groups[0].date).toBe("2026-11-12");
  expect(groups[0].items).toHaveLength(1);
  expect(groups.at(-1)?.date).toBe("2026-11-01");
});

describe("analytics (Plan 3)", () => {
  const s = summarize(realWeek, week, today);
  const tx = (ID: string, Type: string, Date: string, Amount: number, Category: string): Row => ({ ID, Type, Date, Amount, Category, Description: "x" });
  const months: Row[] = [
    tx("m1", "expense", "2026-09-03", 300, "Food"),
    tx("m2", "expense", "2026-09-20", 100, "Utilities"),
    tx("m3", "income", "2026-09-10", 1000, "Part-Time Jobs"),
    tx("m4", "expense", "2026-11-02", 100, "Food"),
    tx("m5", "income", "2026-11-05", 500, "Part-Time Jobs"),
  ];

  test("counts transactions, overall and per category", () => {
    expect(s.spentCount).toBe(17);
    expect(s.incomeCount).toBe(1);
    expect(s.byCategory[0].count).toBe(14);
  });
  test("income is broken down by category too", () => {
    expect(s.incomeByCategory).toEqual([{ category: "Part-Time Jobs", amount: 5000, count: 1, share: 1 }]);
  });
  test("top is the biggest category", () => {
    expect(s.top).toEqual({ category: "Food", amount: 955 });
    expect(summarize([], week, today).top).toBeNull();
  });
  test("savings rate is net over income; none without income", () => {
    expect(s.savingsRate).toBeCloseTo(0.761, 3);
    expect(summarize(realWeek.filter((r) => r.Type !== "income"), week, today).savingsRate).toBeNull();
  });
  test("a year runs Jan 1 to Dec 31 and steps a year at a time", () => {
    const y = periodFor("year", "2026-11-22");
    expect(y).toEqual({ kind: "year", start: "2026-01-01", end: "2026-12-31" });
    expect(shiftPeriod(y, -1)).toEqual({ kind: "year", start: "2025-01-01", end: "2025-12-31" });
  });
  test("all time starts at the earliest row and ends today", () => {
    const a = periodFor("all", "2026-11-22", months);
    expect(a).toEqual({ kind: "all", start: "2026-09-03", end: "2026-11-22" });
    expect(shiftPeriod(a, 1)).toEqual(a);
    expect(periodFor("all", "2026-11-22", [])).toEqual({ kind: "all", start: "2026-11-22", end: "2026-11-22" });
  });
  test("monthlyCashFlow has every month, empty ones as zeros, oldest first", () => {
    expect(monthlyCashFlow(months, "2026-09-01", "2026-11-30")).toEqual([
      { month: "2026-09", income: 1000, spent: 400, net: 600, savingsRate: 0.6 },
      { month: "2026-10", income: 0, spent: 0, net: 0, savingsRate: null },
      { month: "2026-11", income: 500, spent: 100, net: 400, savingsRate: 0.8 },
    ]);
  });
  test("categoryByMonth shares add up to 1", () => {
    const c = categoryByMonth(months, "Food", "2026-09-01", "2026-11-30");
    expect(c.map((m) => [m.month, m.amount, m.count])).toEqual([["2026-09", 300, 1], ["2026-10", 0, 0], ["2026-11", 100, 1]]);
    expect(c.reduce((a, m) => a + m.share, 0)).toBeCloseTo(1, 6);
  });
});
