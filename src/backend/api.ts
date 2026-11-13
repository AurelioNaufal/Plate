import type { SheetStore } from "./store";
import { normalizeRow } from "./store";
import { isTabName, type Row, type TabName } from "../shared/schema";
import { parseSheetDate, todayTaipei } from "../shared/dates";
import { runRecurringCharges } from "./recurring";

export type ErrorCode = "UNAUTHORIZED" | "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "SERVER";
export type ApiResponse = { ok: true; data: unknown } | { ok: false; error: { code: ErrorCode; message: string } };

export interface ApiContext {
  store: SheetStore;
  token: string;
  now: Date;
  newId: () => string;
}

class ApiFailure extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}

const fail = (code: ErrorCode, message: string): never => {
  throw new ApiFailure(code, message);
};

const CATEGORY_TABS: TabName[] = ["Transactions", "Budgets", "Recurring"];
const TIMESTAMPED: TabName[] = ["Transactions", "Meals"];

export function handleRequest(bodyText: string, ctx: ApiContext): ApiResponse {
  try {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return fail("BAD_REQUEST", "Request body is not valid JSON");
    }
    if (!body || typeof body !== "object") fail("BAD_REQUEST", "Request body must be an object");
    if (!ctx.token || body.token !== ctx.token) fail("UNAUTHORIZED", "Missing or wrong token");
    return { ok: true, data: dispatch(body, ctx) };
  } catch (e) {
    if (e instanceof ApiFailure) return { ok: false, error: { code: e.code, message: e.message } };
    throw e;
  }
}

function dispatch(body: Record<string, unknown>, ctx: ApiContext): unknown {
  switch (body.action) {
    case "ping":
      return { serverTime: ctx.now.toISOString() };
    case "list":
      return list(body, ctx);
    case "upsert":
      return upsert(body, ctx);
    case "remove":
      return remove(body, ctx);
    case "batch":
      return batch(body, ctx);
    case "renameCategory":
      return renameCategory(body, ctx);
    default:
      return fail("BAD_REQUEST", `Unknown action: ${String(body.action)}`);
  }
}

function requireTab(x: unknown): TabName {
  if (!isTabName(x)) fail("BAD_REQUEST", `Unknown tab: ${String(x)}`);
  return x as TabName;
}

function list(body: Record<string, unknown>, ctx: ApiContext) {
  if (!Array.isArray(body.tabs)) fail("BAD_REQUEST", "tabs must be a list");
  const tabs = (body.tabs as unknown[]).map(requireTab);
  if (tabs.includes("Transactions")) {
    // Hand-typed items need an ID before they can be charged.
    ctx.store.fillMissingIds("Recurring", ctx.newId);
    runRecurringCharges(ctx.store, todayTaipei(ctx.now), ctx.now);
  }
  const out: Record<string, Row[]> = {};
  for (const tab of tabs) {
    ctx.store.fillMissingIds(tab, ctx.newId);
    let rows = ctx.store.read(tab);
    if (tab === "Transactions") rows = rows.map((r) => (r.Source ? r : { ...r, Source: "manual" }));
    out[tab] = rows;
  }
  return out;
}

type PreparedRow = { tab: TabName; row: Row; isUpdate: boolean };

/**
 * Normalises and validates rows without writing anything, so a request with
 * one bad row leaves the Sheet untouched. `pending` carries rows prepared
 * earlier in the same request: they count for duplicate checks, and a second
 * copy of the same ID in one request stays one row.
 */
function prepareUpserts(tab: TabName, rawRows: unknown, ctx: ApiContext, pending: PreparedRow[]): PreparedRow[] {
  if (!Array.isArray(rawRows)) fail("BAD_REQUEST", "rows must be a list");
  const existing = ctx.store.read(tab);
  const out: PreparedRow[] = [];
  for (const raw of rawRows as Record<string, unknown>[]) {
    // The app always sends YYYY-MM-DD; reject anything else before normalising,
    // which would otherwise read "12/11/2026" as M/D.
    const rawDate = raw?.Date;
    if (rawDate !== undefined && rawDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(rawDate).trim())) {
      fail("BAD_REQUEST", "Date must be YYYY-MM-DD");
    }
    const row = normalizeRow(tab, raw ?? {});
    if (!row.ID) row.ID = ctx.newId();
    const earlier = [...pending, ...out].filter((p) => p.tab === tab);
    const prior = existing.find((r) => r.ID === row.ID);
    const isUpdate = !!prior || earlier.some((p) => p.row.ID === row.ID);
    if (TIMESTAMPED.includes(tab) && !row.CreatedAt) row.CreatedAt = prior?.CreatedAt ?? ctx.now.toISOString();
    // The app may save an item from a copy loaded before the last charge run;
    // moving ChargedThrough back would bring deleted charges back.
    if (tab === "Recurring") row.ChargedThrough = laterDate(prior?.ChargedThrough, row.ChargedThrough);
    const others = [...existing.filter((r) => !earlier.some((p) => p.row.ID === r.ID)), ...earlier.map((p) => p.row)];
    validate(tab, row, others);
    out.push({ tab, row, isUpdate });
  }
  return out;
}

function writePrepared(prepared: PreparedRow[], ctx: ApiContext) {
  for (const p of prepared) {
    if (p.isUpdate) ctx.store.update(p.tab, p.row);
    else ctx.store.append(p.tab, [p.row]);
  }
}

function upsert(body: Record<string, unknown>, ctx: ApiContext) {
  const tab = requireTab(body.tab);
  const prepared = prepareUpserts(tab, body.rows, ctx, []);
  writePrepared(prepared, ctx);
  return { rows: prepared.map((p) => p.row) };
}

