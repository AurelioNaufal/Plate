// Recurring charges (gym, laundry, rent…). Weekly items fall on one weekday
// (0 = Sunday); monthly items on one day of the month, moved to the last day
// in months that are too short. ChargedThrough marks the last day the server
// has charged, so a charge the owner deletes is never created again.
import type { Row } from "./schema";
import { addDays, lastDayOfMonth, monthKey, addMonths, weekday } from "./dates";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Due dates in [from, to], inclusive. Ignores Active. */
export function dueDates(item: Row, from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  if (item.Frequency === "weekly") {
    const wd = Number(item.Weekday);
    let d = addDays(from, (wd - weekday(from) + 7) % 7);
    for (; d <= to; d = addDays(d, 7)) out.push(d);
  } else if (item.Frequency === "monthly") {
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
    if (item.Active !== true) continue;
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
  if (item.Frequency === "weekly") return `Every ${WEEKDAYS[Number(item.Weekday)] ?? "week"}`;
  const day = Number(item.MonthDay);
  return `Monthly on the ${ordinal(day)}${day >= 29 ? " (last day in short months)" : ""}`;
}
