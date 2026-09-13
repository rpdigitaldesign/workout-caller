import type { Workout, WorkoutStep } from './schema';

/**
 * Sum of a step list's durations. Manual-advance steps (durationSeconds
 * === null) contribute 0 to the estimate since there's no way to know how
 * long the user will take — callers surface `hasManualSteps` so the UI can
 * show "28:30+" instead of a false-precision number.
 */
function sumSteps(steps: WorkoutStep[]): { seconds: number; hasManualSteps: boolean } {
  let seconds = 0;
  let hasManualSteps = false;
  for (const step of steps) {
    if (step.durationSeconds === null) {
      hasManualSteps = true;
    } else {
      seconds += step.durationSeconds;
    }
  }
  return { seconds, hasManualSteps };
}

export interface EstimatedDuration {
  totalSeconds: number;
  hasManualSteps: boolean;
}

/**
 * Computes total estimated duration locally — warmup + postWarmupRestSeconds
 * (once) + (steps x rounds, with roundRestSeconds inserted after every
 * round except the last) + preCooldownRestSeconds (once) + cooldown. This
 * must never be delegated to Claude (spec section 13).
 */
export function estimateWorkoutDuration(workout: Workout): EstimatedDuration {
  let totalSeconds = 0;
  let hasManualSteps = false;

  const warmup = sumSteps(workout.warmup);
  totalSeconds += warmup.seconds;
  hasManualSteps ||= warmup.hasManualSteps;

  totalSeconds += workout.postWarmupRestSeconds ?? 0;

  const perRound = sumSteps(workout.steps);
  const roundRest = workout.roundRestSeconds ?? 0;

  totalSeconds += perRound.seconds * workout.rounds;
  hasManualSteps ||= perRound.hasManualSteps && workout.rounds > 0;
  totalSeconds += roundRest * Math.max(0, workout.rounds - 1);

  totalSeconds += workout.preCooldownRestSeconds ?? 0;

  const cooldown = sumSteps(workout.cooldown);
  totalSeconds += cooldown.seconds;
  hasManualSteps ||= cooldown.hasManualSteps;

  return { totalSeconds, hasManualSteps };
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
