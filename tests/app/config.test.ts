// @vitest-environment jsdom
import { loadConfig, saveConfig, clearConfig } from "../../src/app/config";

test("an empty URL or token counts as no connection", () => {
  saveConfig({ url: "", token: "" });
  expect(loadConfig()).toBeNull();
  saveConfig({ url: "https://x/exec", token: " " });
  expect(loadConfig()).toBeNull();
});

test("clearConfig forgets the connection", () => {
  saveConfig({ url: "https://x/exec", token: "t" });
  clearConfig();
  expect(loadConfig()).toBeNull();
});

afterEach(() => vi.restoreAllMocks());

test("a saved connection round-trips", () => {
  saveConfig({ url: "https://x/exec", token: "t" });
  expect(loadConfig()).toEqual({ url: "https://x/exec", token: "t" });
});

test("blocked storage reads as no connection instead of crashing", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("SecurityError");
  });
  expect(loadConfig()).toBeNull();
});

test("a corrupt saved value reads as no connection", () => {
  localStorage.setItem("financeapp.config", "{oops");
  expect(loadConfig()).toBeNull();
});

test("saving a connection asks the browser to keep this app's storage", () => {
  const persist = vi.fn(async () => true);
  Object.defineProperty(navigator, "storage", { value: { persist }, configurable: true });
  saveConfig({ url: "https://x/exec", token: "t" });
  expect(persist).toHaveBeenCalled();
});
