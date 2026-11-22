import { toCsv, exportRows, exportFileName } from "../../src/shared/csv";
import { columnNames, type Row } from "../../src/shared/schema";

/** A small RFC 4180 reader: quoted fields, doubled quotes, CRLF rows. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r" && text[i + 1] === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const tx = (ID: string, Date: string, Description: string | null, Amount: number | null = 100): Row => ({
  ID, Type: "expense", Date, Amount, Description, Category: "Food", Source: "app", MealID: null, RecurringID: null, CreatedAt: null,
});

test("awkward text round-trips: commas, quotes, line breaks and non-Latin letters", () => {
  const rows = [tx("a", "2026-11-02", 'Rice, "big" plate\n2nd line'), tx("b", "2026-11-03", "Nasi campur 飯")];
  const parsed = parseCsv(toCsv("Transactions", rows).slice(1));
  expect(parsed[0]).toEqual(columnNames("Transactions"));
  expect(parsed[1][4]).toBe('Rice, "big" plate\n2nd line');
  expect(parsed[2][4]).toBe("Nasi campur 飯");
  expect(parsed).toHaveLength(3);
});

test("starts with a BOM; blanks are empty; booleans are TRUE/FALSE", () => {
  const text = toCsv("Meals", [{ ID: "m", Date: "2026-11-02", Name: "Toast", Kcal: null, Protein: 8, InBudget: true, Estimated: false }]);
  expect(text.startsWith("﻿")).toBe(true);
  expect(text.split("\r\n")[1]).toBe("m,2026-11-02,,Toast,,8,TRUE,,,FALSE,");
});

test("no rows gives the header alone", () => {
  expect(toCsv("Body", [])).toBe("﻿ID,Date,WeightKg,BodyFatPct,WaistCm,ArmCm\r\n");
});

test("exportRows keeps a month's dated rows, oldest first; undated tabs come whole", () => {
  const rows = { Transactions: [tx("n2", "2026-11-20", "x"), tx("o", "2026-10-31", "x"), tx("n1", "2026-11-01", "x")], Recurring: [{ ID: "r1", Name: "Phone" }] };
  expect(exportRows(rows, "Transactions", { kind: "month", month: "2026-11" }).map((r) => r.ID)).toEqual(["n1", "n2"]);
  expect(exportRows(rows, "Transactions", { kind: "range", start: "2026-10-31", end: "2026-11-01" }).map((r) => r.ID)).toEqual(["o", "n1"]);
  expect(exportRows(rows, "Recurring", { kind: "month", month: "2026-11" })).toHaveLength(1);
  expect(exportRows(rows, "Body", { kind: "all" })).toEqual([]);
});

test("file names", () => {
  expect(exportFileName("Transactions", { kind: "month", month: "2026-11" })).toBe("plate-transactions-2026-11.csv");
  expect(exportFileName("SavedFoods", { kind: "all" })).toBe("plate-savedfoods-all.csv");
  expect(exportFileName("Body", { kind: "range", start: "2026-11-15", end: "2026-11-21" })).toBe("plate-body-2026-11-15_2026-11-21.csv");
});

test("text that would run as a spreadsheet formula is kept as text; numbers stay numbers", () => {
  const rows = [tx("f", "2026-11-02", "=SUM(A1)", -5), tx("g", "2026-11-03", "-50% sale"), tx("h", "2026-11-04", "+ drink"), tx("i", "2026-11-05", "@home")];
  const parsed = parseCsv(toCsv("Transactions", rows).slice(1));
  expect(parsed.slice(1).map((r) => r[4])).toEqual(["'=SUM(A1)", "'-50% sale", "'+ drink", "'@home"]);
  expect(parsed[1][3]).toBe("-5");
});
