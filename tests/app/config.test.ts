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
