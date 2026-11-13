import { TABS, TAB_NAMES, DEFAULT_CATEGORIES, columnNames, type Row } from "../shared/schema";
import { valuesForRow } from "./store";

export function seedCategories(newId: () => string): Row[] {
  const make = (type: string) => (name: string, i: number): Row => ({ ID: newId(), Name: name, Type: type, Hidden: false, SortOrder: i + 1 });
  return [...DEFAULT_CATEGORIES.expense.map(make("expense")), ...DEFAULT_CATEGORIES.income.map(make("income"))];
}

// Transactions columns: A ID, B Type, C Date, D Amount, E Description, F Category.
// Categories columns: A ID, B Name, C Type, D Hidden.
const IN_SELECTED_MONTH = `((($B$1="All time")+(LEFT(Transactions!C2:C,7)=$B$1))>0)`;
const totalOf = (type: string) => `=SUMPRODUCT((Transactions!B2:B="${type}")*${IN_SELECTED_MONTH},Transactions!D2:D)`;

/** The Summary tab: pick a month (or All time) in B1 and see totals. */
export function summaryFormulas(): { cell: string; formula: string }[] {
  return [
    { cell: "H1", formula: "All time" },
    { cell: "H2", formula: `=SORT(UNIQUE(FILTER(LEFT(Transactions!C2:C,7),Transactions!C2:C<>"")),1,FALSE)` },
    { cell: "A4", formula: `=FILTER(Categories!B2:B,Categories!C2:C="expense",Categories!D2:D<>TRUE)` },
    {
      cell: "B4",
      formula: `=MAP(A4:A,LAMBDA(c,IF(c="",,SUMPRODUCT((Transactions!B2:B="expense")*(Transactions!F2:F=c)*${IN_SELECTED_MONTH},Transactions!D2:D))))`,
    },
    { cell: "E3", formula: totalOf("expense") },
    { cell: "E4", formula: totalOf("income") },
    { cell: "E5", formula: "=E4-E3" },
  ];
}

/** The ByMonth tab: months down the side (newest first), expense categories across. */
export function byMonthFormulas(): { cell: string; formula: string }[] {
  return [
    { cell: "A1", formula: "Month" },
    { cell: "A2", formula: `=SORT(UNIQUE(FILTER(LEFT(Transactions!C2:C,7),Transactions!C2:C<>"")),1,FALSE)` },
    { cell: "B1", formula: `=TRANSPOSE(FILTER(Categories!B2:B,Categories!C2:C="expense",Categories!D2:D<>TRUE))` },
    {
      cell: "B2",
      formula:
        `=LET(months,FILTER(A2:A,A2:A<>""),cats,FILTER(B1:1,B1:1<>""),` +
        `MAKEARRAY(ROWS(months),COLUMNS(cats),LAMBDA(r,c,SUMPRODUCT((Transactions!B2:B="expense")` +
        `*(Transactions!F2:F=INDEX(cats,1,c))*(LEFT(Transactions!C2:C,7)=INDEX(months,r,1)),Transactions!D2:D))))`,
    },
  ];
}

type Sheet = GoogleAppsScript.Spreadsheet.Sheet;

function headerRow(sh: Sheet): string[] {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map((h) => String(h).trim());
}

/** Creates or completes every tab. Safe to run again: existing data is kept. */
export function setupSpreadsheet(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, newId: () => string): void {
  for (const tab of TAB_NAMES) {
    const wanted = columnNames(tab);
    let sh = ss.getSheetByName(tab);
    if (!sh) {
      sh = ss.insertSheet(tab);
      sh.getRange(1, 1, 1, wanted.length).setValues([wanted]).setFontWeight("bold");
      sh.setFrozenRows(1);
    } else {
      const have = headerRow(sh).filter(Boolean);
      const missing = wanted.filter((h) => !have.includes(h));
      if (missing.length) sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]).setFontWeight("bold");
    }
    const headers = headerRow(sh);
    for (const [name, type] of TABS[tab].columns) {
      if (type !== "string" && type !== "date") continue;
      const col = headers.indexOf(name) + 1;
      if (col > 0) sh.getRange(2, col, sh.getMaxRows() - 1, 1).setNumberFormat("@");
    }
  }

  const categories = ss.getSheetByName("Categories")!;
  if (categories.getLastRow() < 2) {
    const headers = headerRow(categories);
    const rows = seedCategories(newId);
    categories.getRange(2, 1, rows.length, headers.length).setValues(rows.map((r) => valuesForRow(headers, r)));
  }

  const tx = ss.getSheetByName("Transactions")!;
  const txHeaders = headerRow(tx);
  const rowsBelowHeader = tx.getMaxRows() - 1;
  tx.getRange(2, txHeaders.indexOf("Type") + 1, rowsBelowHeader, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["expense", "income"], true).setAllowInvalid(false).build(),
  );
  tx.getRange(2, txHeaders.indexOf("Category") + 1, rowsBelowHeader, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(categories.getRange("B2:B"), true).setAllowInvalid(true).build(),
  );

  const summary = ss.getSheetByName("Summary") ?? ss.insertSheet("Summary", 0);
  summary.clear();
  summary.getRange("A1").setValue("Month").setFontWeight("bold");
  // Plain text, so picking "2026-11" stays text instead of becoming a date.
  summary.getRange("B1").setNumberFormat("@").setValue("All time");
  summary.getRange("A3:B3").setValues([["Expense category", "Spent"]]).setFontWeight("bold");
  summary.getRange("D3:D5").setValues([["Total spent"], ["Total income"], ["Net"]]).setFontWeight("bold");
  for (const { cell, formula } of summaryFormulas()) summary.getRange(cell).setValue(formula);
  summary.getRange("B1").setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(summary.getRange("H1:H"), true).build(),
  );
  summary.getRange("B4:B").setNumberFormat('"NT$"#,##0');
  summary.getRange("E3:E5").setNumberFormat('"NT$"#,##0');
  summary.hideColumns(8);

  const byMonth = ss.getSheetByName("ByMonth") ?? ss.insertSheet("ByMonth", 1);
  byMonth.clear();
  for (const { cell, formula } of byMonthFormulas()) byMonth.getRange(cell).setValue(formula);
  byMonth.getRange("1:1").setFontWeight("bold");
  byMonth.getRange("B2:Z").setNumberFormat('"NT$"#,##0');
  byMonth.setFrozenRows(1);

  const blank = ss.getSheetByName("Sheet1");
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
}
