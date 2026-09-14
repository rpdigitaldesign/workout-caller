import { describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { estimateWorkoutDuration, formatDuration } from '@/lib/workout/duration';
import type { Workout, WorkoutStep } from '@/lib/workout/schema';

function step(name: string, durationSeconds: number | null, restAfterSeconds: number | null = null): WorkoutStep {
  return { id: uuid(), name, durationSeconds, reps: null, restAfterSeconds, notes: null, announce: null };
}

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    title: 'Test',
    rounds: 1,
    roundRestSeconds: null,
    warmup: [],
    steps: [step('A', 40, 20), step('B', 30)],
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
    // Each round: A(40) + rest(20, ordinary inter-exercise) + B(30) = 90, x3 rounds.
    // roundRest fires between rounds only (x2), never after round 3 (B's own restAfterSeconds is null, no pre-cooldown rest either).
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

  it('estimates a reps-based step at ~3 seconds per rep, flagged as an estimate rather than an exact duration', () => {
    const result = estimateWorkoutDuration(makeWorkout({ steps: [{ ...step('Glute Bridge', null), reps: 15 }] }));
    expect(result.hasManualSteps).toBe(true);
    expect(result.totalSeconds).toBe(45); // 15 reps * 3s/rep
  });

  it('estimates "12 each side" (stored as 24 total reps) at ~72 seconds', () => {
    const result = estimateWorkoutDuration(makeWorkout({ steps: [{ ...step('Lunges', null), reps: 24 }] }));
    expect(result.totalSeconds).toBe(72);
  });

  it('a step with neither reps nor duration set (genuinely unspecified) still contributes 0', () => {
    const result = estimateWorkoutDuration(makeWorkout({ steps: [step('Unknown', null)] }));
    expect(result.hasManualSteps).toBe(true);
    expect(result.totalSeconds).toBe(0);
  });

  it("includes the last warmup/main step's restAfterSeconds exactly once as the one-time transition rest, regardless of rounds", () => {
    const result = estimateWorkoutDuration(
      makeWorkout({
        warmup: [step('Jog', 60, 15)],
        steps: [step('A', 40, 20), step('B', 30, 45)],
        rounds: 4,
        cooldown: [step('Stretch', 20)],
      }),
    );
    // warmup(60) + rest(15, one-time) + 4 rounds * (A 40 + rest 20 + B 30) + rest(45, one-time, only after round 4) + cooldown(20)
    expect(result.totalSeconds).toBe(60 + 15 + (40 + 20 + 30) * 4 + 45 + 20);
  });

  it('never double-counts a repeating round rest and a one-time pre-cooldown rest on the same final step', () => {
    const withBoth = estimateWorkoutDuration(
      makeWorkout({
        steps: [step('A', 40, 30)],
        rounds: 3,
        roundRestSeconds: 15,
        cooldown: [step('Stretch', 20)],
      }),
    );
    // 3 rounds of A(40), roundRest(15) fires twice (not after round 3), the one-time 30s rest fires exactly once (after round 3).
    expect(withBoth.totalSeconds).toBe(40 * 3 + 15 * 2 + 30 + 20);
  });

  it('suppresses trailing rest on the true final step of the workout even when restAfterSeconds is explicitly set', () => {
    const noCooldown = estimateWorkoutDuration(
      makeWorkout({ steps: [step('A', 40, 30)], rounds: 1, cooldown: [] }),
    );
    expect(noCooldown.totalSeconds).toBe(40); // the 30s rest never counts — nothing follows it
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
