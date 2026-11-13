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
