// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { App } from "../../src/app/App";
import { todayTaipei, weekday } from "../../src/shared/dates";

const wd = weekday(todayTaipei());
const routines = vi.hoisted(() => ({ current: [] as Record<string, unknown>[] }));

vi.mock("../../src/app/config", () => ({
  loadConfig: () => ({ url: "https://example.test/api", token: "t" }),
  saveConfig: () => {},
  clearConfig: () => {},
}));
vi.mock("../../src/app/store", () => ({
  DataProvider: ({ children }: { children: ReactNode }) => children,
  useData: () => ({
    status: "ready", loadError: null, reload: () => {}, retry: () => {}, pending: [],
    rows: {
      Transactions: [], Categories: [], Meals: [], Settings: [], Workouts: [], Body: [],
      Exercises: [{ ID: "bench", Name: "Bench press", SortOrder: 1 }, { ID: "lat", Name: "Lat pulldown", SortOrder: 2 }],
      Routines: routines.current,
    },
    save: async () => {}, remove: async () => {}, apply: async () => {},
  }),
}));

const pullDraft = (done: boolean) => JSON.stringify({
  sessionId: "sp", date: todayTaipei(), routineId: "pull",
  exercises: [{ exerciseId: "lat", sets: [{ id: "x1", weight: "40", reps: "10", done }] }],
});

beforeEach(() => {
  localStorage.clear();
  // Neither routine falls on today, so both sit under "Other routines".
  routines.current = [
    { ID: "push", Name: "Push", Weekdays: String((wd + 1) % 7), ExerciseIDs: "bench" },
    { ID: "pull", Name: "Pull", Weekdays: String((wd + 2) % 7), ExerciseIDs: "lat" },
  ];
});

test("after opening Pull and leaving it untouched, Start Push opens Push", async () => {
  localStorage.setItem("plate.workoutDraft", pullDraft(false));
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Gym" }));
  await userEvent.click(screen.getByRole("button", { name: "Start Push" }));
  expect(screen.getByRole("region", { name: "Bench press" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Lat pulldown" })).toBeNull();
});

test("with Pull sets saved, Start Push asks, then opens Push", async () => {
  localStorage.setItem("plate.workoutDraft", pullDraft(true));
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Gym" }));
  await userEvent.click(within(screen.getByRole("region", { name: "Other routines" })).getByRole("button", { name: "Start Push" }));
  await userEvent.click(within(screen.getByRole("region", { name: "Switch workout" })).getByRole("button", { name: "Start Push" }));
  expect(screen.getByRole("region", { name: "Bench press" })).toBeInTheDocument();
});

test("Today's Start workout with another workout open goes to Gym's question", async () => {
  routines.current[0].Weekdays = String(wd);
  localStorage.setItem("plate.workoutDraft", pullDraft(true));
  render(<App />);
  await userEvent.click(within(screen.getByRole("region", { name: "Today's workout" })).getByRole("button", { name: "Start workout" }));
  expect(screen.getByRole("region", { name: "Switch workout" })).toHaveTextContent("Start Push instead?");
});
