import {
  todayTaipei,
  toTaipeiDate,
  addDays,
  weekday,
  weekRange,
  monthKey,
  monthRange,
  lastDayOfMonth,
  parseSheetDate,
} from "../../src/shared/dates";

describe("todayTaipei", () => {
  test("23:30 Taipei on Nov 12 (15:30Z) is Nov 12", () => {
    expect(todayTaipei(new Date("2026-11-12T15:30:00Z"))).toBe("2026-11-12");
  });
  test("00:30 Taipei on Nov 13 (16:30Z Nov 12) is Nov 13", () => {
    expect(todayTaipei(new Date("2026-11-12T16:30:00Z"))).toBe("2026-11-13");
  });
  test("toTaipeiDate uses the same +8h rule", () => {
    expect(toTaipeiDate(new Date("2026-11-12T16:30:00Z"))).toBe("2026-11-13");
  });
});

describe("week and month ranges", () => {
  test("week of Thu Nov 12 runs Sun Nov 8 to Sat Nov 14", () => {
    expect(weekRange("2026-11-12")).toEqual({ start: "2026-11-08", end: "2026-11-14" });
  });
  test("a Sunday starts its own week", () => {
    expect(weekRange("2026-11-08").start).toBe("2026-11-08");
  });
  test("weekday of Sun Nov 15 is 0", () => {
    expect(weekday("2026-11-15")).toBe(0);
  });
  test("last day of month handles leap years", () => {
    expect(lastDayOfMonth("2026-02")).toBe(28);
    expect(lastDayOfMonth("2028-02")).toBe(29);
  });
  test("monthRange covers the whole month", () => {
    expect(monthRange("2026-11")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });
  test("monthKey takes year and month", () => {
    expect(monthKey("2026-11-12")).toBe("2026-11");
  });
  test("addDays rolls over the year", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-08", -1)).toBe("2026-11-07");
  });
});

describe("parseSheetDate", () => {
  test("parses M/D/YYYY", () => {
    expect(parseSheetDate("8/26/2025")).toBe("2025-08-26");
    expect(parseSheetDate("1/7/2025")).toBe("2025-01-07");
  });
  test("passes through ISO dates", () => {
    expect(parseSheetDate("2026-11-12")).toBe("2026-11-12");
  });
  test("rejects impossible or empty dates", () => {
    expect(parseSheetDate("13/40/2025")).toBeNull();
    expect(parseSheetDate("2/30/2026")).toBeNull();
    expect(parseSheetDate("")).toBeNull();
    expect(parseSheetDate("soon")).toBeNull();
  });
});
