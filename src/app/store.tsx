import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Api } from "./api";
import { TAB_NAMES, type Row, type TabName } from "../shared/schema";

type Status = "needs-setup" | "loading" | "ready" | "error";
type Rows = Record<TabName, Row[]>;
type PendingOp = { tab: TabName; id: string; op: "save" | "remove"; row?: Row; error?: string };

export type DataState = {
  status: Status;
  loadError?: string;
  rows: Rows;
  pending: PendingOp[];
  save(tab: TabName, row: Row): Promise<void>;
  remove(tab: TabName, id: string): Promise<void>;
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

  const putLocal = (tab: TabName, row: Row) =>
    setRows((prev) => {
      const list = prev[tab];
      const i = list.findIndex((r) => r.ID === row.ID);
      const next = i >= 0 ? list.map((r, j) => (j === i ? row : r)) : [...list, row];
      return { ...prev, [tab]: next };
    });

  const dropLocal = (tab: TabName, id: string) => setRows((prev) => ({ ...prev, [tab]: prev[tab].filter((r) => r.ID !== id) }));

  const settle = (id: string, error?: string) =>
    setPending((prev) => (error ? prev.map((p) => (p.id === id ? { ...p, error } : p)) : prev.filter((p) => p.id !== id)));

  const send = useCallback(
    async (op: PendingOp) => {
      if (!api) return;
      setPending((prev) => [...prev.filter((p) => p.id !== op.id), { ...op, error: undefined }]);
      try {
        if (op.op === "save" && op.row) {
          const { rows: saved } = await api.upsert(op.tab, [op.row]);
          if (saved[0]) putLocal(op.tab, saved[0]);
        } else {
          await api.remove(op.tab, [op.id]);
        }
        settle(op.id);
      } catch (e) {
        settle(op.id, e instanceof Error ? e.message : String(e));
      }
    },
    [api],
  );

  const save = useCallback(
    async (tab: TabName, row: Row) => {
      const full = { ...row, ID: row.ID ? String(row.ID) : newId() };
      putLocal(tab, full);
      await send({ tab, id: String(full.ID), op: "save", row: full });
    },
    [send],
  );

  const remove = useCallback(
    async (tab: TabName, id: string) => {
      dropLocal(tab, id);
      await send({ tab, id, op: "remove" });
    },
    [send],
  );

  const retry = useCallback(
    async (id: string) => {
      const op = pendingRef.current.find((p) => p.id === id);
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
    <DataContext.Provider value={{ status, loadError, rows, pending, save, remove, retry, reload, renameCategory }}>{children}</DataContext.Provider>
  );
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
