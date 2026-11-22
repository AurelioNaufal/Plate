import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Api } from "./api";
import { TAB_NAMES, type Row, type TabName } from "../shared/schema";
import { applyChanges, changeId, type Change } from "../shared/changes";

type Status = "needs-setup" | "loading" | "ready" | "error";
type Rows = Record<TabName, Row[]>;
/** One request being sent, or one that failed. `id` is unique per request. */
type PendingOp = { id: string; tab: TabName; changes: Change[]; error?: string };

let requestCount = 0;
const requestId = () => `req${++requestCount}`;

export type DataState = {
  status: Status;
  loadError?: string;
  rows: Rows;
  pending: PendingOp[];
  save(tab: TabName, row: Row): Promise<void>;
  remove(tab: TabName, id: string): Promise<void>;
  /** Applies linked changes locally at once and sends them in one request. */
  apply(changes: Change[]): Promise<void>;
  retry(id: string): Promise<void>;
  reload(): void;
  /** Not optimistic: the server may refuse a duplicate name. */
  renameCategory(id: string, name: string): Promise<{ ok: true } | { ok: false; error: string }>;
};

const RENAME_TABS: TabName[] = ["Transactions", "Budgets", "Recurring"];

const emptyRows = (): Rows => Object.fromEntries(TAB_NAMES.map((t) => [t, []])) as unknown as Rows;

const DataContext = createContext<DataState | null>(null);

// Secure contexts only (HTTPS or localhost), which the app always runs in.
const newId = () => crypto.randomUUID();

export function DataProvider({ api, children }: { api: Api | null; children: ReactNode }) {
  const [status, setStatus] = useState<Status>(api ? "loading" : "needs-setup");
  const [loadError, setLoadError] = useState<string>();
  const [rows, setRows] = useState<Rows>(emptyRows);
  const [pending, setPending] = useState<PendingOp[]>([]);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    if (!api) {
      setStatus("needs-setup");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    api.list(TAB_NAMES).then(
      (data) => {
        if (cancelled) return;
        const next = emptyRows();
        for (const t of TAB_NAMES) next[t] = data[t] ?? [];
        setRows(next);
        setStatus("ready");
      },
      (e: Error) => {
        if (cancelled) return;
        setLoadError(e.message);
        setStatus("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [api, loadCount]);

  const settle = (id: string, error?: string) =>
    setPending((prev) => (error ? prev.map((p) => (p.id === id ? { ...p, error } : p)) : prev.filter((p) => p.id !== id)));

  // Requests go to the server one at a time, in the order they were made, so
  // a quick tick-then-untick can't arrive the other way round.
  const queue = useRef<Promise<void>>(Promise.resolve());
  // Each row's local version; a reply only updates rows nobody changed since
  // that request was made.
  const versions = useRef(new Map<string, number>());

  const send = useCallback(
    (op: PendingOp): Promise<void> => {
      if (!api) return Promise.resolve();
      setPending((prev) => [...prev.filter((p) => p.id !== op.id), { ...op, error: undefined }]);
      const sentAt = new Map(op.changes.map((c) => [changeId(c), versions.current.get(changeId(c)) ?? 0]));
      const run = async () => {
        try {
          const { saved } = await api.batch(op.changes);
          // The server fills in CreatedAt and the like; keep its copy unless
          // the row has been changed here since.
          const fresh = saved.filter((c) => (versions.current.get(changeId(c)) ?? 0) === (sentAt.get(changeId(c)) ?? 0));
          if (fresh.length) setRows((prev) => applyChanges(prev, fresh));
          settle(op.id);
        } catch (e) {
          settle(op.id, e instanceof Error ? e.message : String(e));
        }
      };
      const next = queue.current.then(run);
      queue.current = next;
      return next;
    },
    [api],
  );

  const apply = useCallback(
    async (changes: Change[]) => {
      if (changes.length === 0) return;
      const full = changes.map((c): Change => ("row" in c && !c.row.ID ? { ...c, row: { ...c.row, ID: newId() } } : c));
      for (const c of full) versions.current.set(changeId(c), (versions.current.get(changeId(c)) ?? 0) + 1);
      setRows((prev) => applyChanges(prev, full));
      // A failed earlier save of the same rows is superseded: retrying it
      // later would put the older values back over these.
      const ids = new Set(full.map(changeId));
      setPending((prev) => prev.filter((p) => !(p.error && p.changes.every((c) => ids.has(changeId(c))))));
      await send({ id: requestId(), tab: full[0].tab, changes: full });
    },
    [send],
  );

  const save = useCallback((tab: TabName, row: Row) => apply([{ tab, row }]), [apply]);
  const remove = useCallback((tab: TabName, id: string) => apply([{ tab, removeId: id }]), [apply]);

  const retry = useCallback(
    async (id: string) => {
      // By request ID, or by the row ID of a request's first change (the
      // latest such request).
      const op = pendingRef.current.find((p) => p.id === id) ?? [...pendingRef.current].reverse().find((p) => changeId(p.changes[0]) === id);
      if (op) await send(op);
    },
    [send],
  );

  const reload = useCallback(() => setLoadCount((n) => n + 1), []);

  const renameCategory = useCallback(
    async (id: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!api) return { ok: false, error: "Not connected" };
      try {
        await api.renameCategory(id, name);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      setRows((prev) => {
        const cat = prev.Categories.find((c) => c.ID === id);
        if (!cat) return prev;
        const next = { ...prev, Categories: prev.Categories.map((c) => (c.ID === id ? { ...c, Name: name } : c)) };
        for (const tab of RENAME_TABS) {
          next[tab] = prev[tab].map((r) =>
            r.Category === cat.Name && (tab !== "Transactions" || r.Type === cat.Type) ? { ...r, Category: name } : r,
          );
        }
        return next;
      });
      return { ok: true };
    },
    [api],
  );

  return (
    <DataContext.Provider value={{ status, loadError, rows, pending, save, remove, apply, retry, reload, renameCategory }}>{children}</DataContext.Provider>
  );
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
