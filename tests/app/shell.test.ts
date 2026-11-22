import { readFileSync } from "node:fs";

// The installed app should feel like an app, not a web page: no pinch or
// double-tap zoom, and nothing wider than the screen.
const html = readFileSync("index.html", "utf8");
const css = readFileSync("src/app/theme.css", "utf8");

test("the viewport can't be zoomed", () => {
  const viewport = /<meta name="viewport" content="([^"]+)"/.exec(html)?.[1] ?? "";
  expect(viewport).toContain("maximum-scale=1");
  expect(viewport).toContain("user-scalable=no");
});

test("the page never scrolls sideways and taps don't double-tap zoom", () => {
  expect(css).toMatch(/html, body \{[^}]*overflow-x: hidden/);
  expect(css).toMatch(/touch-action: manipulation/);
});

test("form fields are at least 16px so focusing one doesn't zoom the page", () => {
  expect(css).toMatch(/\.field input, \.field select \{[^}]*font-size: 16px/);
});

test("big numbers in half-width cards shrink on a narrow screen instead of spilling over", () => {
  expect(css).toMatch(/\.stat-value \{[^}]*font-size: clamp\(/);
});

test("table numbers are never cut off with an ellipsis", () => {
  const cells = /\.data-table th, \.data-table td \{([^}]*)\}/.exec(css)?.[1] ?? "";
  expect(cells).not.toContain("ellipsis");
  expect(cells).toContain("padding-left");
});

test("the remembered theme is applied by an inline script before the app loads", () => {
  const inline = html.indexOf("plate.theme");
  expect(inline).toBeGreaterThan(-1);
  expect(inline).toBeLessThan(html.indexOf('src="/src/app/main.tsx"'));
});
