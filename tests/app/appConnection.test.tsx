// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { App } from "../../src/app/App";
import { loadConfig, saveConfig } from "../../src/app/config";

const state = vi.hoisted(() => ({ status: "error", rows: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({
  DataProvider: ({ children }: { children: ReactNode }) => children,
  useData: () => ({
    status: state.status, loadError: "Can't reach the server.", reload: () => {}, retry: () => {}, pending: [],
    rows: state.rows, save: async () => {}, remove: async () => {}, apply: async () => {},
  }),
}));

beforeEach(() => {
  localStorage.clear();
  saveConfig({ url: "https://script.example/exec", token: "secret-token" });
  state.status = "error";
  state.rows = {};
});

test("Change connection opens the settings filled in, and forgets nothing", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Change connection" }));
  expect(screen.getByDisplayValue("https://script.example/exec")).toBeInTheDocument();
  expect(loadConfig()).toEqual({ url: "https://script.example/exec", token: "secret-token" });
});

test("a screen that crashes shows a way back instead of a blank app, and keeps the connection", () => {
  state.status = "ready";
  // Data the screens can't read makes drawing throw.
  state.rows = null as unknown as Record<string, unknown>;
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<App />);
  expect(screen.getByText("Something went wrong on this screen.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  expect(loadConfig()).not.toBeNull();
  errors.mockRestore();
});
