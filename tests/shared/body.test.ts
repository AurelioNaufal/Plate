import { dailyWeights, weightTrend, profileFrom, bmi, maintenanceKcal, targetSuggestion, weekTrendChange } from "../../src/shared/body";
import type { Row } from "../../src/shared/schema";

const b = (Date: string, WeightKg: number | null, ID = Date): Row => ({ ID, Date, WeightKg, BodyFatPct: null, WaistCm: null, ArmCm: null });

test("dailyWeights keeps the latest weigh-in per day and skips blanks", () => {
  const rows = [b("2026-11-16", 60.4, "a"), b("2026-11-15", 61), b("2026-11-16", 60.1, "b"), b("2026-11-17", null)];
  expect(dailyWeights(rows)).toEqual([{ date: "2026-11-15", kg: 61 }, { date: "2026-11-16", kg: 60.1 }]);
});

describe("weightTrend", () => {
  test("is the mean of the last 7 days at each weigh-in", () => {
    const t = weightTrend([{ date: "2026-11-15", kg: 60 }, { date: "2026-11-16", kg: 61 }, { date: "2026-11-17", kg: 62 }]);
    expect(t.map((p) => p.kg)).toEqual([60, 60.5, 61]);
  });
  test("after a long gap only the last 7 days count", () => {
    const t = weightTrend([{ date: "2026-10-20", kg: 62 }, { date: "2026-11-15", kg: 58 }]);
    expect(t.at(-1)).toEqual({ date: "2026-11-15", kg: 58 });
  });
  test("one weigh-in is its own trend; none is empty", () => {
    expect(weightTrend([{ date: "2026-11-15", kg: 60.2 }])).toEqual([{ date: "2026-11-15", kg: 60.2 }]);
    expect(weightTrend([])).toEqual([]);
  });
});

const profile = (sex: string, extra: Row[] = []): Row[] => [
  { ID: "heightCm", Value: "170" }, { ID: "age", Value: "22" }, { ID: "sex", Value: sex }, ...extra,
];

test("profileFrom reads height, age and sex; anything odd is blank", () => {
  expect(profileFrom(profile("male"))).toEqual({ heightCm: 170, age: 22, sex: "male" });
  expect(profileFrom([{ ID: "heightCm", Value: "tall" }, { ID: "sex", Value: "x" }])).toEqual({ heightCm: null, age: null, sex: null });
});

test("bmi uses Taiwan's adult ranges", () => {
  expect(bmi(60, 170)).toEqual({ value: 20.8, label: "Healthy" });
  expect(bmi(75, 170)).toEqual({ value: 26, label: "Overweight" });
  expect(bmi(50, 170)).toEqual({ value: 17.3, label: "Underweight" });
  expect(bmi(80, 170)).toEqual({ value: 27.7, label: "Obese" });
  expect(bmi(60, null)).toBeNull();
});

test("maintenanceKcal is Mifflin-St Jeor × 1.55, to the nearest 50", () => {
  expect(maintenanceKcal(profileFrom(profile("male")), 60)).toBe(2400);
  expect(maintenanceKcal(profileFrom(profile("female")), 60)).toBe(2150);
  expect(maintenanceKcal({ heightCm: 170, age: null, sex: "male" }, 60)).toBeNull();
});

describe("targetSuggestion", () => {
  test("offers a calorie target when none is set", () => {
    expect(targetSuggestion(profile("male", [{ ID: "proteinTarget", Value: "120" }]), 60)).toEqual({ protein: 120, kcal: 2400 });
  });
  test("is quiet when the targets already match", () => {
    expect(targetSuggestion(profile("male", [{ ID: "proteinTarget", Value: "120" }, { ID: "kcalTarget", Value: "2400" }]), 60)).toBeNull();
  });
  test("is quiet for a pair the owner said not now to", () => {
    expect(targetSuggestion(profile("male", [{ ID: "targetSuggestionDismissed", Value: "120|2400" }]), 60)).toBeNull();
  });
  test("follows the weight trend: protein at 2 g/kg, to the nearest 5", () => {
    expect(targetSuggestion(profile("male", [{ ID: "kcalTarget", Value: "2400" }]), 63)).toEqual({ protein: 125, kcal: 2450 });
  });
  test("without a profile it can still suggest protein", () => {
    expect(targetSuggestion([], 63)).toEqual({ protein: 125, kcal: null });
    expect(targetSuggestion([], 60)).toBeNull();
    expect(targetSuggestion([], null)).toBeNull();
  });
});

test("weekTrendChange compares the trend at the end of the week with the week before", () => {
  const trend = [{ date: "2026-11-14", kg: 60.5 }, { date: "2026-11-19", kg: 60.3 }, { date: "2026-11-21", kg: 60.1 }];
  expect(weekTrendChange(trend, "2026-11-15")).toBe(-0.4);
  expect(weekTrendChange(trend, "2026-11-08")).toBeNull();
});
