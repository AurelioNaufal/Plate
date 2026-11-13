import type { Row, TabName } from "./schema";

/** One write the app wants the Sheet to make: upsert a row or remove one by ID. */
export type Change = { tab: TabName; row: Row } | { tab: TabName; removeId: string };

export function changeId(c: Change): string {
  return "row" in c ? String(c.row.ID) : c.removeId;
}

/** Applies changes to an in-memory copy of the tabs. Pure: the input is not modified. */
export function applyChanges(rows: Record<TabName, Row[]>, changes: Change[]): Record<TabName, Row[]> {
  const next = { ...rows };
  for (const c of changes) {
    const list = next[c.tab] ?? [];
    if ("row" in c) {
      const i = list.findIndex((r) => r.ID === c.row.ID);
      next[c.tab] = i >= 0 ? list.map((r, j) => (j === i ? c.row : r)) : [...list, c.row];
    } else {
      next[c.tab] = list.filter((r) => r.ID !== c.removeId);
    }
  }
  return next;
}
