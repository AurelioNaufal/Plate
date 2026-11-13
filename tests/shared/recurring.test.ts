import { dueDates, windowStart, upcomingCharges, describeSchedule, recurringProblem } from "../../src/shared/recurring";
import type { Row } from "../../src/shared/schema";

export const gym: Row = { ID: "r1", Name: "Gym", Amount: 40, Category: "Health", Frequency: "weekly", Weekday: 0, MonthDay: null, Active: true, StartDate: "2026-11-15", ActiveSince: null, ChargedThrough: null };
const laundry: Row = { ...gym, ID: "r2", Name: "Laundry", Amount: 20, Category: "Utilities" };
const monthly = (day: number): Row => ({ ...gym, ID: "r3", Name: "Phone", Frequency: "monthly", Weekday: null, MonthDay: day, StartDate: "2026-01-01" });

describe("dueDates", () => {
  test("weekly: every Sunday in the range", () => {
    expect(dueDates(gym, "2026-11-15", "2026-11-30")).toEqual(["2026-11-15", "2026-11-22", "2026-11-29"]);
  });
  test("monthly on the 31st falls on the last day of short months", () => {
    expect(dueDates(monthly(31), "2026-11-01", "2027-03-31")).toEqual(["2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31"]);
  });
  test("monthly on the 29th is the 28th in February 2027", () => {
    expect(dueDates(monthly(29), "2027-02-01", "2027-02-28")).toEqual(["2027-02-28"]);
  });
  test("an empty range gives nothing", () => {
    expect(dueDates(gym, "2026-11-16", "2026-11-15")).toEqual([]);
  });
});

test("windowStart is the latest of StartDate, ActiveSince and the day after ChargedThrough", () => {
  expect(windowStart(gym)).toBe("2026-11-15");
  expect(windowStart({ ...gym, ActiveSince: "2026-11-25" })).toBe("2026-11-25");
  expect(windowStart({ ...gym, ActiveSince: "2026-11-25", ChargedThrough: "2026-11-29" })).toBe("2026-11-30");
  expect(windowStart({ ...gym, StartDate: "2026-12-01", ChargedThrough: "2026-11-29" })).toBe("2026-12-01");
});

describe("upcomingCharges", () => {
  test("lists the next 7 days, sorted by date then name", () => {
    expect(upcomingCharges([laundry, gym], "2026-11-13").map((u) => [u.date, u.item.Name])).toEqual([
      ["2026-11-15", "Gym"],
      ["2026-11-15", "Laundry"],
    ]);
  });
  test("leaves out switched-off items and dates already charged", () => {
    expect(upcomingCharges([{ ...gym, Active: false }], "2026-11-13")).toEqual([]);
    expect(upcomingCharges([{ ...gym, ChargedThrough: "2026-11-15" }], "2026-11-15")).toEqual([
      { item: { ...gym, ChargedThrough: "2026-11-15" }, date: "2026-11-22" },
    ]);
  });
});

test("recurringProblem names the field a hand-typed row gets wrong", () => {
  expect(recurringProblem(gym)).toBeNull();
  expect(recurringProblem({ ...gym, Weekday: "Sun" })).toBe("Weekday must be 0 (Sunday) to 6 (Saturday)");
  expect(recurringProblem({ ...gym, Frequency: "daily" })).toBe("Frequency must be weekly or monthly");
  expect(recurringProblem({ ...gym, Frequency: "MONTHLY", MonthDay: 40 })).toBe("MonthDay must be 1 to 31");
  expect(recurringProblem({ ...gym, Amount: 40.5 })).toBe("Amount must be a whole number above 0");
  expect(recurringProblem({ ...gym, Name: "" })).toBe("Name is required");
  expect(recurringProblem({ ...gym, StartDate: "2026-02-30" })).toBe("StartDate must be YYYY-MM-DD");
});

test("upcomingCharges skips rows it can't read instead of throwing", () => {
  expect(upcomingCharges([{ ...gym, Weekday: "Sun" }, laundry], "2026-11-13").map((u) => u.item.Name)).toEqual(["Laundry"]);
});

test("describeSchedule", () => {
  expect(describeSchedule(gym)).toBe("Every Sunday");
  expect(describeSchedule(monthly(26))).toBe("Monthly on the 26th");
  expect(describeSchedule(monthly(1))).toBe("Monthly on the 1st");
  expect(describeSchedule(monthly(22))).toBe("Monthly on the 22nd");
  expect(describeSchedule(monthly(31))).toBe("Monthly on the 31st (last day in short months)");
  expect(describeSchedule(monthly(29))).toBe("Monthly on the 29th (last day in short months)");
});
