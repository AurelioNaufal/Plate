import type { Row } from "../../src/shared/schema";

// A made-up week, Sun Nov 8 – Thu Nov 12 2026, plus one income row.
let n = 0;
const e = (Date: string, Amount: number, Description: string, Category = "Food", Source = "migrated"): Row => ({
  ID: `w${++n}`, Type: "expense", Date, Amount, Description, Category, Source,
});

export const realWeek: Row[] = [
  e("2026-11-08", 120, "Burger meal"),
  e("2026-11-08", 45, "Bakery"),
  e("2026-11-08", 70, "Buffet lunch"),
  e("2026-11-08", 40, "Gym", "Health", "recurring"),
  e("2026-11-08", 20, "Laundry", "Utilities", "recurring"),
  e("2026-11-09", 55, "Snacks"),
  e("2026-11-09", 85, "Buffet lunch"),
  e("2026-11-09", 60, "Buffet dinner"),
  e("2026-11-09", 50, "Bread + milk"),
  e("2026-11-10", 40, "Burger"),
  e("2026-11-10", 110, "Buffet lunch"),
  e("2026-11-10", 75, "Buffet dinner"),
  e("2026-11-11", 50, "Bread + milk"),
  e("2026-11-11", 60, "Dumplings"),
  e("2026-11-11", 45, "Bubble tea"),
  e("2026-11-11", 180, "Haircut", "Utilities"),
  e("2026-11-12", 90, "Buffet lunch"),
  { ID: "inc1", Type: "income", Date: "2026-11-10", Amount: 5000, Description: "Part-time pay (Nov)", Category: "Part-Time Jobs", Source: "migrated" },
  e("2026-11-01", 999, "Last week", "Food"),
];
