import { chargesDue, runRecurringCharges } from "../../src/backend/recurring";
import { MemoryStore } from "../../src/backend/store";
import type { Row } from "../../src/shared/schema";

const NOW = new Date("2026-11-29T01:00:00Z");
const gym: Row = { ID: "r1", Name: "Gym", Amount: 40, Category: "Health", Frequency: "weekly", Weekday: 0, MonthDay: null, Active: true, StartDate: "2026-11-15", ActiveSince: null, ChargedThrough: null };

describe("chargesDue", () => {
  test("catches up every missed date and marks the item charged through today", () => {
    const { charges, updatedItems } = chargesDue([gym], [], "2026-11-29", NOW);
    expect(charges.map((c) => c.ID)).toEqual(["rec_r1_2026-11-15", "rec_r1_2026-11-22", "rec_r1_2026-11-29"]);
    expect(charges[0]).toEqual({
      ID: "rec_r1_2026-11-15", Type: "expense", Date: "2026-11-15", Amount: 40, Description: "Gym",
      Category: "Health", Source: "recurring", RecurringID: "r1", CreatedAt: NOW.toISOString(),
    });
    expect(updatedItems).toHaveLength(1);
    expect(updatedItems[0].ChargedThrough).toBe("2026-11-29");
  });

  test("a switched-off item gives no charges", () => {
    expect(chargesDue([{ ...gym, Active: false }], [], "2026-11-29", NOW)).toEqual({ charges: [], updatedItems: [] });
  });

  test("switched back on: nothing before ActiveSince is back-filled", () => {
    const { charges } = chargesDue([{ ...gym, ActiveSince: "2026-11-25" }], [], "2026-11-29", NOW);
    expect(charges.map((c) => c.Date)).toEqual(["2026-11-29"]);
  });

  test("not started yet: no charges and no update", () => {
    expect(chargesDue([{ ...gym, StartDate: "2026-12-06" }], [], "2026-11-29", NOW)).toEqual({ charges: [], updatedItems: [] });
  });

  test("a charge that already exists by RecurringID and Date is not repeated", () => {
    const existing = [{ ID: "other", RecurringID: "r1", Date: "2026-11-22" }];
    expect(chargesDue([gym], existing, "2026-11-29", NOW).charges.map((c) => c.Date)).toEqual(["2026-11-15", "2026-11-29"]);
  });

  test("an item already charged through today is left alone", () => {
    expect(chargesDue([{ ...gym, ChargedThrough: "2026-11-29" }], [], "2026-11-29", NOW)).toEqual({ charges: [], updatedItems: [] });
  });

  test("a row typed into the Sheet without an ID is skipped until it gets one", () => {
    expect(chargesDue([{ ...gym, ID: null }], [], "2026-11-29", NOW).charges).toEqual([]);
  });
});

describe("runRecurringCharges", () => {
  test("running twice on the same day adds nothing the second time", () => {
    const store = new MemoryStore({ Recurring: [gym], Transactions: [] });
    expect(runRecurringCharges(store, "2026-11-29", NOW)).toBe(3);
    expect(runRecurringCharges(store, "2026-11-29", NOW)).toBe(0);
    expect(store.read("Transactions")).toHaveLength(3);
    expect(store.read("Recurring")[0].ChargedThrough).toBe("2026-11-29");
  });

  test("a deleted charge is not created again", () => {
    const store = new MemoryStore({ Recurring: [gym], Transactions: [] });
    runRecurringCharges(store, "2026-11-29", NOW);
    store.remove("Transactions", ["rec_r1_2026-11-22"]);
    expect(runRecurringCharges(store, "2026-11-29", NOW)).toBe(0);
    expect(store.read("Transactions")).toHaveLength(2);
  });

  test("the next run only adds the new week's charge", () => {
    const store = new MemoryStore({ Recurring: [gym], Transactions: [] });
    runRecurringCharges(store, "2026-11-29", NOW);
    expect(runRecurringCharges(store, "2026-12-06", NOW)).toBe(1);
    expect(store.read("Transactions").at(-1)?.ID).toBe("rec_r1_2026-12-06");
  });
});
