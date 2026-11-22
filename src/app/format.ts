// Display helpers. Dates are calendar strings, so format them as UTC to avoid
// the device timezone shifting the day.
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);

export const formatDay = (d: string) => dayFmt.format(asDate(d)); // "Thu, Nov 12"
export const formatLongDay = (d: string) => longFmt.format(asDate(d)); // "Thursday, Nov 12"
const shortFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const formatShortDay = (d: string) => shortFmt.format(asDate(d)).replace(",", ""); // "Sun 15 Nov"
export const formatMonth = (d: string) => monthFmt.format(asDate(d)); // "November 2026"
const fullFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export const formatFullDate = (d: string) => fullFmt.format(asDate(d)); // "Sep 3, 2025"
const monShortFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
/** "Nov", or "Nov 25" when withYear — for a "YYYY-MM" month key. */
export const formatMonthShort = (month: string, withYear = false) =>
  monShortFmt.format(asDate(`${month}-01`)) + (withYear ? ` ${month.slice(2, 4)}` : "");
/** A share as a whole percent; tiny non-zero shares read "<1%". */
export const formatPct = (share: number) => (share > 0 && share < 0.005 ? "<1%" : `${Math.round(share * 100)}%`);
