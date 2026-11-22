// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { ExerciseProgress } from "../../src/app/screens/ExerciseProgress";
import type { Row } from "../../src/shared/schema";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

const set = (ID: string, SessionID: string, Date: string, ExerciseID: string, SetNumber: number, WeightKg: number | null, Reps: number): Row => ({
  ID, SessionID, Date, ExerciseID, SetNumber, WeightKg, Reps, Done: true,
});

beforeEach(() => {
  data.current = {
    rows: {
      Exercises: [{ ID: "bench", Name: "Bench press" }, { ID: "abs", Name: "Abs" }, { ID: "curl", Name: "Bicep curl" }],
      Workouts: [
        set("1", "s1", "2026-11-16", "bench", 1, 40, 10),
        set("2", "s1", "2026-11-16", "bench", 2, 45, 8),
        set("3", "s2", "2026-11-19", "bench", 1, 45, 8),
        set("4", "s2", "2026-11-19", "bench", 2, 47.5, 6),
        set("5", "s1", "2026-11-16", "abs", 1, null, 15),
        set("6", "s2", "2026-11-19", "abs", 1, null, 20),
      ],
    },
  };
});

test("a weighted exercise charts its best set per workout", () => {
  const { container } = render(<ExerciseProgress exerciseId="bench" onBack={() => {}} />);
  expect(screen.getByRole("heading", { name: "Bench press" })).toBeInTheDocument();
  expect(screen.getByText("Best: 47.5 kg")).toBeInTheDocument();
  expect(container.querySelectorAll("circle[data-point]")).toHaveLength(2);
  const history = within(screen.getByRole("list", { name: "History" })).getAllByRole("listitem");
  expect(history.map((li) => li.textContent)).toEqual(["Thu 19 Nov · 45×8, 47.5×6", "Mon 16 Nov · 40×10, 45×8"]);
});

test("a bodyweight exercise is tracked by reps", () => {
  render(<ExerciseProgress exerciseId="abs" onBack={() => {}} />);
  expect(screen.getByText("Best: 20 reps")).toBeInTheDocument();
  expect(screen.getByText("Mon 16 Nov · ×15")).toBeInTheDocument();
});

test("an exercise never done says so", () => {
  render(<ExerciseProgress exerciseId="curl" onBack={() => {}} />);
  expect(screen.getByText("No sets logged yet")).toBeInTheDocument();
});
