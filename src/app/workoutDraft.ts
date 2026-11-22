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
