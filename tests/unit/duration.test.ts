import { describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { estimateWorkoutDuration, formatDuration } from '@/lib/workout/duration';
import type { Workout, WorkoutStep } from '@/lib/workout/schema';

function step(name: string, durationSeconds: number | null, type: WorkoutStep['type'] = 'exercise'): WorkoutStep {
  return { id: uuid(), type, name, durationSeconds, reps: null, notes: null, announce: null };
}

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    title: 'Test',
    rounds: 1,
    roundRestSeconds: null,
    postWarmupRestSeconds: null,
    preCooldownRestSeconds: null,
    warmup: [],
    steps: [step('A', 40), step('rest', 20, 'rest'), step('B', 30)],
    cooldown: [],
    notes: null,
    tags: [],
    ...overrides,
  };
}

describe('estimateWorkoutDuration', () => {
  it('sums a single round with no warmup/cooldown/round-rest', () => {
    const result = estimateWorkoutDuration(makeWorkout());
    expect(result.totalSeconds).toBe(40 + 20 + 30);
    expect(result.hasManualSteps).toBe(false);
  });

  it('multiplies steps by rounds and inserts round rest between rounds only (not after the last)', () => {
    const result = estimateWorkoutDuration(makeWorkout({ rounds: 3, roundRestSeconds: 60 }));
    expect(result.totalSeconds).toBe((40 + 20 + 30) * 3 + 60 * 2);
  });

  it('includes warmup and cooldown exactly once regardless of rounds', () => {
    const result = estimateWorkoutDuration(
      makeWorkout({
        warmup: [step('Jog', 120)],
        cooldown: [step('Stretch', 90)],
        rounds: 2,
        roundRestSeconds: 10,
      }),
    );
    expect(result.totalSeconds).toBe(120 + (40 + 20 + 30) * 2 + 10 + 90);
  });

  it('treats null roundRestSeconds as no round rest', () => {
    const withNull = estimateWorkoutDuration(makeWorkout({ rounds: 2, roundRestSeconds: null }));
    const withZero = estimateWorkoutDuration(makeWorkout({ rounds: 2, roundRestSeconds: 0 }));
    expect(withNull.totalSeconds).toBe(withZero.totalSeconds);
  });

  it('flags manual (null-duration) steps and excludes them from the numeric total', () => {
    const result = estimateWorkoutDuration(makeWorkout({ steps: [step('AMRAP', null)] }));
    expect(result.hasManualSteps).toBe(true);
    expect(result.totalSeconds).toBe(0);
  });

  it('includes postWarmupRestSeconds and preCooldownRestSeconds exactly once, regardless of rounds', () => {
    const result = estimateWorkoutDuration(
      makeWorkout({ rounds: 4, postWarmupRestSeconds: 60, preCooldownRestSeconds: 45 }),
    );
    expect(result.totalSeconds).toBe((40 + 20 + 30) * 4 + 60 + 45);
  });

  it('treats null/0 postWarmupRestSeconds and preCooldownRestSeconds as contributing nothing', () => {
    const withNull = estimateWorkoutDuration(
      makeWorkout({ postWarmupRestSeconds: null, preCooldownRestSeconds: null }),
    );
    const withZero = estimateWorkoutDuration(makeWorkout({ postWarmupRestSeconds: 0, preCooldownRestSeconds: 0 }));
    const withNeither = estimateWorkoutDuration(makeWorkout());
    expect(withNull.totalSeconds).toBe(withNeither.totalSeconds);
    expect(withZero.totalSeconds).toBe(withNeither.totalSeconds);
  });
});

describe('formatDuration', () => {
  it('formats seconds under an hour as M:SS', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(5)).toBe('0:05');
  });

  it('formats an hour or more as H:MM:SS', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('clamps negative input to zero', () => {
    expect(formatDuration(-5)).toBe('0:00');
  });
});
