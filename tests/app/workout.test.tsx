// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Workout } from "../../src/app/screens/Workout";
import { loadDraft, saveDraft, type Draft } from "../../src/app/workoutDraft";
import type { Change } from "../../src/shared/changes";
import type { Row } from "../../src/shared/schema";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

const exercises: Row[] = [
  { ID: "bench", Name: "Bench press", SortOrder: 1 },
  { ID: "tricep", Name: "Tricep", SortOrder: 2 },
  { ID: "abs", Name: "Abs", SortOrder: 3 },
  { ID: "curl", Name: "Bicep curl", SortOrder: 4 },
];
const routines: Row[] = [{ ID: "any", Name: "Anytime", Weekdays: "", ExerciseIDs: "abs" }];
const before: Row[] = [
  { ID: "p1", SessionID: "s0", Date: "2026-11-12", ExerciseID: "bench", SetNumber: 1, WeightKg: 40, Reps: 10, Done: true },
  { ID: "p2", SessionID: "s0", Date: "2026-11-12", ExerciseID: "bench", SetNumber: 2, WeightKg: 45, Reps: 8, Done: true },
];

const draft = (): Draft => ({
  sessionId: "s1",
  date: "2026-11-16",
  routineId: "push",
  exercises: [
    { exerciseId: "bench", sets: [{ id: "w1", weight: "40", reps: "10", done: false }, { id: "w2", weight: "45", reps: "8", done: false }] },
    { exerciseId: "abs", sets: [{ id: "w3", weight: "", reps: "15", done: false }] },
  ],
});

let apply: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  apply = vi.fn(async () => {});
  data.current = { rows: { Exercises: exercises, Routines: routines, Workouts: before, Settings: [] }, apply };
});
afterEach(() => vi.useRealTimers());

const lastApplied = (): Change[] => apply.mock.calls.at(-1)![0];
const bench = () => within(screen.getByRole("region", { name: "Bench press" }));

