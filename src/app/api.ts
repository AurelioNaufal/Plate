import type { Row, TabName } from "../shared/schema";

export type ApiConfig = { url: string; token: string };

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type Api = ReturnType<typeof createApi>;

export function createApi(cfg: ApiConfig, fetchImpl: typeof fetch = (...args) => fetch(...args)) {
  async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(cfg.url, {
        method: "POST",
        // text/plain keeps this a "simple" request: Apps Script can't answer a CORS preflight.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ token: cfg.token, action, ...payload }),
        redirect: "follow",
      });
    } catch {
      throw new ApiError("NETWORK", "Can't reach the server. Check your connection and try again.");
    }
    let body: { ok: boolean; data?: T; error?: { code?: string; message?: string } };
    try {
      body = await res.json();
    } catch {
      throw new ApiError("NETWORK", "The server sent an unexpected reply. Check the Web app URL in Settings.");
    }
    if (!body.ok) throw new ApiError(body.error?.code ?? "SERVER", body.error?.message ?? "Something went wrong on the server");
    return body.data as T;
  }

  return {
    ping: () => call<{ serverTime: string }>("ping"),
    list: (tabs: TabName[]) => call<Partial<Record<TabName, Row[]>>>("list", { tabs }),
    upsert: (tab: TabName, rows: Row[]) => call<{ rows: Row[] }>("upsert", { tab, rows }),
    remove: (tab: TabName, ids: string[]) => call<{ removed: number }>("remove", { tab, ids }),
    renameCategory: (id: string, name: string) => call<{ updatedTransactions: number }>("renameCategory", { id, name }),
  };
}
