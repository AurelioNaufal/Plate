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
