import { get, set, del } from 'idb-keyval';
import type { Workout } from '@/lib/workout/schema';

const ACTIVE_WORKOUT_KEY = 'workout-caller:active-workout';

/**
 * Enough state to reconstruct a paused WorkoutEngine after an accidental
 * reload — not the whole engine instance, just its serializable position.
 * Saved on every meaningful transition (not every 250ms tick) during a
 * run; cleared on completion or explicit discard.
 */
export interface ActiveWorkoutRecovery {
  workout: Workout;
  templateId: string | null;
  scheduledWorkoutId: string | null;
  getReadySeconds: number;
  segmentIndex: number;
  remainingMs: number | null;
  elapsedTotalMsAtSave: number;
  savedAt: string;
}

export async function saveActiveWorkout(state: ActiveWorkoutRecovery): Promise<void> {
  await set(ACTIVE_WORKOUT_KEY, state);
}

export async function loadActiveWorkout(): Promise<ActiveWorkoutRecovery | null> {
  const value = await get<ActiveWorkoutRecovery>(ACTIVE_WORKOUT_KEY);
  return value ?? null;
}

export async function clearActiveWorkout(): Promise<void> {
  await del(ACTIVE_WORKOUT_KEY);
}
