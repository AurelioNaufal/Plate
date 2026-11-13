// One-time import of the old Monthly Budget Sheet's Transactions tab.
// Rows that look wrong are flagged for the owner, never silently changed.
import { DEFAULT_CATEGORIES, type Row, type TxType } from "./schema";
import { parseSheetDate, monthKey } from "./dates";
import { parseSheetAmount } from "./money";

export type Stats = {
  count: Record<TxType, number>;
  /** Expense categories by name; income categories as "<name> (income)". */
  byCategory: Record<string, number>;
  byMonth: Record<string, { expense: number; income: number }>;
};

export type Flag = { block: TxType; sheetRow: number; cells: string[]; reason: string };

export type MigrationResult = {
  transactions: Row[];
  flagged: Flag[];
  /** Totals of the rows that were imported. */
  stats: Stats;
  /** Totals of every old row with a readable amount, for side-by-side comparison. */
  sourceStats: Stats;
};

export type MigrationOptions = {
  today: string;
  newId: () => string;
  knownCategories?: Record<TxType, string[]>;
};

type Block = { type: TxType; date: number; amount: number; description: number; category: number };

const norm = (v: unknown) => String(v ?? "").trim();

/** Any positive amount, cents allowed: "$12.50" → 12.5. */
function parseLooseAmount(s: string): number | null {
  const cleaned = s.replace(/^NT\$|^\$/i, "").replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 ? n : null;
}

/** Fallback for exports where the Date and Amount header cells come back blank:
 *  each "Description" followed by "Category" is a block, with Date and Amount
 *  in the two columns before it (the template's layout). */
function findBlocksByDescription(values: string[][]): { headerRow: number; blocks: Block[] } | null {
  const headerRow = values.findIndex((r) => r.some((c) => /description/i.test(norm(c))));
  if (headerRow < 0) return null;
  const header = values[headerRow].map(norm);
  const blocks: Block[] = [];
  header.forEach((cell, i) => {
    if (!/description/i.test(cell) || !/category/i.test(header[i + 1] ?? "") || i < 2) return;
    blocks.push({ type: blocks.length === 0 ? "expense" : "income", date: i - 2, amount: i - 1, description: i, category: i + 1 });
  });
  return blocks.length ? { headerRow, blocks: blocks.slice(0, 2) } : null;
}

function findBlocks(values: string[][]): { headerRow: number; blocks: Block[] } {
  const headerRow = values.findIndex((r) => r.some((c) => norm(c) === "Date") && r.some((c) => /amount/i.test(norm(c))));
  if (headerRow < 0) {
    const fallback = findBlocksByDescription(values);
    if (fallback) return fallback;
    throw new Error("Could not find the Date/Amount/Description/Category header row in the old Sheet");
  }
  const header = values[headerRow].map(norm);
  const blocks: Block[] = [];
  header.forEach((cell, i) => {
    if (cell !== "Date") return;
    const near = (re: RegExp) => {
      for (let j = i + 1; j <= i + 3; j++) if (re.test(header[j] ?? "")) return j;
      return -1;
    };
    const amount = near(/amount/i);
    const description = near(/description/i);
    const category = near(/category/i);
    if (amount < 0 || description < 0 || category < 0) return;
    blocks.push({ type: blocks.length === 0 ? "expense" : "income", date: i, amount, description, category });
  });
  if (blocks.length === 0) throw new Error("No Date/Amount/Description/Category blocks found");
  return { headerRow, blocks: blocks.slice(0, 2) };
}

function emptyStats(): Stats {
  return { count: { expense: 0, income: 0 }, byCategory: {}, byMonth: {} };
}

function addToStats(s: Stats, type: TxType, month: string, category: string, amount: number) {
  s.count[type]++;
  const key = type === "expense" ? category : `${category} (income)`;
  s.byCategory[key] = (s.byCategory[key] ?? 0) + amount;
  const m = (s.byMonth[month] ??= { expense: 0, income: 0 });
  m[type] += amount;
}

export function ledgerStats(rows: Row[]): Stats {
  const s = emptyStats();
  for (const r of rows) {
    if (r.Type !== "expense" && r.Type !== "income") continue;
    addToStats(s, r.Type, monthKey(String(r.Date)), String(r.Category ?? ""), Number(r.Amount));
  }
  return s;
}

const REPORT_WIDTH = 7;
type Cellish = string | number;

