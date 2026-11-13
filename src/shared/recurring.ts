// Recurring charges (gym, laundry, rent…). Weekly items fall on one weekday
// (0 = Sunday); monthly items on one day of the month, moved to the last day
// in months that are too short. ChargedThrough marks the last day the server
// has charged, so a charge the owner deletes is never created again.
import type { Row } from "./schema";
import { addDays, lastDayOfMonth, monthKey, addMonths, weekday } from "./dates";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isWhole = (v: unknown, min: number, max = Infinity) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** "weekly" | "monthly" in any case (the Sheet may say "Weekly"), else null. */
export function frequencyOf(item: Row): "weekly" | "monthly" | null {
  const f = String(item.Frequency ?? "").trim().toLowerCase();
  return f === "weekly" || f === "monthly" ? f : null;
}

/**
 * What's wrong with an item, or null if it can be charged. App saves are
 * refused with this message; rows typed into the Sheet with a problem are
 * skipped (and flagged on the Recurring screen) instead of breaking the run.
 */
export function recurringProblem(item: Row): string | null {
  if (typeof item.Name !== "string" || !item.Name.trim()) return "Name is required";
  if (!isWhole(item.Amount, 1)) return "Amount must be a whole number above 0";
  const f = frequencyOf(item);
  if (!f) return "Frequency must be weekly or monthly";
  if (f === "weekly" && !isWhole(item.Weekday, 0, 6)) return "Weekday must be 0 (Sunday) to 6 (Saturday)";
  if (f === "monthly" && !isWhole(item.MonthDay, 1, 31)) return "MonthDay must be 1 to 31";
  if (!isDate(item.StartDate) || !validDay(item.StartDate)) return "StartDate must be YYYY-MM-DD";
  return null;
}

function validDay(d: string): boolean {
  const day = Number(d.slice(8, 10));
  const month = Number(d.slice(5, 7));
  return month >= 1 && month <= 12 && day >= 1 && day <= lastDayOfMonth(d.slice(0, 7));
}

/** Due dates in [from, to], inclusive. Ignores Active. */
export function dueDates(item: Row, from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  const frequency = frequencyOf(item);
  if (frequency === "weekly") {
    const wd = Number(item.Weekday);
    let d = addDays(from, (wd - weekday(from) + 7) % 7);
    for (; d <= to; d = addDays(d, 7)) out.push(d);
  } else if (frequency === "monthly") {
    const day = Number(item.MonthDay);
    for (let m = monthKey(from); m <= monthKey(to); m = addMonths(m, 1)) {
      const d = `${m}-${String(Math.min(day, lastDayOfMonth(m))).padStart(2, "0")}`;
      if (d >= from && d <= to) out.push(d);
    }
  }
  return out;
}

/** The first date that may still be charged: the latest of StartDate, ActiveSince and the day after ChargedThrough. */
export function windowStart(item: Row): string {
  const candidates = [String(item.StartDate)];
  if (isDate(item.ActiveSince)) candidates.push(item.ActiveSince);
  if (isDate(item.ChargedThrough)) candidates.push(addDays(item.ChargedThrough, 1));
  return candidates.reduce((a, b) => (b > a ? b : a));
}

/** Charges coming up for switched-on items, today through today + days. */
export function upcomingCharges(items: Row[], today: string, days = 7): { item: Row; date: string }[] {
  const end = addDays(today, days);
  const out: { item: Row; date: string }[] = [];
  for (const item of items) {
    if (item.Active !== true || recurringProblem(item)) continue;
    const start = windowStart(item);
    for (const date of dueDates(item, start > today ? start : today, end)) out.push({ item, date });
  }
  return out.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : String(a.item.Name).localeCompare(String(b.item.Name))));
}

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

export function describeSchedule(item: Row): string {
  if (frequencyOf(item) === "weekly") return `Every ${WEEKDAYS[Number(item.Weekday)] ?? "week"}`;
  const day = Number(item.MonthDay);
  return `Monthly on the ${ordinal(day)}${day >= 29 ? " (last day in short months)" : ""}`;
}
