// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Gym } from "../../src/app/screens/Gym";
import type { Row } from "../../src/shared/schema";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

const exercises: Row[] = [
  { ID: "bench", Name: "Bench press", MuscleGroup: "Chest", SortOrder: 2 },
  { ID: "lat", Name: "Lat pulldown", MuscleGroup: "Back", SortOrder: 1 },
  { ID: "tricep", Name: "Tricep", MuscleGroup: "Arms", SortOrder: 3 },
  { ID: "abs", Name: "Abs", MuscleGroup: "Core", SortOrder: 4 },
  { ID: "incline", Name: "Incline bench press", MuscleGroup: "Chest", SortOrder: 5 },
  { ID: "shoulder", Name: "Shoulder press", MuscleGroup: "Shoulders", SortOrder: 6 },
  { ID: "pec", Name: "Pec deck (chest)", MuscleGroup: "Chest", SortOrder: 7 },
];
const routines: Row[] = [
  { ID: "push", Name: "Push", Weekdays: "1,4", ExerciseIDs: "bench,incline,shoulder,pec,tricep" },
  { ID: "pull", Name: "Pull", Weekdays: "2,5", ExerciseIDs: "lat" },
  { ID: "any", Name: "Anytime", Weekdays: "", ExerciseIDs: "abs" },
];
const w = (ID: string, ExerciseID: string, SetNumber: number): Row => ({ ID, SessionID: "s1", Date: "2026-11-16", ExerciseID, SetNumber, WeightKg: 40, Reps: 10, Done: true });
const workouts: Row[] = [w("1", "bench", 1), w("2", "bench", 2), w("3", "bench", 3), w("4", "tricep", 1), w("5", "tricep", 2), w("6", "tricep", 3)];

beforeEach(() => {
  localStorage.clear();
  data.current = { rows: { Exercises: exercises, Routines: routines, Workouts: workouts } };
});

const props = (over: Partial<Parameters<typeof Gym>[0]> = {}) => ({
  today: "2026-11-16", onStart: vi.fn(), onResume: vi.fn(), onOpenExercise: vi.fn(), onEditSession: vi.fn(), ...over,
});

test("on Monday, Push is today's routine and Start starts it", async () => {
  const p = props();
  render(<Gym {...p} />);
  const today = within(screen.getByRole("region", { name: "Today's workout" }));
  expect(today.getByText("Push")).toBeInTheDocument();
  expect(today.getByText("5 exercises")).toBeInTheDocument();
  await userEvent.click(today.getByRole("button", { name: "Start workout" }));
  expect(p.onStart).toHaveBeenCalledWith("push");
});

