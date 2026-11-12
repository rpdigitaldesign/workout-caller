import { describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { WorkoutEngine } from '@/lib/workout/engine';
import { describeNextUp, formatSegmentAmount } from '@/lib/workout/nextUp';
import type { Workout, WorkoutStep } from '@/lib/workout/schema';

const T0 = 1_700_000_000_000;
const timed = (name: string, seconds: number, rest: number | null = null): WorkoutStep => ({
  id: uuid(), name, durationSeconds: seconds, reps: null, restAfterSeconds: rest, notes: null, announce: null,
});
const reps = (name: string, n: number, rest: number | null = null): WorkoutStep => ({
  id: uuid(), name, durationSeconds: null, reps: n, restAfterSeconds: rest, notes: null, announce: null,
});
const workout = (steps: WorkoutStep[], over: Partial<Workout> = {}): Workout => ({
  title: 'W', rounds: 1, roundRestSeconds: null, warmup: [], steps, cooldown: [], notes: null, tags: [], ...over,
});

describe('engine nextExercise', () => {
  it('skips the rest in between and points at the next real exercise', () => {
    const engine = new WorkoutEngine(workout([timed('Squats', 40, 20), reps('Push-ups', 12)]), { getReadySeconds: 0 });
    const snap = engine.start(T0);
    expect(snap.currentSegment?.name).toBe('Squats');
    expect(snap.nextSegment?.kind).toBe('rest');
    expect(snap.nextExercise?.name).toBe('Push-ups');
  });

  it('is the first exercise during the get-ready countdown', () => {
    const engine = new WorkoutEngine(workout([timed('Squats', 40)]), { getReadySeconds: 5 });
    expect(engine.start(T0).nextExercise?.name).toBe('Squats');
  });

  it('is null on the last exercise', () => {
    const engine = new WorkoutEngine(workout([timed('Squats', 40, 20), timed('Plank', 30)]), { getReadySeconds: 0 });
    let snap = engine.start(T0);
    snap = engine.tick(T0 + 60_000);
    expect(snap.currentSegment?.name).toBe('Plank');
    expect(snap.nextExercise).toBeNull();
  });

  it('looks across a round rest into the next round', () => {
    const engine = new WorkoutEngine(workout([timed('Squats', 10)], { rounds: 2, roundRestSeconds: 30 }), { getReadySeconds: 0 });
    const snap = engine.start(T0);
    expect(snap.nextSegment?.kind).toBe('roundRest');
    expect(snap.nextExercise?.name).toBe('Squats');
    expect(snap.nextExercise?.roundNumber).toBe(2);
  });
});

describe('describeNextUp', () => {
  const seg = (over: object) =>
    ({ key: 'k', origin: 'main', kind: 'exercise', name: 'Squats', durationSeconds: null, reps: null, announce: null, stepId: null, roundNumber: 1, ...over }) as never;

  it('names the next exercise with its reps', () => {
    expect(describeNextUp({ nextSegment: seg({ reps: 12 }), nextExercise: seg({ reps: 12 }) })).toBe('Squats · 12 reps');
  });
  it('uses singular for one rep', () => {
    expect(formatSegmentAmount(seg({ reps: 1 }))).toBe('1 rep');
  });
  it('names the next exercise with its time', () => {
    expect(describeNextUp({ nextSegment: seg({ durationSeconds: 45 }), nextExercise: seg({ durationSeconds: 45 }) })).toBe('Squats · 0:45');
  });
  it('says there is a rest first, then the exercise', () => {
    const rest = seg({ kind: 'rest', name: 'Rest', durationSeconds: 30 });
    expect(describeNextUp({ nextSegment: rest, nextExercise: seg({ reps: 8 }) })).toBe('Rest 0:30, then Squats · 8 reps');
  });
  it('shows just the exercise name when it has no amount', () => {
    expect(describeNextUp({ nextSegment: seg({}), nextExercise: seg({}) })).toBe('Squats');
  });
  it('is null when nothing remains', () => {
    expect(describeNextUp({ nextSegment: null, nextExercise: null })).toBeNull();
  });
});