/** The MigrationReport tab: old vs imported totals, then every flagged row. */
export function reportRows(result: MigrationResult): Cellish[][] {
  const pad = (r: Cellish[]) => [...r, ...Array(REPORT_WIDTH - r.length).fill("")];
  const { stats, sourceStats } = result;
  const out: Cellish[][] = [];
  out.push(["Rows", "Old sheet", "Imported"]);
  out.push(["Expenses", sourceStats.count.expense, stats.count.expense]);
  out.push(["Income", sourceStats.count.income, stats.count.income]);
  out.push([]);
  out.push(["Month", "Old expenses", "Imported expenses", "Old income", "Imported income"]);
  const months = [...new Set([...Object.keys(sourceStats.byMonth), ...Object.keys(stats.byMonth)])].sort().reverse();
  for (const m of months) {
    const o = sourceStats.byMonth[m] ?? { expense: 0, income: 0 };
    const i = stats.byMonth[m] ?? { expense: 0, income: 0 };
    out.push([m, o.expense, i.expense, o.income, i.income]);
  }
  out.push([]);
  out.push(["Category", "Old total", "Imported total"]);
  const cats = [...new Set([...Object.keys(sourceStats.byCategory), ...Object.keys(stats.byCategory)])].sort();
  for (const c of cats) out.push([c, sourceStats.byCategory[c] ?? 0, stats.byCategory[c] ?? 0]);
  out.push([]);
  out.push([`Flagged rows (${result.flagged.length}) — fix these in the old Sheet if needed, then run runMigration again BEFORE you start editing imported entries in the app`]);
  out.push(["Old sheet row", "Block", "Date", "Amount", "Description", "Category", "Reason"]);
  for (const f of result.flagged) out.push([f.sheetRow, f.block, ...f.cells, f.reason]);
  return out.map(pad);
}

export function parseOldLedger(values: string[][], opts: MigrationOptions): MigrationResult {
  const known = opts.knownCategories ?? DEFAULT_CATEGORIES;
  const { headerRow, blocks } = findBlocks(values);

  type Candidate = { block: TxType; sheetRow: number; cells: string[]; date: string | null; amount: number | null; rounded: boolean; description: string; category: string };
  const candidates: Candidate[] = [];
  values.slice(headerRow + 1).forEach((line, i) => {
    for (const b of blocks) {
      const cells = [line[b.date], line[b.amount], line[b.description], line[b.category]].map(norm);
      if (cells.every((c) => c === "")) continue;
      const exact = parseSheetAmount(cells[1]);
      const loose = exact === null ? parseLooseAmount(cells[1]) : null;
      // Split bills have cents; round to whole NT$ and flag it so the change is visible.
      const amount = exact ?? (loose !== null && Math.round(loose) > 0 ? Math.round(loose) : null);
      candidates.push({
        block: b.type,
        sheetRow: headerRow + 2 + i,
        cells,
        date: parseSheetDate(cells[0]),
        amount,
        rounded: exact === null && amount !== null,
        description: cells[2],
        category: cells[3],
      });
    }
  });

  const earliestExpense = candidates
    .filter((c) => c.block === "expense" && c.date && c.amount && c.category && c.date <= opts.today)
    .map((c) => c.date as string)
    .sort()[0];

  const transactions: Row[] = [];
  const flagged: Flag[] = [];
  const sourceStats = emptyStats();
  const flag = (c: Candidate, reason: string) => flagged.push({ block: c.block, sheetRow: c.sheetRow, cells: c.cells, reason });

  for (const c of candidates) {
    if (c.amount) addToStats(sourceStats, c.block, c.date ? monthKey(c.date) : "(no date)", c.category, c.amount);

    if (!c.date) { flag(c, "date not readable"); continue; }
    if (!c.amount) { flag(c, "amount is not a whole NT$ above 0"); continue; }
    if (!c.category) { flag(c, "missing category"); continue; }
    if (c.date > opts.today) { flag(c, "future date"); continue; }
    if (earliestExpense && c.date < earliestExpense) { flag(c, `date is before first entry (${earliestExpense})`); continue; }
    if (!known[c.block].includes(c.category)) flag(c, "unknown category (imported anyway)");
    if (c.rounded) flag(c, `amount rounded from ${c.cells[1]} to NT$${c.amount} (imported)`);

    transactions.push({
      ID: opts.newId(),
      Type: c.block,
      Date: c.date,
      Amount: c.amount,
      Description: c.description || null,
      Category: c.category,
      Source: "migrated",
    });
  }

  return { transactions, flagged, stats: ledgerStats(transactions), sourceStats };
}
