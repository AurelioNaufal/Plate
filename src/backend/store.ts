import { columnNames, columnType, type Cell, type Row, type TabName } from "../shared/schema";
import { toTaipeiDate, parseSheetDate } from "../shared/dates";

export interface SheetStore {
  read(tab: TabName): Row[];
  append(tab: TabName, rows: Row[]): void;
  /** Replaces the row with the same ID. Returns false if no such row. */
  update(tab: TabName, row: Row): boolean;
  /** Replaces every row whose ID matches, in one read and one write. Returns how many matched. */
  updateMany(tab: TabName, rows: Row[]): number;
  /** Returns how many of the IDs existed and were removed. */
  remove(tab: TabName, ids: string[]): number;
  /** Gives rows typed into the Sheet by hand (blank ID) a new ID. */
  fillMissingIds(tab: TabName, newId: () => string): number;
  /** Bulk rename of one column's value in a single read and write (category renames). */
  renameInColumn(tab: TabName, column: string, from: string, to: string, where?: { column: string; equals: string }): number;
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

/** Converts whatever Sheets hands back into the schema's cell types. */
export function normalizeRow(tab: TabName, raw: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(raw)) {
    const type = columnType(tab, key);
    if (!type) continue;
    out[key] = normalizeCell(type, value);
  }
  return out;
}

function normalizeCell(type: string, v: unknown): Cell {
  if (isBlank(v)) return null;
  if (v instanceof Date) return type === "date" ? toTaipeiDate(v) : v.toISOString();
  switch (type) {
    case "date": {
      // Hand-typed dates in a text cell (e.g. "11/12/2026") become YYYY-MM-DD.
      const text = String(v).trim();
      return parseSheetDate(text) ?? text;
    }
    case "number": {
      const num = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
      return Number.isFinite(num) ? num : String(v);
    }
    case "boolean":
      if (typeof v === "boolean") return v;
      return String(v).trim().toUpperCase() === "TRUE";
    default:
      return typeof v === "string" ? v.trim() : String(v);
  }
}

/** values[0] is the header row. Unknown headers are ignored; blank rows dropped. */
export function rowsFromValues(tab: TabName, values: unknown[][]): Row[] {
  if (values.length === 0) return [];
  const headers = values[0].map((h) => String(h).trim());
  const known = new Set(columnNames(tab));
  const rows: Row[] = [];
  for (const line of values.slice(1)) {
    if (line.every(isBlank)) continue;
    const raw: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (known.has(h)) raw[h] = line[i];
    });
    rows.push(normalizeRow(tab, raw));
  }
  return rows;
}

export function valuesForRow(headers: string[], row: Row): unknown[] {
  return headers.map((h) => (row[h] === undefined || row[h] === null ? "" : row[h]));
}

export class MemoryStore implements SheetStore {
  private tabs: Partial<Record<TabName, Row[]>>;

  constructor(initial: Partial<Record<TabName, Row[]>> = {}) {
    this.tabs = {};
    for (const [tab, rows] of Object.entries(initial)) {
      this.tabs[tab as TabName] = (rows ?? []).map((r) => ({ ...r }));
    }
  }

  read(tab: TabName): Row[] {
    return (this.tabs[tab] ?? []).map((r) => ({ ...r }));
  }

  append(tab: TabName, rows: Row[]): void {
    this.tabs[tab] = [...(this.tabs[tab] ?? []), ...rows.map((r) => ({ ...r }))];
  }

  update(tab: TabName, row: Row): boolean {
    const rows = this.tabs[tab] ?? [];
    const i = rows.findIndex((r) => r.ID === row.ID);
    if (i < 0) return false;
    rows[i] = { ...row };
    return true;
  }

  updateMany(tab: TabName, rows: Row[]): number {
    return rows.filter((r) => this.update(tab, r)).length;
  }

  remove(tab: TabName, ids: string[]): number {
    const rows = this.tabs[tab] ?? [];
    const drop = new Set(ids);
    const kept = rows.filter((r) => !drop.has(String(r.ID)));
    this.tabs[tab] = kept;
    return rows.length - kept.length;
  }

  renameInColumn(tab: TabName, column: string, from: string, to: string, where?: { column: string; equals: string }): number {
    let changed = 0;
    for (const r of this.tabs[tab] ?? []) {
      if (r[column] !== from) continue;
      if (where && r[where.column] !== where.equals) continue;
      r[column] = to;
      changed++;
    }
    return changed;
  }

  fillMissingIds(tab: TabName, newId: () => string): number {
    let filled = 0;
    for (const r of this.tabs[tab] ?? []) {
      if (isBlank(r.ID)) {
        r.ID = newId();
        filled++;
      }
    }
    return filled;
  }
}