test("on Sunday there's no routine and a blank workout can be started", async () => {
  const p = props({ today: "2026-11-22" });
  render(<Gym {...p} />);
  expect(screen.getByText("No routine today")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Start blank workout" }));
  expect(p.onStart).toHaveBeenCalledWith(null);
});

test("other routines can be started any day; Anytime isn't one of them", async () => {
  const p = props();
  render(<Gym {...p} />);
  const others = within(screen.getByRole("region", { name: "Other routines" }));
  expect(others.queryByText("Anytime")).not.toBeInTheDocument();
  await userEvent.click(others.getByRole("button", { name: "Start Pull" }));
  expect(p.onStart).toHaveBeenCalledWith("pull");
});

test("recent sessions show the day, exercises and set count, and can be opened to edit", async () => {
  const p = props();
  render(<Gym {...p} />);
  const recent = within(screen.getByRole("region", { name: "Recent workouts" }));
  const row = recent.getByRole("button", { name: /Mon 16 Nov/ });
  expect(row).toHaveTextContent("Mon 16 Nov · Bench press, Tricep · 6 sets");
  await userEvent.click(row);
  expect(recent.getByText("Bench press: 40×10 · 40×10 · 40×10")).toBeInTheDocument();
  await userEvent.click(recent.getByRole("button", { name: "Edit this workout" }));
  expect(p.onEditSession).toHaveBeenCalledWith("s1");
});

test("an unfinished workout on this phone can be continued", async () => {
  localStorage.setItem("plate.workoutDraft", JSON.stringify({ sessionId: "s9", date: "2026-11-16", routineId: "push", exercises: [] }));
  const p = props();
  render(<Gym {...p} />);
  await userEvent.click(screen.getByRole("button", { name: "Continue workout" }));
  expect(p.onResume).toHaveBeenCalled();
});

test("exercises link to their progress", async () => {
  const p = props();
  render(<Gym {...p} />);
  const list = within(screen.getByRole("region", { name: "Exercises" }));
  expect(list.getAllByRole("button")[0]).toHaveTextContent("Lat pulldown");
  await userEvent.click(list.getByRole("button", { name: /Bench press/ }));
  expect(p.onOpenExercise).toHaveBeenCalledWith("bench");
});

test("an unfinished workout from an earlier day says so and can be finished", async () => {
  localStorage.setItem("plate.workoutDraft", JSON.stringify({ sessionId: "s9", date: "2026-11-12", routineId: "push", exercises: [] }));
  render(<Gym {...props()} />);
  expect(screen.getByText("Unfinished workout from Thu 12 Nov")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Finish it" }));
  expect(screen.queryByText("Unfinished workout from Thu 12 Nov")).not.toBeInTheDocument();
  expect(localStorage.getItem("plate.workoutDraft")).toBeNull();
});

test("an old workout can't be edited while today's is in progress", async () => {
  localStorage.setItem("plate.workoutDraft", JSON.stringify({ sessionId: "s9", date: "2026-11-16", routineId: "push", exercises: [] }));
  const p = props();
  render(<Gym {...p} />);
  const recent = within(screen.getByRole("region", { name: "Recent workouts" }));
  await userEvent.click(recent.getByRole("button", { name: /Mon 16 Nov/ }));
  expect(recent.getByRole("button", { name: "Edit this workout" })).toBeDisabled();
  expect(recent.getByText("Finish today's workout first.")).toBeInTheDocument();
});

describe("starting another routine while one is open", () => {
  const pullDraft = (done: boolean) => ({
    sessionId: "sp", date: "2026-11-16", routineId: "pull",
    exercises: [{ exerciseId: "lat", sets: [{ id: "x1", weight: "40", reps: "10", done }, { id: "x2", weight: "", reps: "", done: false }] }],
  });

  test("the open workout is named", () => {
    localStorage.setItem("plate.workoutDraft", JSON.stringify(pullDraft(true)));
    render(<Gym {...props()} />);
    expect(within(screen.getByRole("region", { name: "Unfinished workout" })).getByText("Pull in progress")).toBeInTheDocument();
  });

  test("with saved sets it asks first; Start Push then replaces it", async () => {
    localStorage.setItem("plate.workoutDraft", JSON.stringify(pullDraft(true)));
    const p = props();
    render(<Gym {...p} />);
    await userEvent.click(within(screen.getByRole("region", { name: "Today's workout" })).getByRole("button", { name: "Start workout" }));
    expect(p.onStart).not.toHaveBeenCalled();
    const ask = within(screen.getByRole("region", { name: "Switch workout" }));
    expect(ask.getByText("Your Pull workout has 1 saved set. Start Push instead?")).toBeInTheDocument();
    await userEvent.click(ask.getByRole("button", { name: "Start Push" }));
    expect(p.onStart).toHaveBeenCalledWith("push", true);
  });

  test("Keep Pull leaves it alone", async () => {
    localStorage.setItem("plate.workoutDraft", JSON.stringify(pullDraft(true)));
    const p = props();
    render(<Gym {...p} />);
    await userEvent.click(within(screen.getByRole("region", { name: "Today's workout" })).getByRole("button", { name: "Start workout" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep Pull" }));
    expect(screen.queryByRole("region", { name: "Switch workout" })).toBeNull();
    expect(p.onStart).not.toHaveBeenCalled();
  });

  test("with nothing saved it just starts the one tapped", async () => {
    localStorage.setItem("plate.workoutDraft", JSON.stringify(pullDraft(false)));
    const p = props();
    render(<Gym {...p} />);
    await userEvent.click(within(screen.getByRole("region", { name: "Today's workout" })).getByRole("button", { name: "Start workout" }));
    expect(p.onStart).toHaveBeenCalledWith("push");
  });

  test("a question sent from Today shows straight away", () => {
    localStorage.setItem("plate.workoutDraft", JSON.stringify(pullDraft(true)));
    render(<Gym {...props({ asking: "push" })} />);
    expect(screen.getByRole("region", { name: "Switch workout" })).toHaveTextContent("Start Push instead?");
  });
});

describe("stage 3 review fixes", () => {
  const draftFor = (routineId: string | null, extra: Record<string, unknown> = {}) => ({
    sessionId: "sx", date: "2026-11-16", routineId,
    exercises: [{ exerciseId: "lat", sets: [{ id: "y1", weight: "40", reps: "10", done: true }, { id: "y2", weight: "45", reps: "8", done: true }] }],
    ...extra,
  });

  test("a blank workout sent from Today asks too", () => {
    localStorage.setItem("plate.workoutDraft", JSON.stringify(draftFor("push")));
    render(<Gym {...props({ asking: null })} />);
    const ask = screen.getByRole("region", { name: "Switch workout" });
    expect(ask).toHaveTextContent("Your Push workout has 2 saved sets. Start a blank workout instead?");
  });

  test("an open blank workout reads naturally in the question", async () => {
    localStorage.setItem("plate.workoutDraft", JSON.stringify(draftFor(null)));
    render(<Gym {...props()} />);
    await userEvent.click(within(screen.getByRole("region", { name: "Today's workout" })).getByRole("button", { name: "Start workout" }));
    expect(screen.getByRole("region", { name: "Switch workout" })).toHaveTextContent("Your blank workout has 2 saved sets. Start Push instead?");
  });

  test("the question's buttons are stacked full width, so long names never overlap", async () => {
    localStorage.setItem("plate.workoutDraft", JSON.stringify(draftFor("pull")));
    render(<Gym {...props()} />);
    await userEvent.click(within(screen.getByRole("region", { name: "Today's workout" })).getByRole("button", { name: "Start workout" }));
    const keep = within(screen.getByRole("region", { name: "Switch workout" })).getByRole("button", { name: "Keep Pull" });
    expect(keep.parentElement).toHaveClass("stack");
  });

  test("an edit of a finished workout is labelled, and Start opens a new workout instead of adding to it", async () => {
    localStorage.setItem("plate.workoutDraft", JSON.stringify(draftFor(null, { editing: true })));
    const p = props();
    render(<Gym {...p} />);
    expect(within(screen.getByRole("region", { name: "Unfinished workout" })).getByText("Editing a finished workout")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("region", { name: "Today's workout" })).getByRole("button", { name: "Start workout" }));
    expect(screen.queryByRole("region", { name: "Switch workout" })).toBeNull();
    expect(p.onStart).toHaveBeenCalledWith("push");
  });
});

test("the question names typed numbers when nothing is saved yet", async () => {
  localStorage.setItem("plate.workoutDraft", JSON.stringify({
    sessionId: "sp", date: "2026-11-16", routineId: "pull",
    exercises: [{ exerciseId: "lat", sets: [{ id: "x1", weight: "42", reps: "10", done: false, edited: true }] }],
  }));
  render(<Gym {...props()} />);
  await userEvent.click(within(screen.getByRole("region", { name: "Today's workout" })).getByRole("button", { name: "Start workout" }));
  expect(screen.getByRole("region", { name: "Switch workout" })).toHaveTextContent("Your Pull workout has numbers you haven't ticked. Start Push instead?");
});
