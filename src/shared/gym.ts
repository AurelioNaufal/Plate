// Gym: exercises, routines and sessions. A session is the Workouts rows that
// share a SessionID; only ticked sets are stored. A blank weight (abs, other
// bodyweight moves) is "no weight", never 0 kg.
import type { Row } from "./schema";
import type { Change } from "./changes";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** "a, ,b" → ["a", "b"]. */
export function parseIdList(s: unknown): string[] {
  if (s === null || s === undefined) return [];
  return String(s)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** "4, 1,x,9" → [1, 4]: whole numbers 0–6 only, sorted, no repeats. */
export function parseWeekdays(s: unknown): number[] {
  const days = parseIdList(s)
    .filter((x) => /^\d$/.test(x))
    .map(Number)
    .filter((d) => d >= 0 && d <= 6);
  return [...new Set(days)].sort((a, b) => a - b);
}

export function formatWeekdays(days: number[]): string {
  if (days.length === 0) return "Any day";
  if (days.length === 7) return "Every day";
  return days.map((d) => DAY_NAMES[d]).join(", ");
}

/** Routines scheduled on that weekday (0 = Sunday), by name. Routines with no days ("Anytime") never match. */
export function routinesForDay(routines: Row[], weekday: number): Row[] {
  return routines
    .filter((r) => parseWeekdays(r.Weekdays).includes(weekday))
    .sort((a, b) => String(a.Name ?? "").localeCompare(String(b.Name ?? "")));
}

export type Session = { id: string; date: string; sets: Row[] };

/** Groups sets into sessions, newest first. Within a session: exercises in the order they first appear, then by set number. */
export function sessionsFrom(workouts: Row[]): Session[] {
  const byId = new Map<string, Row[]>();
  for (const w of workouts) {
    if (!w.SessionID) continue;
    const id = String(w.SessionID);
    byId.set(id, [...(byId.get(id) ?? []), w]);
  }
  const sessions: Session[] = [];
  for (const [id, rows] of byId) {
    const order = new Map<string, number>();
    for (const r of rows) if (!order.has(String(r.ExerciseID))) order.set(String(r.ExerciseID), order.size);
    const sets = [...rows].sort(
      (a, b) => order.get(String(a.ExerciseID))! - order.get(String(b.ExerciseID))! || Number(a.SetNumber ?? 0) - Number(b.SetNumber ?? 0),
    );
    const date = rows.map((r) => String(r.Date ?? "")).sort().at(-1) ?? "";
    sessions.push({ id, date, sets });
  }
  return sessions.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

const setsOf = (s: Session, exerciseId: string) => s.sets.filter((r) => String(r.ExerciseID) === exerciseId);

/** The sets of the most recent other session that has this exercise, by set number. */
export function lastSets(workouts: Row[], exerciseId: string, excludeSessionId?: string): Row[] {
  for (const s of sessionsFrom(workouts)) {
    if (s.id === excludeSessionId) continue;
    const sets = setsOf(s, exerciseId);
    if (sets.length) return sets;
  }
  return [];
}

/**
 * One point per session: the best weight lifted. An exercise that has never
 * had a weight (abs) is tracked by its best reps instead. Oldest first.
 */
export function bestSeries(workouts: Row[], exerciseId: string): { date: string; value: number; unit: "kg" | "reps" }[] {
  const mine = workouts.filter((w) => String(w.ExerciseID) === exerciseId);
  const unit: "kg" | "reps" = mine.some((w) => num(w.WeightKg)) ? "kg" : "reps";
  const field = unit === "kg" ? "WeightKg" : "Reps";
  const out: { date: string; value: number; unit: "kg" | "reps" }[] = [];
  for (const s of [...sessionsFrom(mine)].reverse()) {
    const values = s.sets.map((r) => r[field]).filter(num);
    if (values.length) out.push({ date: s.date, value: Math.max(...values), unit });
  }
  return out;
}

/** Workouts in [start, end]: distinct sessions with a set dated in the range. */
export function sessionCount(workouts: Row[], start: string, end: string): number {
  const ids = new Set<string>();
  for (const w of workouts) {
    const d = String(w.Date ?? "");
    if (w.SessionID && d >= start && d <= end) ids.add(String(w.SessionID));
  }
  return ids.size;
}

/** Deletes an exercise and takes it out of every routine. Logged sets stay in history. */
export function planExerciseDelete(exercise: Row, routines: Row[]): Change[] {
  const id = String(exercise.ID);
  const changes: Change[] = [{ tab: "Exercises", removeId: id }];
  for (const r of routines) {
    const ids = parseIdList(r.ExerciseIDs);
    if (ids.includes(id)) changes.push({ tab: "Routines", row: { ...r, ExerciseIDs: ids.filter((x) => x !== id).join(",") } });
  }
  return changes;
}
