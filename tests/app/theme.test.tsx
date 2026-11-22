// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { applyTheme, initialTheme, syncTheme } from "../../src/app/theme";
import { Appearance } from "../../src/app/screens/Appearance";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

test("applyTheme sets the page theme and remembers it; auto follows the phone", () => {
  applyTheme("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("plate.theme")).toBe("dark");
  applyTheme("auto");
  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(initialTheme()).toBe("auto");
});

test("initialTheme reads the remembered choice; anything odd is auto", () => {
  localStorage.setItem("plate.theme", "light");
  expect(initialTheme()).toBe("light");
  localStorage.setItem("plate.theme", "purple");
  expect(initialTheme()).toBe("auto");
});

test("a theme saved in the Sheet (from another device) wins over this phone's memory", () => {
  localStorage.setItem("plate.theme", "auto");
  syncTheme([{ ID: "theme", Value: "dark" }]);
  expect(document.documentElement.dataset.theme).toBe("dark");
  syncTheme([]);
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("the Appearance switch saves the choice and applies it at once", async () => {
  const save = vi.fn(async () => {});
  data.current = { rows: { Settings: [] }, save };
  render(<Appearance onBack={() => {}} />);
  const tabs = within(screen.getByRole("tablist", { name: "Theme" }));
  expect(tabs.getByRole("tab", { name: "Auto" })).toHaveAttribute("aria-selected", "true");
  await userEvent.click(tabs.getByRole("tab", { name: "Light" }));
  expect(save).toHaveBeenCalledWith("Settings", { ID: "theme", Value: "light" });
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(tabs.getByRole("tab", { name: "Light" })).toHaveAttribute("aria-selected", "true");
});

test("Appearance shows the Sheet's theme even when this phone remembers nothing", () => {
  data.current = { rows: { Settings: [{ ID: "theme", Value: "dark" }] }, save: vi.fn() };
  render(<Appearance onBack={() => {}} />);
  expect(within(screen.getByRole("tablist", { name: "Theme" })).getByRole("tab", { name: "Dark" })).toHaveAttribute("aria-selected", "true");
});

test("the status bar colour follows a forced theme, and goes back for auto", () => {
  document.head.innerHTML = '<meta name="theme-color" content="#F4F5F7" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0E1013" media="(prefers-color-scheme: dark)">';
  applyTheme("dark");
  expect([...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute("content"))).toEqual(["#0E1013", "#0E1013"]);
  applyTheme("auto");
  expect([...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute("content"))).toEqual(["#F4F5F7", "#0E1013"]);
});
