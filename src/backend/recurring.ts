// Turns recurring items into expense rows. Runs from a daily trigger and at
// the start of every list, under the script lock, so it is safe to run as
// often as it likes: charge IDs are fixed per (item, date), existing rows are
// never repeated, and ChargedThrough stops a deleted charge coming back.
import type { Row } from "../shared/schema";
import type { SheetStore } from "./store";
import { dueDates, recurringProblem, windowStart } from "../shared/recurring";
import { addDays } from "../shared/dates";

export function chargeId(recurringId: string, date: string): string {
  return `rec_${recurringId}_${date}`;
}

export function chargesDue(items: Row[], txs: Row[], today: string, now: Date): { charges: Row[]; updatedItems: Row[] } {
  const ids = new Set(txs.map((t) => String(t.ID)));
  const byItemDate = new Set(txs.filter((t) => t.RecurringID).map((t) => `${t.RecurringID}|${t.Date}`));
  const charges: Row[] = [];
  const updatedItems: Row[] = [];
  const yesterday = addDays(today, -1);
  for (const item of items) {
    // A row typed into the Sheet gets an ID on the next list; charge it then.
    // A row with an unreadable value is skipped (the Recurring screen flags it).
    if (!item.ID || recurringProblem(item)) continue;
    const id = String(item.ID);
    const start = windowStart(item);
    const through = typeof item.ChargedThrough === "string" ? item.ChargedThrough : "";
    if (item.Active !== true) {
      // Switched off: keep the window moving (to yesterday, so switching back
      // on today can still charge today), so ticking Active again in the Sheet
      // never fills in the weeks it was off.
      if (start <= yesterday && (!through || through < yesterday)) updatedItems.push({ ...item, ChargedThrough: yesterday });
      continue;
    }
    if (start > today) continue;
    for (const date of dueDates(item, start, today)) {
      const cid = chargeId(id, date);
      if (ids.has(cid) || byItemDate.has(`${id}|${date}`)) continue;
      charges.push({
        ID: cid,
        Type: "expense",
        Date: date,
        Amount: item.Amount,
        Description: item.Name,
        Category: item.Category,
        Source: "recurring",
        RecurringID: id,
        CreatedAt: now.toISOString(),
      });
    }
    if (!through || through < today) updatedItems.push({ ...item, ChargedThrough: today });
  }
  return { charges, updatedItems };
}

/** Writes the charges due through today. Returns how many were added. */
export function runRecurringCharges(store: SheetStore, today: string, now: Date): number {
  const { charges, updatedItems } = chargesDue(store.read("Recurring"), store.read("Transactions"), today, now);
  // Charges first: if this stops halfway, ChargedThrough is still old and the
  // next run finishes the job without duplicates (the IDs are fixed).
  store.append("Transactions", charges);
  if (updatedItems.length) store.updateMany("Recurring", updatedItems);
  return charges.length;
}
