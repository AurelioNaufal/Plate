import { weeklyReview } from "../../src/shared/review";
import { weekTrendChange } from "../../src/shared/body";
import type { Row } from "../../src/shared/schema";

// Made-up weeks: Sun Nov 15 – Sat Nov 21 2026, and the week before.
const tx = (ID: string, Date: string, Amount: number, Category: string, Type = "expense"): Row => ({ ID, Type, Date, Amount, Category, Description: ID });
const meal = (ID: string, Date: string, Name: string, Protein: number | null, Kcal: number | null, TransactionID: string | null = null): Row => ({
  ID, Date, Name, Protein, Kcal, TransactionID, InBudget: !!TransactionID,
});
const set = (ID: string, SessionID: string, Date: string): Row => ({ ID, SessionID, Date, ExerciseID: "bench", SetNumber: 1, WeightKg: 40, Reps: 10, Done: true });

const rows = {
  Transactions: [
    tx("t1", "2026-11-15", 800, "Food"),
    tx("t2", "2026-11-16", 200, "Utilities"),
    tx("t3", "2026-11-17", 155, "Food"),
    tx("t4", "2026-11-18", 40, "Health"),
    tx("t5", "2026-11-19", 5000, "Part-Time Jobs", "income"),
    tx("p1", "2026-11-10", 1000, "Food"),
    tx("m1t", "2026-11-16", 70, "Food"),
    tx("m2t", "2026-11-17", 49, "Food"),
    tx("m3t", "2026-11-18", 35, "Food"),
  ],
  Meals: [
    meal("m1", "2026-11-16", "Chicken rice", 32, 650, "m1t"),
    meal("m2", "2026-11-17", "Roti + milk", 14, 450, "m2t"),
    meal("m3", "2026-11-18", "Onigiri", 6, 200, "m3t"),
    meal("h1", "2026-11-16", "Home eggs", 98, 900),
    meal("h2", "2026-11-17", "Home dinner", 76, 1000),
    meal("h3", "2026-11-18", "Snack", null, null),
  ],
  Workouts: [set("w1", "s1", "2026-11-16"), set("w2", "s1", "2026-11-16"), set("w3", "s2", "2026-11-19"), set("w4", "s0", "2026-11-12")],
  Body: [
    { ID: "b1", Date: "2026-11-14", WeightKg: 60.5 },
    { ID: "b2", Date: "2026-11-21", WeightKg: 59.7 },
  ] as Row[],
  Settings: [{ ID: "proteinTarget", Value: "120" }] as Row[],
};

const r = weeklyReview(rows, "2026-11-15");

test("spending against the week before, with the top 3 categories", () => {
  // 800 + 200 + 155 + 40 + three paid meals (154) = 1349; the week before had 1000.
  expect(r.spent).toBe(1349);
  expect(r.spentPrev).toBe(1000);
  expect(r.change).toBe(349);
  expect(r.topCategories).toEqual([
    { category: "Food", amount: 1109 },
    { category: "Utilities", amount: 200 },
    { category: "Health", amount: 40 },
  ]);
});

test("protein and calories average over tracked days; target days count", () => {
  // Nov 16: 130 g, Nov 17: 90 g, Nov 18: 6 g... the snack is blank, the onigiri counts.
  expect(r.trackedDays).toBe(3);
  expect(r.avgProtein).toBe(75.3);
  expect(r.proteinDays).toBe(1);
  expect(r.avgKcal).toBe(1067);
});

test("a week with no tracked food has no averages", () => {
  const empty = weeklyReview({ ...rows, Meals: [] }, "2026-11-15");
  expect(empty).toMatchObject({ avgProtein: null, avgKcal: null, trackedDays: 0, proteinDays: 0 });
});

test("workouts are sessions that week", () => {
  expect(r.workouts).toBe(2);
});

test("weight trend change across the week", () => {
  expect(r.weightChange).toBe(-0.8);
});

test("best protein value: the week's paid meals, highest first", () => {
  expect(r.bestValue).toEqual([
    { name: "Chicken rice", value: 4.6 },
    { name: "Roti + milk", value: 2.9 },
    { name: "Onigiri", value: 1.7 },
  ]);
});

test("a week with no weigh-ins has no weight change, not 0", () => {
  const trend = [{ date: "2026-11-07", kg: 60.5 }, { date: "2026-11-21", kg: 60.1 }];
  expect(weekTrendChange(trend, "2026-11-08")).toBeNull();
  expect(weekTrendChange(trend, "2026-11-15")).toBe(-0.4);
});

test("the first week of weigh-ins shows the trend, and a long gap says since when", () => {
  const first = weeklyReview({ ...rows, Body: [{ ID: "x", Date: "2026-11-18", WeightKg: 60 }] }, "2026-11-15");
  expect(first).toMatchObject({ weightChange: null, weightNow: 60 });
  const gap = weeklyReview({ ...rows, Body: [{ ID: "o", Date: "2026-10-04", WeightKg: 61 }, { ID: "n", Date: "2026-11-20", WeightKg: 60 }] }, "2026-11-15");
  expect(gap).toMatchObject({ weightChange: -1, weightSince: "2026-10-04" });
  expect(r.weightSince).toBeNull();
});

test("best value lists a food once whatever its capitals", () => {
  const meals = [...rows.Meals, meal("m4", "2026-11-19", "chicken rice", 30, 600, "m1t")];
  expect(weeklyReview({ ...rows, Meals: meals }, "2026-11-15").bestValue.map((b) => b.name)).toEqual(["Chicken rice", "Roti + milk", "Onigiri"]);
});
