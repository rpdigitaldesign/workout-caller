import type { Workout } from './schema';
import { buildSegments } from './engine';

export interface EstimatedDuration {
  totalSeconds: number;
  hasManualSteps: boolean;
}

/** Planning-only estimate for a reps-based exercise. Never used by the timer
 * itself (Segment.durationSeconds stays null for these — see engine.ts) —
 * purely so the workout's total estimated duration is a reasonable number
 * instead of silently undercounting every reps-based exercise as 0s. Not
 * user-configurable (spec: no rep-speed settings in this pass). */
const REP_DURATION_ESTIMATE_SECONDS = 3;

/**
 * Computes total estimated duration by summing the exact same segment
 * list the timer engine will actually play (`buildSegments()`) — this
 * guarantees the estimate can never drift from real playback behavior,
 * including the round-boundary rest-supersession rule and the
 * true-final-step rest suppression (see buildSegments()'s doc comment).
 * A reps-based segment contributes `reps * REP_DURATION_ESTIMATE_SECONDS`
 * as an estimate; a segment with neither duration nor reps set (genuinely
 * unspecified) contributes 0. Either way, callers surface `hasManualSteps`
 * so the UI can show "28:30+" rather than a false-precision number. This
 * must never be delegated to Claude (spec section 13).
 */
export function estimateWorkoutDuration(workout: Workout): EstimatedDuration {
  let totalSeconds = 0;
  let hasManualSteps = false;

  for (const segment of buildSegments(workout)) {
    if (segment.durationSeconds !== null) {
      totalSeconds += segment.durationSeconds;
    } else if (segment.reps !== null) {
      totalSeconds += segment.reps * REP_DURATION_ESTIMATE_SECONDS;
      hasManualSteps = true;
    } else {
      hasManualSteps = true;
    }
  }

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
