import { columnNames, columnType, type Cell, type Row, type TabName } from "./schema";

export type ExportTab = "Transactions" | "Meals" | "Recurring" | "SavedFoods" | "Workouts" | "Body";
export type ExportRange = { kind: "all" } | { kind: "month"; month: string } | { kind: "range"; start: string; end: string };

const DATED: TabName[] = ["Transactions", "Meals", "Workouts", "Body"];

function field(v: Cell | undefined, isText = false): string {
  if (v === null || v === undefined) return "";
  let text = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v);
  // Text starting like a formula would run in Excel or Sheets; a leading ' keeps it text.
  if (isText && typeof v === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 CSV with a BOM (so Excel reads the letters right), the schema's columns, CRLF line ends. */
export function toCsv(tab: TabName, rows: Row[]): string {
  const cols = columnNames(tab);
  const text = cols.map((c) => columnType(tab, c) === "string");
  const lines = [cols.join(","), ...rows.map((r) => cols.map((c, i) => field(r[c], text[i])).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** The rows of a tab in the range, oldest first. Undated tabs (Recurring, Saved foods) come whole. */
export function exportRows(rows: Partial<Record<TabName, Row[]>>, tab: TabName, range: ExportRange): Row[] {
  const all = rows[tab] ?? [];
  if (!DATED.includes(tab)) return [...all];
  const [start, end] =
    range.kind === "all" ? ["", "￿"] : range.kind === "month" ? [`${range.month}-01`, `${range.month}-31`] : [range.start, range.end];
  return all
    .filter((r) => typeof r.Date === "string" && r.Date >= start && r.Date <= end)
    .sort((a, b) => String(a.Date).localeCompare(String(b.Date)));
}

/** plate-<type>-<range>.csv: "2026-11", "all" or "<start>_<end>". */
export function exportFileName(tab: TabName, range: ExportRange): string {
  const r = range.kind === "all" ? "all" : range.kind === "month" ? range.month : `${range.start}_${range.end}`;
  return `plate-${tab.toLowerCase()}-${r}.csv`;
}
