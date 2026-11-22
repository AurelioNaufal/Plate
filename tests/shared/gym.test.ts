import {
  parseIdList, parseWeekdays, formatWeekdays, routinesForDay, sessionsFrom, lastSets, bestSeries, sessionCount, planExerciseDelete,
} from "../../src/shared/gym";
import type { Row } from "../../src/shared/schema";

const set = (ID: string, SessionID: string, Date: string, ExerciseID: string, SetNumber: number, WeightKg: number | null, Reps: number | null): Row => ({
  ID, SessionID, Date, ExerciseID, SetNumber, WeightKg, Reps, Done: true,
});

const push: Row = { ID: "push", Name: "Push", Weekdays: "1,4", ExerciseIDs: "bench,incline,tricep" };
const pull: Row = { ID: "pull", Name: "Pull", Weekdays: "2,5", ExerciseIDs: "lat,curl" };
const anytime: Row = { ID: "any", Name: "Anytime", Weekdays: "", ExerciseIDs: "abs" };

const workouts: Row[] = [
  set("a2", "s1", "2026-11-16", "bench", 2, 45, 8),
  set("a1", "s1", "2026-11-16", "bench", 1, 40, 10),
  set("a3", "s1", "2026-11-16", "abs", 1, null, 15),
  set("b1", "s2", "2026-11-19", "bench", 1, 47.5, 6),
  set("b2", "s2", "2026-11-19", "abs", 1, null, 20),
  set("c1", "s3", "2026-11-20", "lat", 1, 50, 10),
];

test("parseIdList and parseWeekdays clean up what the Sheet holds", () => {
  expect(parseIdList(" a, ,b ,c")).toEqual(["a", "b", "c"]);
  expect(parseIdList(null)).toEqual([]);
  expect(parseWeekdays("4, 1,x,9,1")).toEqual([1, 4]);
  expect(parseWeekdays(3)).toEqual([3]);
});

test("formatWeekdays", () => {
  expect(formatWeekdays([1, 4])).toBe("Mon, Thu");
  expect(formatWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
  expect(formatWeekdays([])).toBe("Any day");
});

test("routinesForDay returns the day's routines; Anytime never", () => {
  expect(routinesForDay([pull, anytime, push], 1).map((r) => r.ID)).toEqual(["push"]);
  expect(routinesForDay([pull, anytime, push], 0)).toEqual([]);
});

test("sessionsFrom groups sets, newest first, sets in exercise then set order", () => {
  const s = sessionsFrom(workouts);
  expect(s.map((x) => x.id)).toEqual(["s3", "s2", "s1"]);
  expect(s[2]).toMatchObject({ id: "s1", date: "2026-11-16" });
  expect(s[2].sets.map((r) => r.ID)).toEqual(["a1", "a2", "a3"]);
});

test("lastSets is the latest other session with that exercise", () => {
  expect(lastSets(workouts, "bench", "current").map((r) => r.ID)).toEqual(["b1"]);
  expect(lastSets(workouts, "bench", "s2").map((r) => r.ID)).toEqual(["a1", "a2"]);
  expect(lastSets(workouts, "squat")).toEqual([]);
});

test("bestSeries uses the best weight, or best reps for bodyweight moves", () => {
  expect(bestSeries(workouts, "bench")).toEqual([
    { date: "2026-11-16", value: 45, unit: "kg" },
    { date: "2026-11-19", value: 47.5, unit: "kg" },
  ]);
  expect(bestSeries(workouts, "abs")).toEqual([
    { date: "2026-11-16", value: 15, unit: "reps" },
    { date: "2026-11-19", value: 20, unit: "reps" },
  ]);
  expect(bestSeries(workouts, "squat")).toEqual([]);
});

test("a blank weight is never a 0 kg best", () => {
  const mixed = [set("x1", "s9", "2026-11-21", "bench", 1, null, 12)];
  expect(bestSeries([...workouts, ...mixed], "bench").map((p) => p.date)).toEqual(["2026-11-16", "2026-11-19"]);
});

test("sessionCount counts distinct sessions in the range", () => {
  expect(sessionCount(workouts, "2026-11-15", "2026-11-21")).toBe(3);
  expect(sessionCount(workouts, "2026-11-17", "2026-11-19")).toBe(1);
});

test("planExerciseDelete removes it and drops it from routines; history stays", () => {
  const changes = planExerciseDelete({ ID: "bench", Name: "Bench press" }, [push, pull]);
  expect(changes).toEqual([
    { tab: "Exercises", removeId: "bench" },
    { tab: "Routines", row: { ...push, ExerciseIDs: "incline,tricep" } },
  ]);
});

test("deleting an exercise with history hides it, so its name stays in past workouts", () => {
  const changes = planExerciseDelete({ ID: "bench", Name: "Bench press" }, [push], workouts);
  expect(changes[0]).toEqual({ tab: "Exercises", row: { ID: "bench", Name: "Bench press", Hidden: true } });
  expect(changes[1]).toEqual({ tab: "Routines", row: { ...push, ExerciseIDs: "incline,tricep" } });
  expect(planExerciseDelete({ ID: "squat", Name: "Squat" }, [], workouts)[0]).toEqual({ tab: "Exercises", removeId: "squat" });
});

test("one weighted set doesn't switch a reps exercise to kg: the unit most workouts used wins", () => {
  const oneWeighted = [...workouts, set("z1", "s9", "2026-11-21", "abs", 1, 5, 12)];
  expect(bestSeries(oneWeighted, "abs").map((p) => [p.date, p.unit])).toEqual([["2026-11-16", "reps"], ["2026-11-19", "reps"], ["2026-11-21", "reps"]]);
});
