// @vitest-environment jsdom
import { loadDraft, saveDraft, clearDraft, type Draft } from "../../src/app/workoutDraft";

const draft: Draft = {
  sessionId: "s1",
  date: "2026-11-16",
  routineId: "push",
  exercises: [{ exerciseId: "bench", sets: [{ id: "w1", weight: "40", reps: "10", done: true }] }],
};

beforeEach(() => localStorage.clear());

test("a saved draft comes back the same", () => {
  saveDraft(draft);
  expect(loadDraft()).toEqual(draft);
  clearDraft();
  expect(loadDraft()).toBeNull();
});

test("unreadable or blocked storage gives no draft instead of an error", () => {
  localStorage.setItem("plate.workoutDraft", "{not json");
  expect(loadDraft()).toBeNull();
  const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(loadDraft()).toBeNull();
  expect(() => saveDraft(draft)).not.toThrow();
  spy.mockRestore();
});

import { newDraft, draftFromSession } from "../../src/app/workoutDraft";
import { sessionsFrom } from "../../src/shared/gym";

describe("newDraft", () => {
  const exercises = [{ ID: "bench", Name: "Bench press" }, { ID: "tricep", Name: "Tricep" }];
  const push = { ID: "push", Name: "Push", Weekdays: "1,4", ExerciseIDs: "bench,tricep,gone" };
  const before = [
    { ID: "p2", SessionID: "s0", Date: "2026-11-12", ExerciseID: "bench", SetNumber: 2, WeightKg: 45, Reps: 8, Done: true },
    { ID: "p1", SessionID: "s0", Date: "2026-11-12", ExerciseID: "bench", SetNumber: 1, WeightKg: 40, Reps: 10, Done: true },
  ];
  let n = 0;
  const id = () => `n${++n}`;

  test("pre-fills last time's sets, and gives new exercises 3 empty sets", () => {
    const d = newDraft(push, exercises, before, "2026-11-16", id);
    expect(d).toMatchObject({ date: "2026-11-16", routineId: "push" });
    expect(d.exercises.map((e) => e.exerciseId)).toEqual(["bench", "tricep"]);
    expect(d.exercises[0].sets.map(({ weight, reps, done }) => ({ weight, reps, done }))).toEqual([
      { weight: "40", reps: "10", done: false },
      { weight: "45", reps: "8", done: false },
    ]);
    expect(d.exercises[1].sets).toHaveLength(3);
    expect(d.exercises[1].sets.every((s) => s.weight === "" && s.reps === "" && !s.done)).toBe(true);
    expect(new Set(d.exercises.flatMap((e) => e.sets.map((s) => s.id))).size).toBe(5);
  });

  test("a blank workout starts empty", () => {
    expect(newDraft(null, exercises, before, "2026-11-22", id).exercises).toEqual([]);
  });

  test("a stored session becomes an editable draft with its sets ticked", () => {
    const d = draftFromSession(sessionsFrom(before)[0]);
    expect(d).toMatchObject({ sessionId: "s0", date: "2026-11-12", routineId: null });
    expect(d.exercises[0].sets).toEqual([
      { id: "p1", weight: "40", reps: "10", done: true },
      { id: "p2", weight: "45", reps: "8", done: true },
    ]);
  });
});
