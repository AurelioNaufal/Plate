import type { Row } from "../shared/schema";
import { getSetting } from "../shared/meals";

export type ThemeChoice = "auto" | "light" | "dark";
const KEY = "plate.theme";
const isChoice = (v: unknown): v is ThemeChoice => v === "auto" || v === "light" || v === "dark";

/** The choice this device remembers (read before first paint); "auto" when none or unreadable. */
export function initialTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return isChoice(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

/** Light or dark forces the theme; auto follows the phone. Remembered on this device. */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  // The status bar follows too: a forced theme sets both theme-color tags; auto puts them back.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (!meta.dataset.auto) meta.dataset.auto = meta.content;
    meta.content = choice === "auto" ? meta.dataset.auto : choice === "dark" ? "#0E1013" : "#F4F5F7";
  }
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}

/** The theme Setting in the Sheet (set on any device) wins over this device's memory. */
export function syncTheme(settings: Row[]): void {
  const saved = getSetting(settings, "theme");
  if (isChoice(saved) && saved !== initialTheme()) applyTheme(saved);
}
