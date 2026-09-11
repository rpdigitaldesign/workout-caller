import type { Workout } from './schema';

/**
 * Ephemeral client-side handoff for a not-yet-saved workout draft between
 * pages (e.g. the home screen's AI parse result -> the review/editor
 * screen). Backed by sessionStorage rather than a database round-trip or
 * a giant URL query string — this data is disposable and never needs to
 * survive a tab close.
 */

export interface WorkoutDraft {
  workout: Workout;
  source: 'ai' | 'manual' | 'modified';
  /** Set when this draft is a modification of an existing template/session, for "Save as New Template" lineage. */
  parentTemplateId?: string | null;
  originalWorkout?: Workout; // present for modification diffs
  /** Set when starting a run sourced from an existing template or scheduled workout, so completion can link back correctly. */
  templateId?: string | null;
  scheduledWorkoutId?: string | null;
}

function keyFor(draftId: string): string {
  return `workout-caller:draft:${draftId}`;
}

export function saveDraft(draftId: string, draft: WorkoutDraft): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(keyFor(draftId), JSON.stringify(draft));
}

export function loadDraft(draftId: string): WorkoutDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(keyFor(draftId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkoutDraft;
  } catch {
    return null;
  }
}

export function clearDraft(draftId: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(keyFor(draftId));
}
