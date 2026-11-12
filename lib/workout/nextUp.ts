import type { Segment, TimerSnapshot } from './engine';
import { formatDuration } from './duration';

/** "12 reps", "0:45", or "" for an exercise with no amount set (the user advances it manually). */
export function formatSegmentAmount(segment: Segment): string {
  if (segment.reps !== null) return `${segment.reps} rep${segment.reps === 1 ? '' : 's'}`;
  if (segment.durationSeconds !== null) return formatDuration(segment.durationSeconds);
  return '';
}

function nameWithAmount(segment: Segment): string {
  const amount = formatSegmentAmount(segment);
  return amount ? `${segment.name} · ${amount}` : segment.name;
}

/**
 * The "what's coming" line shown while exercising. If a rest comes first it says
 * so, then names the next real exercise with its amount, e.g.
 * "Rest 0:30, then Squats · 12 reps". Null when nothing remains.
 */
export function describeNextUp(snapshot: Pick<TimerSnapshot, 'nextSegment' | 'nextExercise'>): string | null {
  const { nextSegment, nextExercise } = snapshot;
  if (!nextSegment) return null;
  if (nextSegment.kind === 'exercise') return nameWithAmount(nextSegment);
  const rest = nextSegment.durationSeconds !== null ? `Rest ${formatDuration(nextSegment.durationSeconds)}` : 'Rest';
  return nextExercise ? `${rest}, then ${nameWithAmount(nextExercise)}` : rest;
}
