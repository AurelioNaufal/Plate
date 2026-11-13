// Apps Script glue for the one-time history import. The parsing and the
// report layout are unit-tested in shared/migrate.ts.
import { parseOldLedger, reportRows } from "../shared/migrate";
import { todayTaipei } from "../shared/dates";
import type { Row, TxType } from "../shared/schema";
import { GasStore, prepareRows } from "./gasStore";
import { valuesForRow } from "./store";

type Spreadsheet = GoogleAppsScript.Spreadsheet.Spreadsheet;

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/**
 * Plans the Transactions rewrite for a (re-)run: fresh imports first, then every
 * non-migrated row exactly as it is (raw values, so columns the owner added
 * survive). The caller writes `values` over rows 2.. and only then clears the
 * leftover tail, so a failed write never leaves the tab empty.
 * `data` is the tab's getValues(), header row first.
 */
export function mergeForMigration(data: unknown[][], imported: Row[]): { values: unknown[][]; clearFrom: number; clearRows: number } {
  const headers = data[0].map((h) => String(h).trim());
  const sourceCol = headers.indexOf("Source");
  if (sourceCol < 0) throw new Error('Transactions has no "Source" column. Run setup first.');
  const kept = data.slice(1).filter((r) => !r.every(isBlank) && String(r[sourceCol]).trim() !== "migrated");
  const width = headers.length;
  const values = [...imported.map((t) => valuesForRow(headers, t)), ...kept.map((r) => headers.map((_, i) => r[i] ?? ""))].map((r) =>
    r.length === width ? r : headers.map((_, i) => r[i] ?? ""),
  );
  const oldDataRows = data.length - 1;
  const clearFrom = values.length + 2;
  return { values, clearFrom, clearRows: Math.max(0, oldDataRows - values.length) };
}

export function migrate(target: Spreadsheet, oldId: string, now: Date, newId: () => string): void {
  const oldTab = SpreadsheetApp.openById(oldId).getSheetByName("Transactions");
  if (!oldTab) throw new Error("The old Sheet has no Transactions tab");
  const values = oldTab.getDataRange().getDisplayValues();

  const categories = new GasStore(target).read("Categories");
  const knownCategories: Record<TxType, string[]> = { expense: [], income: [] };
  for (const c of categories) {
    if (c.Type === "expense" || c.Type === "income") knownCategories[c.Type].push(String(c.Name));
  }

  const result = parseOldLedger(values, { today: todayTaipei(now), newId, knownCategories });

  // Re-runnable: replace earlier migrated rows, keep everything else.
  const tx = target.getSheetByName("Transactions");
  if (!tx) throw new Error("Run setup first");
  const data = tx.getDataRange().getValues();
  const headers = data[0].map((h) => String(h).trim());
  const { values: all, clearFrom, clearRows } = mergeForMigration(data, result.transactions);
  if (all.length) {
    prepareRows(tx, "Transactions", headers, 2, all.length);
    tx.getRange(2, 1, all.length, headers.length).setValues(all);
  }
  if (clearRows > 0) tx.getRange(clearFrom, 1, clearRows, headers.length).clearContent();

  const report = target.getSheetByName("MigrationReport") ?? target.insertSheet("MigrationReport");
  report.clear();
  report.getRange("A1").setValue(`Migration report — ${now.toISOString()} — imported ${result.transactions.length} rows, flagged ${result.flagged.length}`);
  const rows = reportRows(result);
  report.getRange(3, 1, rows.length, rows[0].length).setValues(rows);
  Logger.log("Imported %s rows, flagged %s. See the MigrationReport tab.", result.transactions.length, result.flagged.length);
}
