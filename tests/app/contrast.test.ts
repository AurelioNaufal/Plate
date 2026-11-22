import { readFileSync } from "node:fs";

// Text must keep a WCAG contrast of 4.5:1 or better in both themes (spec §7.12).
const css = readFileSync("src/app/theme.css", "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const block = css.slice(start, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    expect(out[m[1]], `--${m[1]} is declared twice in ${selector}`).toBeUndefined();
    out[m[1]] = m[2];
  }
  return out;
}

const light = tokens(":root");
const dark = tokens(':root[data-theme="dark"]');
const darkAuto = tokens(':root:not([data-theme="light"])');

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const PAIRS: [string, string][] = [
  ["ink", "bg"], ["ink", "card"], ["muted", "card"], ["muted", "bg"], ["accent", "card"],
  ["danger", "card"], ["kcal", "card"], ["on-accent", "accent"],
];

describe.each([["light", light], ["dark", dark]] as const)("%s theme", (_name, t) => {
  test.each(PAIRS)("--%s on --%s is at least 4.5:1", (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

test("dark mode is the same whether it comes from the phone or the switch", () => {
  expect(darkAuto).toEqual(dark);
});
