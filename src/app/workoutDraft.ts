import type { Row } from "../shared/schema";
import { lastSets, parseIdList, type Session } from "../shared/gym";

// The workout in progress, kept on this device so closing the app mid-session
// loses nothing. Ticked sets are also saved to the Sheet as they're ticked;
// the draft adds the not-yet-ticked sets and their typed numbers.
/** edited: the owner typed in it (pre-filled numbers alone don't count). */
export type DraftSet = { id: string; weight: string; reps: string; done: boolean; edited?: boolean };
export type Draft = {
  sessionId: string;
  date: string;
  routineId: string | null;
  exercises: { exerciseId: string; sets: DraftSet[] }[];
  /** Opened from Recent workouts to fix a finished session. */
  editing?: boolean;
};

const KEY = "plate.workoutDraft";

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d.sessionId === "string" && Array.isArray(d.exercises) ? (d as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Storage blocked: the ticked sets are still saved to the Sheet.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * The draft "Start workout" should continue: today's, if any. A draft from an
 * earlier day (closed without Finish) is cleared; its ticked sets are already
 * in the Sheet, and reusing it would log today's sets into that day.
 */
export function draftToResume(today: string): Draft | null {
  const d = loadDraft();
  if (!d) return null;
  if (d.date === today) return d;
  clearDraft();
  return null;
}

const show = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "");

/** Sets to start an exercise with: last time's, not yet ticked, or 3 empty ones. */
export function startingSets(exerciseId: string, workouts: Row[], newId: () => string, excludeSessionId?: string): DraftSet[] {
  const last = lastSets(workouts, exerciseId, excludeSessionId);
  if (last.length === 0) return [0, 1, 2].map(() => ({ id: newId(), weight: "", reps: "", done: false }));
  return last.map((r) => ({ id: newId(), weight: show(r.WeightKg), reps: show(r.Reps), done: false }));
}

/** A new workout: the routine's exercises (ones that still exist), each pre-filled from last time. */
export function newDraft(routine: Row | null, exercises: Row[], workouts: Row[], date: string, newId: () => string): Draft {
  const known = new Set(exercises.map((e) => String(e.ID)));
  const ids = routine ? parseIdList(routine.ExerciseIDs).filter((id) => known.has(id)) : [];
  return {
    sessionId: newId(),
    date,
    routineId: routine ? String(routine.ID) : null,
    exercises: ids.map((exerciseId) => ({ exerciseId, sets: startingSets(exerciseId, workouts, newId) })),
  };
}

/** A stored workout reopened for editing: every set is already ticked. */
export function draftFromSession(session: Session): Draft {
  const exercises: Draft["exercises"] = [];
  for (const r of session.sets) {
    const exerciseId = String(r.ExerciseID);
    let ex = exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) exercises.push((ex = { exerciseId, sets: [] }));
    ex.sets.push({ id: String(r.ID), weight: show(r.WeightKg), reps: show(r.Reps), done: true });
  }
  return { sessionId: session.id, date: session.date, routineId: null, exercises, editing: true };
}

/**
 * What Start should do when today's draft may already be open:
 * nothing open → "new"; the same routine → "resume";
 * another routine with nothing ticked → "replace" (nothing is lost);
 * another routine with ticked (saved) sets → "ask".
 */
export function startChoice(existing: Draft | null, routineId: string | null): "new" | "resume" | "replace" | "ask" {
  if (!existing) return "new";
  // An edit of a finished workout: its sets are all saved, and Start must never add to it.
  if (existing.editing) return "replace";
  if (existing.routineId === routineId) return "resume";
  return savedSetCount(existing) > 0 || typedSetCount(existing) > 0 ? "ask" : "replace";
}

/** Unticked sets the owner typed numbers into. */
export const typedSetCount = (d: Draft) => d.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done && s.edited).length, 0);
export const savedSetCount = (d: Draft) => d.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
