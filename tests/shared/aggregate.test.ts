import { summarize, shiftPeriod, groupByDay, periodFor, type Period } from "../../src/shared/aggregate";
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
