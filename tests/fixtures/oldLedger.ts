// Shaped like the old Sheet's Transactions tab as getDisplayValues() returns it:
// a header area, then side-by-side expense and income blocks.
const E = (date: string, amount: string, desc: string, cat: string) => ["", date, amount, desc, cat];
const I = (date: string, amount: string, desc: string, cat: string) => ["", date, amount, desc, cat];
const blank = ["", "", "", "", ""];
const row = (left: string[], right: string[]) => [...left, ...right];

export function oldLedger(extraExpenses: string[][] = []): string[][] {
  return [
    ["0", "", "", "", "", "", "", "", "", ""],
    ["", "Start Date", "10/1/2026", "", "Total Expenses", "", "$1,000.00", "", "", ""],
    ["", "End Date", "10/15/2026", "", "Total Income", "", "$2,000.00", "", "", ""],
    row(["", "Date", "Amount", "Description", "Category"], ["", "Date", "Amount", "Description", "Category"]),
    row(E("8/26/2025", "$1,240.00", "Desk lamp", "Furniture"), I("8/26/2025", "$3,000.00", "Family support", "Family")),
    row(E("8/27/2025", "$62.00", "Lunch (cafeteria)", "Food"), I("1/7/2025", "$500.00", "Gift from aunt", "Family")),
    row(blank, blank),
    row(E("11/11/2026", "$49.50", "Half-price snack", "Food"), blank),
    row(E("11/12/2026", "$80.00", " Buffet lunch ", "Food"), blank),
    ...extraExpenses.map((e) => row(E(e[0], e[1], e[2], e[3]), blank)),
  ];
}
