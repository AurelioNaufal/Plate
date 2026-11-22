// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { App } from "../../src/app/App";
import { realWeek } from "../fixtures/week";

vi.mock("../../src/app/config", () => ({
  loadConfig: () => ({ url: "https://example.test/api", token: "t" }),
  saveConfig: () => {},
  clearConfig: () => {},
}));
vi.mock("../../src/app/store", () => ({
  DataProvider: ({ children }: { children: ReactNode }) => children,
  useData: () => ({
    status: "ready",
    loadError: null,
    reload: () => {},
    retry: () => {},
    pending: [],
    rows: { Transactions: realWeek, Categories: [], Meals: [], Settings: [], Workouts: [], Exercises: [], Routines: [], Body: [] },
    save: async () => {},
    remove: async () => {},
    apply: async () => {},
  }),
}));

test("Money keeps its period while a category is open", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Money" }));
  await userEvent.click(within(screen.getByRole("tablist", { name: "Period" })).getByRole("tab", { name: "Year" }));
  await userEvent.click(within(screen.getByRole("region", { name: "Expense categories" })).getByRole("button", { name: /Food/ }));

  expect(screen.getByRole("heading", { name: "Food" })).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Category total" })).getByText("2026")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /Back/ }));
  expect(within(screen.getByRole("tablist", { name: "Period" })).getByRole("tab", { name: "Year" })).toHaveAttribute("aria-selected", "true");
});
