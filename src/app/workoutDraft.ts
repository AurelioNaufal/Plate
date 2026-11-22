import type { Row } from "../shared/schema";
import { lastSets, parseIdList, type Session } from "../shared/gym";

// The workout in progress, kept on this device so closing the app mid-session
// loses nothing. Ticked sets are also saved to the Sheet as they're ticked;
// the draft adds the not-yet-ticked sets and their typed numbers.
export type DraftSet = { id: string; weight: string; reps: string; done: boolean };
export type Draft = {
  sessionId: string;
  date: string;
  routineId: string | null;
  exercises: { exerciseId: string; sets: DraftSet[] }[];
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
  return { sessionId: session.id, date: session.date, routineId: null, exercises };
}
