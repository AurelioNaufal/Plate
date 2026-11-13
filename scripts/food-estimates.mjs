// Builds the FoodEstimates table from a CSV export of the old ledger:
//   node scripts/food-estimates.mjs <ledger.csv> <out.csv> [overrides.csv]
// One row per distinct Food description (case-insensitive; first spelling kept)
// with how often it was bought, the usual price, and a rough kcal/protein guess
// from the generic keyword table below. An optional overrides CSV (same
// columns: Description,Kcal,Protein,SavedFood) replaces guesses by hand.
// The output holds personal data: write it under private/ (git-ignored).
import { readFileSync, writeFileSync } from "node:fs";

// Generic foods only: [keyword, kcal, protein g, fixed item?]. A "fixed" item
// is the same thing every time (a packaged snack), so it can be a saved food.
// The longest matching keyword wins.
const KEYWORDS = [
  ["prasmanan", 650, 30, false], ["buffet", 650, 30, false], ["bento", 700, 28, false], ["lunch box", 700, 28, false],
  ["fried rice", 650, 18, false], ["chicken rice", 600, 28, false], ["rice", 450, 12, false], ["congee", 300, 10, false], ["porridge", 300, 10, false],
  ["beef noodle", 650, 30, false], ["noodle", 550, 18, false], ["ramen", 600, 22, false], ["pasta", 650, 22, false], ["spaghetti", 650, 22, false],
  ["udon", 450, 14, false], ["pho", 450, 25, false], ["dumpling", 450, 18, false], ["bao", 250, 8, false], ["bun", 250, 7, false],
  ["fried chicken", 550, 32, false], ["chicken cutlet", 450, 30, false], ["katsu", 600, 28, false], ["chicken", 450, 30, false],
  ["pork", 550, 25, false], ["beef", 600, 30, false], ["fish", 400, 25, false], ["salmon", 450, 28, false], ["tuna", 300, 20, false],
  ["egg", 150, 12, false], ["tofu", 200, 14, false], ["salad", 250, 8, false], ["soup", 200, 8, false], ["hot pot", 800, 40, false], ["hotpot", 800, 40, false],
  ["burger", 550, 25, false], ["sandwich", 350, 15, false], ["toast", 250, 8, false], ["bread", 250, 8, false], ["pizza", 700, 28, false],
  ["fries", 350, 4, false], ["kebab", 600, 30, false], ["taco", 450, 18, false], ["curry", 700, 22, false], ["sushi", 450, 18, false],
  ["onigiri", 200, 5, true], ["rice ball", 200, 5, true], ["milk tea", 350, 3, true], ["bubble tea", 350, 3, true], ["boba", 350, 3, true],
  ["milk", 150, 8, true], ["soy milk", 130, 7, true], ["yogurt", 120, 6, true], ["protein bar", 200, 20, true], ["protein shake", 150, 25, true],
  ["coffee", 120, 3, true], ["latte", 180, 8, true], ["tea", 80, 0, true], ["juice", 150, 1, true], ["soda", 150, 0, true], ["cola", 150, 0, true], ["water", 0, 0, true],
  ["snack", 250, 3, false], ["chips", 250, 3, true], ["cookie", 200, 2, true], ["cake", 350, 5, false], ["ice cream", 250, 4, true], ["dessert", 300, 4, false],
  ["fruit", 100, 1, false], ["banana", 100, 1, true], ["apple", 90, 0, true], ["chocolate", 220, 3, true], ["cereal", 200, 6, true], ["oat", 250, 9, false],
];

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const key = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const amount = (s) => {
  const n = Number(String(s).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

function guess(k) {
  let best = null;
  for (const entry of KEYWORDS) if (k.includes(entry[0]) && (!best || entry[0].length > best[0].length)) best = entry;
  return best;
}

const [ledgerPath, outPath, overridesPath] = process.argv.slice(2);
if (!ledgerPath || !outPath) {
  console.error("Usage: node scripts/food-estimates.mjs <ledger.csv> <out.csv> [overrides.csv]");
  process.exit(1);
}

const rows = parseCsv(readFileSync(ledgerPath, "utf8").replace(/^﻿/, ""));
// The expenses block is the first Date | Amount | Description | Category run of headers.
let headerRow = -1, col = -1;
for (let r = 0; r < rows.length && headerRow < 0; r++) {
  const line = rows[r].map((c) => c.trim());
  for (let c = 0; c + 3 < line.length; c++) {
    if (line[c] === "Date" && line[c + 1] === "Amount" && line[c + 2] === "Description" && line[c + 3] === "Category") {
      headerRow = r; col = c; break;
    }
  }
}
if (headerRow < 0) {
  console.error("Couldn't find the Date / Amount / Description / Category headers.");
  process.exit(1);
}

const groups = new Map();
for (const line of rows.slice(headerRow + 1)) {
  const [date, amt, desc, cat] = line.slice(col, col + 4).map((c) => (c ?? "").trim());
  if (!date || cat.toLowerCase() !== "food") continue;
  const name = desc || "Food";
  const k = key(name);
  const g = groups.get(k) ?? { name: name.replace(/\s+/g, " "), times: 0, prices: new Map() };
  g.times++;
  const a = amount(amt);
  if (a !== null) g.prices.set(a, (g.prices.get(a) ?? 0) + 1);
  groups.set(k, g);
}

const overrides = new Map();
if (overridesPath) {
  const o = parseCsv(readFileSync(overridesPath, "utf8").replace(/^﻿/, ""));
  const h = o[0].map((x) => x.trim().toLowerCase());
  for (const line of o.slice(1)) {
    const d = (line[h.indexOf("description")] ?? "").trim();
    if (d) overrides.set(key(d), { kcal: line[h.indexOf("kcal")] ?? "", protein: line[h.indexOf("protein")] ?? "", saved: line[h.indexOf("savedfood")] ?? "" });
  }
}

const out = [["Description", "Times", "UsualPrice", "Kcal", "Protein", "SavedFood"]];
let guessed = 0, blank = 0;
for (const [k, g] of [...groups].sort((a, b) => b[1].times - a[1].times || a[0].localeCompare(b[0]))) {
  const usual = [...g.prices].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? "";
  const hit = guess(k);
  let kcal = hit ? hit[1] : "", protein = hit ? hit[2] : "", saved = hit && hit[3] && g.times >= 5 ? "TRUE" : "";
  const o = overrides.get(k);
  if (o) { kcal = o.kcal.trim(); protein = o.protein.trim(); saved = o.saved.trim(); }
  if (kcal === "" && protein === "") blank++; else guessed++;
  out.push([g.name, g.times, usual, kcal, protein, saved]);
}

writeFileSync(outPath, "﻿" + out.map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
console.log(`${groups.size} distinct Food descriptions → ${outPath} (${guessed} with estimates, ${blank} blank)`);
