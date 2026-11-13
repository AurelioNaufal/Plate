import type { SheetStore } from "./store";
import { normalizeRow } from "./store";
import { isTabName, type Row, type TabName } from "../shared/schema";
import { parseSheetDate } from "../shared/dates";

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
  const out: Record<string, Row[]> = {};
  for (const tab of tabs) {
    ctx.store.fillMissingIds(tab, ctx.newId);
    let rows = ctx.store.read(tab);
    if (tab === "Transactions") rows = rows.map((r) => (r.Source ? r : { ...r, Source: "manual" }));
    out[tab] = rows;
  }
  return out;
}

function upsert(body: Record<string, unknown>, ctx: ApiContext) {
  const tab = requireTab(body.tab);
  if (!Array.isArray(body.rows)) fail("BAD_REQUEST", "rows must be a list");
  const existing = ctx.store.read(tab);
  const saved: Row[] = [];
  for (const raw of body.rows as Record<string, unknown>[]) {
    // The app always sends YYYY-MM-DD; reject anything else before normalising,
    // which would otherwise read "12/11/2026" as M/D.
    const rawDate = raw?.Date;
    if (rawDate !== undefined && rawDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(rawDate).trim())) {
      fail("BAD_REQUEST", "Date must be YYYY-MM-DD");
    }
    const row = normalizeRow(tab, raw ?? {});
    if (!row.ID) row.ID = ctx.newId();
    const prior = existing.find((r) => r.ID === row.ID);
    if (TIMESTAMPED.includes(tab) && !row.CreatedAt) row.CreatedAt = prior?.CreatedAt ?? ctx.now.toISOString();
    validate(tab, row, [...existing, ...saved]);
    if (prior) ctx.store.update(tab, row);
    else ctx.store.append(tab, [row]);
    saved.push(row);
  }
  return { rows: saved };
}

function validate(tab: TabName, row: Row, others: Row[]) {
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
