// Apps Script implementation of SheetStore. Thin glue over SpreadsheetApp;
// the row logic it relies on (rowsFromValues, valuesForRow) is unit-tested.
import type { SheetStore } from "./store";
import { rowsFromValues, valuesForRow } from "./store";
import { TABS, type ColType, type Row, type TabName } from "../shared/schema";

type Sheet = GoogleAppsScript.Spreadsheet.Sheet;

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/**
 * Makes sure rows startRow..startRow+numRows-1 exist and that their text and
 * date columns are plain text, so Sheets never turns "2026-11-12" into a date
 * (setup only formats the rows that existed at the time).
 */
export function prepareRows(sh: Sheet, tab: TabName, headers: string[], startRow: number, numRows: number): void {
  if (numRows <= 0) return;
  const lastNeeded = startRow + numRows - 1;
  const max = sh.getMaxRows();
  if (lastNeeded > max) sh.insertRowsAfter(max, lastNeeded - max);
  for (const [name, type] of TABS[tab].columns as [string, ColType][]) {
    if (type !== "string" && type !== "date") continue;
    const col = headers.indexOf(name) + 1;
    if (col > 0) sh.getRange(startRow, col, numRows, 1).setNumberFormat("@");
  }
}

export class GasStore implements SheetStore {
  constructor(private ss: GoogleAppsScript.Spreadsheet.Spreadsheet) {}

  private sheet(tab: TabName): Sheet {
    const sh = this.ss.getSheetByName(tab);
    if (!sh) throw new Error(`Tab "${tab}" is missing. Run setup.`);
    return sh;
  }

  private headers(sh: Sheet): string[] {
    return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map((h) => String(h).trim());
  }

  /** 1-based sheet row numbers keyed by ID. */
  private rowIndex(sh: Sheet, headers: string[]): Map<string, number> {
    const col = headers.indexOf("ID") + 1;
    const last = sh.getLastRow();
    const map = new Map<string, number>();
    if (col === 0 || last < 2) return map;
    sh.getRange(2, col, last - 1, 1).getValues().forEach(([id], i) => {
      if (!isBlank(id)) map.set(String(id), i + 2);
    });
    return map;
  }

  read(tab: TabName): Row[] {
    return rowsFromValues(tab, this.sheet(tab).getDataRange().getValues());
  }

  append(tab: TabName, rows: Row[]): void {
    if (rows.length === 0) return;
    const sh = this.sheet(tab);
    const headers = this.headers(sh);
    const start = sh.getLastRow() + 1;
    prepareRows(sh, tab, headers, start, rows.length);
    sh.getRange(start, 1, rows.length, headers.length).setValues(rows.map((r) => valuesForRow(headers, r)));
  }

  renameInColumn(tab: TabName, column: string, from: string, to: string, where?: { column: string; equals: string }): number {
    const sh = this.sheet(tab);
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return 0;
    const headers = values[0].map((h) => String(h).trim());
    const col = headers.indexOf(column);
    const whereCol = where ? headers.indexOf(where.column) : -1;
    if (col < 0) return 0;
    let changed = 0;
    const next = values.slice(1).map((line) => {
      const matches = String(line[col]).trim() === from && (!where || String(line[whereCol]).trim() === where.equals);
      if (matches) changed++;
      return [matches ? to : line[col]];
    });
    // One write for the whole column.
    if (changed) sh.getRange(2, col + 1, next.length, 1).setValues(next);
    return changed;
  }

  update(tab: TabName, row: Row): boolean {
    const sh = this.sheet(tab);
    const headers = this.headers(sh);
    const at = this.rowIndex(sh, headers).get(String(row.ID));
    if (!at) return false;
    // Overlay only the columns this row carries, so columns the owner
    // added by hand keep their values.
    const range = sh.getRange(at, 1, 1, headers.length);
    const current = range.getValues()[0];
    const next = headers.map((h, i) => (h in row ? (row[h] ?? "") : current[i]));
    range.setValues([next]);
    return true;
  }

  updateMany(tab: TabName, rows: Row[]): number {
    if (rows.length === 0) return 0;
    const sh = this.sheet(tab);
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return 0;
    const headers = values[0].map((h) => String(h).trim());
    const idCol = headers.indexOf("ID");
    if (idCol < 0) return 0;
    const byId = new Map(rows.map((r) => [String(r.ID), r]));
    let matched = 0;
    // Same overlay rule as update(): only the columns a row carries change.
    const next = values.slice(1).map((line) => {
      const row = byId.get(String(line[idCol]).trim());
      if (!row) return line;
      matched++;
      return headers.map((h, i) => (h in row ? (row[h] ?? "") : line[i]));
    });
    if (matched) sh.getRange(2, 1, next.length, headers.length).setValues(next);
    return matched;
  }

  remove(tab: TabName, ids: string[]): number {
    const sh = this.sheet(tab);
    const index = this.rowIndex(sh, this.headers(sh));
    const rowsToDelete = ids.map((id) => index.get(id)).filter((r): r is number => !!r).sort((a, b) => b - a);
    for (const r of rowsToDelete) sh.deleteRow(r);
    return rowsToDelete.length;
  }

  fillMissingIds(tab: TabName, newId: () => string): number {
    const sh = this.sheet(tab);
    const values = sh.getDataRange().getValues();
    const col = values[0].map((h) => String(h).trim()).indexOf("ID");
    if (col < 0) return 0;
    let filled = 0;
    values.slice(1).forEach((line, i) => {
      if (isBlank(line[col]) && !line.every(isBlank)) {
        sh.getRange(i + 2, col + 1).setValue(newId());
        filled++;
      }
    });
    return filled;
  }
}