test("each exercise shows what you did last time", () => {
  render(<Workout draft={draft()} onDone={() => {}} />);
  expect(bench().getByText("Last time: 40×10 · 45×8")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Abs" })).getByText("Last time: —")).toBeInTheDocument();
});

test("ticking a set saves it; unticking removes it", async () => {
  render(<Workout draft={draft()} onDone={() => {}} />);
  await userEvent.click(bench().getByRole("checkbox", { name: "Set 1 done" }));
  expect(lastApplied()).toEqual([
    { tab: "Workouts", row: { ID: "w1", SessionID: "s1", Date: "2026-11-16", ExerciseID: "bench", SetNumber: 1, WeightKg: 40, Reps: 10, Done: true } },
  ]);
  await userEvent.click(bench().getByRole("checkbox", { name: "Set 1 done" }));
  expect(lastApplied()).toEqual([{ tab: "Workouts", removeId: "w1" }]);
});

test("a set with no weight saves WeightKg as blank, not 0", async () => {
  render(<Workout draft={draft()} onDone={() => {}} />);
  await userEvent.click(within(screen.getByRole("region", { name: "Abs" })).getByRole("checkbox", { name: "Set 1 done" }));
  expect(lastApplied()[0]).toMatchObject({ row: { ExerciseID: "abs", WeightKg: null, Reps: 15 } });
});

test("reps must be whole numbers", async () => {
  render(<Workout draft={draft()} onDone={() => {}} />);
  const reps = bench().getByLabelText("Set 1 reps");
  await userEvent.clear(reps);
  await userEvent.type(reps, "8.5");
  await userEvent.click(bench().getByRole("checkbox", { name: "Set 1 done" }));
  expect(bench().getByText("Use whole reps")).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});

test("removing a ticked set renumbers the ticked sets after it in one change", async () => {
  render(<Workout draft={draft()} onDone={() => {}} />);
  await userEvent.click(bench().getByRole("checkbox", { name: "Set 1 done" }));
  await userEvent.click(bench().getByRole("checkbox", { name: "Set 2 done" }));
  await userEvent.click(bench().getByRole("button", { name: "Remove set 1" }));
  expect(lastApplied()).toEqual([
    { tab: "Workouts", removeId: "w1" },
    { tab: "Workouts", row: expect.objectContaining({ ID: "w2", SetNumber: 1 }) },
  ]);
  expect(bench().getAllByRole("checkbox")).toHaveLength(1);
});

test("editing a ticked set saves the new numbers when you leave the field", async () => {
  render(<Workout draft={draft()} onDone={() => {}} />);
  await userEvent.click(bench().getByRole("checkbox", { name: "Set 1 done" }));
  const kg = bench().getByLabelText("Set 1 kg");
  await userEvent.clear(kg);
  await userEvent.type(kg, "42.5");
  await userEvent.tab();
  expect(lastApplied()[0]).toMatchObject({ row: { ID: "w1", WeightKg: 42.5 } });
});

test("add set copies the previous set", async () => {
  render(<Workout draft={draft()} onDone={() => {}} />);
  await userEvent.click(bench().getByRole("button", { name: "Add set" }));
  expect(bench().getByLabelText("Set 3 kg")).toHaveValue("45");
  expect(bench().getByLabelText("Set 3 reps")).toHaveValue("8");
});

test("add exercise offers Anytime moves first and pre-fills from last time", async () => {
  render(<Workout draft={{ ...draft(), exercises: [] }} onDone={() => {}} />);
  const picker = screen.getByLabelText("Add exercise");
  const groups = within(picker).getAllByRole("group");
  expect(groups[0]).toHaveAttribute("label", "Add anytime");
  await userEvent.selectOptions(picker, "bench");
  expect(bench().getByLabelText("Set 2 kg")).toHaveValue("45");
});

test("removing an exercise with saved sets asks first and removes them", async () => {
  render(<Workout draft={draft()} onDone={() => {}} />);
  await userEvent.click(bench().getByRole("checkbox", { name: "Set 1 done" }));
  await userEvent.click(bench().getByRole("button", { name: "Remove Bench press" }));
  expect(screen.getByText("Delete 1 saved set?")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
  expect(lastApplied()).toEqual([{ tab: "Workouts", removeId: "w1" }]);
  expect(screen.queryByRole("region", { name: "Bench press" })).not.toBeInTheDocument();
});

test("the rest timer counts down, can be adjusted, and says when rest is over", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const vibrate = vi.fn();
  Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<Workout draft={draft()} onDone={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Rest 1:30" }));
  expect(screen.getByText("1:30")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Add 15 seconds" }));
  expect(screen.getByText("1:45")).toBeInTheDocument();
  await act(async () => {
    vi.advanceTimersByTime(106_000);
  });
  expect(screen.getByText("Rest over")).toBeInTheDocument();
  expect(vibrate).toHaveBeenCalled();
});

test("the rest default comes from Settings", () => {
  data.current = { ...data.current, rows: { ...(data.current.rows as object), Settings: [{ ID: "restSeconds", Value: "120" }] } };
  render(<Workout draft={draft()} onDone={() => {}} />);
  expect(screen.getByRole("button", { name: "Rest 2:00" })).toBeInTheDocument();
});

test("the draft is kept on the phone, so a reopened workout looks the same", async () => {
  const { unmount } = render(<Workout draft={draft()} onDone={() => {}} />);
  await userEvent.click(bench().getByRole("checkbox", { name: "Set 1 done" }));
  unmount();
  render(<Workout draft={loadDraft()!} onDone={() => {}} />);
  expect(bench().getByRole("checkbox", { name: "Set 1 done" })).toBeChecked();
  expect(bench().getByLabelText("Set 2 kg")).toHaveValue("45");
});

test("finishing with unticked numbers asks first, then clears the draft", async () => {
  const onDone = vi.fn();
  saveDraft(draft());
  render(<Workout draft={draft()} onDone={onDone} />);
  await userEvent.click(screen.getByRole("button", { name: "Finish workout" }));
  expect(screen.getByText("3 sets aren't ticked and won't be saved.")).toBeInTheDocument();
  expect(onDone).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Finish anyway" }));
  expect(onDone).toHaveBeenCalled();
  expect(loadDraft()).toBeNull();
});

describe("resuming checks the Sheet", () => {
  const resumed = (): Draft => ({
    ...draft(),
    exercises: [{ exerciseId: "bench", sets: [
      { id: "w1", weight: "40", reps: "10", done: true },
      { id: "w2", weight: "45", reps: "8", done: false },
    ] }],
  });

  test("a ticked set the Sheet doesn't have is sent again", () => {
    render(<Workout draft={resumed()} onDone={() => {}} />);
    expect(apply).toHaveBeenCalledWith([
      { tab: "Workouts", row: { ID: "w1", SessionID: "s1", Date: "2026-11-16", ExerciseID: "bench", SetNumber: 1, WeightKg: 40, Reps: 10, Done: true } },
    ]);
  });

  test("a ticked set the Sheet has with other numbers is sent again; one that matches is left alone", () => {
    const stored = (WeightKg: number): Row => ({ ID: "w1", SessionID: "s1", Date: "2026-11-16", ExerciseID: "bench", SetNumber: 1, WeightKg, Reps: 10, Done: true });
    data.current = { ...data.current, rows: { ...(data.current.rows as object), Workouts: [...before, stored(40)] } };
    const { unmount } = render(<Workout draft={resumed()} onDone={() => {}} />);
    expect(apply).not.toHaveBeenCalled();
    unmount();
    data.current = { ...data.current, rows: { ...(data.current.rows as object), Workouts: [...before, stored(35)] } };
    render(<Workout draft={resumed()} onDone={() => {}} />);
    expect(apply).toHaveBeenCalledWith([{ tab: "Workouts", row: expect.objectContaining({ ID: "w1", WeightKg: 40 }) }]);
  });

  test("an unticked set still in the Sheet is removed", () => {
    data.current = { ...data.current, rows: { ...(data.current.rows as object), Workouts: [...before, { ID: "w2", SessionID: "s1", Date: "2026-11-16", ExerciseID: "bench", SetNumber: 2, WeightKg: 45, Reps: 8, Done: true }, { ID: "w1", SessionID: "s1", Date: "2026-11-16", ExerciseID: "bench", SetNumber: 1, WeightKg: 40, Reps: 10, Done: true }] } };
    render(<Workout draft={resumed()} onDone={() => {}} />);
    expect(apply).toHaveBeenCalledWith([{ tab: "Workouts", removeId: "w2" }]);
  });
});
