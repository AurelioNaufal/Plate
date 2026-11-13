// All dates are Asia/Taipei calendar dates as "YYYY-MM-DD" strings.
// Taipei is a fixed UTC+8 with no DST, so a plain offset is exact.
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function fromUtcMidnight(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toUtcMidnight(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function toTaipeiDate(d: Date): string {
  return fromUtcMidnight(new Date(d.getTime() + TAIPEI_OFFSET_MS));
}

export function todayTaipei(now: Date = new Date()): string {
  return toTaipeiDate(now);
}

export function addDays(date: string, n: number): string {
  return fromUtcMidnight(new Date(toUtcMidnight(date).getTime() + n * DAY_MS));
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(date: string): number {
  return toUtcMidnight(date).getUTCDay();
}

export function weekRange(date: string): { start: string; end: string } {
  const start = addDays(date, -weekday(date));
  return { start, end: addDays(start, 6) };
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMidnight(b).getTime() - toUtcMidnight(a).getTime()) / DAY_MS);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function lastDayOfMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${month}-${String(lastDayOfMonth(month)).padStart(2, "0")}` };
}

function isoIfValid(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null;
  const month = `${y}-${String(m).padStart(2, "0")}`;
  if (d > lastDayOfMonth(month)) return null;
  return `${month}-${String(d).padStart(2, "0")}`;
}

/** Accepts "M/D/YYYY" (the old Sheet's display format) or "YYYY-MM-DD". */
export function parseSheetDate(s: string): string | null {
  const t = s.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return isoIfValid(Number(m[3]), Number(m[1]), Number(m[2]));
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return isoIfValid(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}
