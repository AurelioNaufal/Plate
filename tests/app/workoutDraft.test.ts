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
