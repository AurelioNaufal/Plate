import { useState } from "react";
import { createApi, type ApiConfig } from "../api";

type Props = {
  config: ApiConfig | null;
  onSave(cfg: ApiConfig): void;
  onOpenCategories?(): void;
};

export function Settings({ config, onSave, onOpenCategories }: Props) {
  const [url, setUrl] = useState(config?.url ?? "");
  const [token, setToken] = useState(config?.token ?? "");
  const [check, setCheck] = useState<{ state: "idle" | "checking" | "ok" | "error"; message?: string }>({ state: "idle" });

  const cfg = { url: url.trim(), token: token.trim() };
  const complete = cfg.url.startsWith("https://") && cfg.token.length > 0;

  async function test() {
    setCheck({ state: "checking" });
    try {
      await createApi(cfg).ping();
      setCheck({ state: "ok" });
    } catch (e) {
      setCheck({ state: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>Settings</h1>
      </header>

      <section className="card" aria-labelledby="conn">
        <h2 id="conn">Connection to your Google Sheet</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Paste the Web app URL and token from the setup guide. They are saved only on this device.
        </p>
        <label className="field">
          Web app URL
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" inputMode="url" autoComplete="off" />
        </label>
        <label className="field">
          Token
          <input value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="off" />
        </label>
        <div className="row-between">
          <button className="btn btn-secondary" onClick={test} disabled={!complete || check.state === "checking"}>
            {check.state === "checking" ? "Testing…" : "Test connection"}
          </button>
          <span role="status" className="small" style={{ fontWeight: 600, color: check.state === "error" ? "var(--danger)" : "var(--accent)" }}>
            {check.state === "ok" && "✓ Connected"}
            {check.state === "error" && check.message}
          </span>
        </div>
        <button className="btn btn-primary" disabled={!complete} onClick={() => onSave(cfg)}>
          Save
        </button>
      </section>

      {onOpenCategories && (
        <section className="card">
          <button className="list-row" onClick={onOpenCategories}>
            <span>Categories</span>
            <span className="muted">›</span>
          </button>
        </section>
      )}
    </main>
  );
}
