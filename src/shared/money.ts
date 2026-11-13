// Amounts are whole New Taiwan dollars.

/** Parses a value as the old Sheet displays it: "$3,640.00", "NT$80", 80. */
export function parseSheetAmount(s: string | number): number | null {
  if (typeof s === "number") return Number.isInteger(s) && s > 0 ? s : null;
  const cleaned = s.trim().replace(/^NT\$|^\$/i, "").replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export type AmountInput = { ok: true; value: number } | { ok: false; error: string };

/** Parses what the owner types into an amount field. */
export function parseAmountInput(s: string): AmountInput {
  const cleaned = s.trim().replace(/,/g, "");
  if (cleaned === "") return { ok: false, error: "Enter an amount" };
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { ok: false, error: "Amount must be a number" };
  const n = Number(cleaned);
  if (!Number.isInteger(n)) return { ok: false, error: "Use whole NT$ (no cents)" };
  if (n <= 0) return { ok: false, error: "Amount must be more than 0" };
  return { ok: true, value: n };
}

export function formatNT(n: number): string {
  return `NT$${Math.round(n).toLocaleString("en-US")}`;
}