const MAX_BATCH_OPS = 50;

/** Several upserts and removes in one request (a meal and its expense). Every row is checked before anything is written. */
function batch(body: Record<string, unknown>, ctx: ApiContext) {
  if (!Array.isArray(body.ops)) fail("BAD_REQUEST", "ops must be a list");
  const ops = body.ops as Record<string, unknown>[];
  if (ops.length > MAX_BATCH_OPS) fail("BAD_REQUEST", `A batch can have at most ${MAX_BATCH_OPS} changes`);

  type Step = { prepared: PreparedRow[] } | { tab: TabName; ids: string[] };
  const steps: Step[] = [];
  const allPrepared: PreparedRow[] = [];
  for (const op of ops) {
    const tab = requireTab(op?.tab);
    if (op.op === "upsert") {
      const prepared = prepareUpserts(tab, op.rows, ctx, allPrepared);
      allPrepared.push(...prepared);
      steps.push({ prepared });
    } else if (op.op === "remove") {
      if (!Array.isArray(op.ids)) fail("BAD_REQUEST", "ids must be a list");
      steps.push({ tab, ids: (op.ids as unknown[]).map(String) });
    } else {
      fail("BAD_REQUEST", `Unknown batch op: ${String(op.op)}`);
    }
  }

  // Writes happen in the order sent, only after every row passed validation.
  const saved: { tab: TabName; row: Row }[] = [];
  let removed = 0;
  for (const step of steps) {
    if ("prepared" in step) {
      writePrepared(step.prepared, ctx);
      saved.push(...step.prepared.map((p) => ({ tab: p.tab, row: p.row })));
    } else {
      removed += ctx.store.remove(step.tab, step.ids);
    }
  }
  return { saved, removed };
}

function laterDate(a: unknown, b: unknown): string | null {
  const ok = (v: unknown): v is string => typeof v === "string" && ISO_DATE.test(v);
  if (ok(a) && ok(b)) return a > b ? a : b;
  return ok(a) ? a : ok(b) ? b : null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isWhole = (v: unknown, min: number, max = Infinity) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

function validate(tab: TabName, row: Row, others: Row[]) {
  if (tab === "Recurring") {
    if (typeof row.Name !== "string" || !row.Name.trim()) fail("BAD_REQUEST", "Name is required");
    if (!isWhole(row.Amount, 1)) fail("BAD_REQUEST", "Amount must be a whole number above 0");
    if (row.Frequency === "weekly") {
      if (!isWhole(row.Weekday, 0, 6)) fail("BAD_REQUEST", "Weekday must be 0 (Sunday) to 6 (Saturday)");
    } else if (row.Frequency === "monthly") {
      if (!isWhole(row.MonthDay, 1, 31)) fail("BAD_REQUEST", "MonthDay must be 1 to 31");
    } else {
      fail("BAD_REQUEST", "Frequency must be weekly or monthly");
    }
    if (typeof row.StartDate !== "string" || !ISO_DATE.test(row.StartDate) || !parseSheetDate(row.StartDate)) {
      fail("BAD_REQUEST", "StartDate must be YYYY-MM-DD");
    }
  }
  if (tab === "Transactions") {
    if (row.Type !== "expense" && row.Type !== "income") fail("BAD_REQUEST", "Type must be expense or income");
    if (typeof row.Amount !== "number" || !Number.isInteger(row.Amount) || row.Amount <= 0) {
      fail("BAD_REQUEST", "Amount must be a whole number above 0");
    }
    if (typeof row.Date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.Date) || !parseSheetDate(row.Date)) {
      fail("BAD_REQUEST", "Date must be YYYY-MM-DD");
    }
  }
  if (tab === "Categories") {
    const name = typeof row.Name === "string" ? row.Name.trim() : "";
    if (!name) fail("BAD_REQUEST", "Category name is required");
    if (row.Type !== "expense" && row.Type !== "income") fail("BAD_REQUEST", "Category type must be expense or income");
    assertUniqueCategory(name, String(row.Type), String(row.ID), others);
  }
}

function assertUniqueCategory(name: string, type: string, id: string, categories: Row[]) {
  const clash = categories.some(
    (c) => c.ID !== id && c.Type === type && String(c.Name ?? "").trim().toLowerCase() === name.toLowerCase(),
  );
  if (clash) fail("CONFLICT", `A ${type} category named "${name}" already exists`);
}

function remove(body: Record<string, unknown>, ctx: ApiContext) {
  const tab = requireTab(body.tab);
  if (!Array.isArray(body.ids)) fail("BAD_REQUEST", "ids must be a list");
  return { removed: ctx.store.remove(tab, (body.ids as unknown[]).map(String)) };
}

function renameCategory(body: Record<string, unknown>, ctx: ApiContext) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) fail("BAD_REQUEST", "New name is required");
  const categories = ctx.store.read("Categories");
  const cat = categories.find((c) => c.ID === body.id);
  if (!cat) return fail("NOT_FOUND", "No such category");
  assertUniqueCategory(name, String(cat.Type), String(cat.ID), categories);
  const oldName = String(cat.Name);
  let updatedTransactions = 0;
  // Rows first (one bulk write per tab), the category itself last: if this is
  // cut short, the old name still exists and a retry finishes the job.
  for (const tab of CATEGORY_TABS) {
    const where = tab === "Transactions" ? { column: "Type", equals: String(cat.Type) } : undefined;
    const n = ctx.store.renameInColumn(tab, "Category", oldName, name, where);
    if (tab === "Transactions") updatedTransactions = n;
  }
  ctx.store.update("Categories", { ...cat, Name: name });
  return { updatedTransactions };
}
