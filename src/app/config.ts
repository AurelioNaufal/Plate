import type { ApiConfig } from "./api";

const KEY = "financeapp.config";

/** The Web app URL and token live only on this device. */
export function loadConfig(): ApiConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    const usable = typeof cfg?.url === "string" && typeof cfg?.token === "string" && cfg.url.trim() !== "" && cfg.token.trim() !== "";
    return usable ? cfg : null;
  } catch {
    return null;
  }
}

export function clearConfig(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing saved to forget.
  }
}

export function saveConfig(cfg: ApiConfig): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
    // Ask the browser not to clear this app's storage (Safari otherwise may after a week unused).
    void navigator.storage?.persist?.().catch(() => {});
    return true;
  } catch {
    return false;
  }
}
