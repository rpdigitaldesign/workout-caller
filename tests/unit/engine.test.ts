import { describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { WorkoutEngine, buildSegments } from '@/lib/workout/engine';
import type { Workout, WorkoutStep } from '@/lib/workout/schema';

function step(name: string, durationSeconds: number | null, type: WorkoutStep['type'] = 'exercise'): WorkoutStep {
  return { id: uuid(), type, name, durationSeconds, reps: null, notes: null, announce: null };
}

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    title: 'Test Workout',
    rounds: 1,
    roundRestSeconds: null,
    warmup: [],
    steps: [step('Squats', 40), step('Rest', 20, 'rest'), step('Push-ups', 30)],
    cooldown: [],
    notes: null,
    tags: [],
    ...overrides,
  };
}

const T0 = 1_700_000_000_000; // arbitrary fixed epoch ms base

describe('buildSegments', () => {
  it('flattens warmup, repeated rounds with round rest, and cooldown in order', () => {
    const workout = makeWorkout({
      warmup: [step('Jumping jacks', 30)],
      steps: [step('Squats', 40), step('Push-ups', 30)],
      rounds: 3,
      roundRestSeconds: 60,
      cooldown: [step('Stretch', 60)],
    });
    const segments = buildSegments(workout);
    // warmup(1) + 3 rounds * 2 steps + 2 round rests (not after the last round) + cooldown(1)
    expect(segments).toHaveLength(1 + 3 * 2 + 2 + 1);
    expect(segments[0]!.origin).toBe('warmup');
    expect(segments[1]!.name).toBe('Squats');
    expect(segments[1]!.roundNumber).toBe(1);
    expect(segments[3]!.kind).toBe('roundRest');
    expect(segments[segments.length - 1]!.origin).toBe('cooldown');
  });

  it('omits round rest when roundRestSeconds is null', () => {
    const workout = makeWorkout({ rounds: 3, roundRestSeconds: null });
    const segments = buildSegments(workout);
    expect(segments.every((s) => s.kind !== 'roundRest')).toBe(true);
    expect(segments).toHaveLength(3 * 3);
  });

  it('treats roundRestSeconds of exactly 0 as no round rest (not a zero-length visible state)', () => {
    const workout = makeWorkout({ rounds: 2, roundRestSeconds: 0 });
    const segments = buildSegments(workout);
    expect(segments.every((s) => s.kind !== 'roundRest')).toBe(true);
  });

  it('never inserts round rest after the final round', () => {
    const workout = makeWorkout({ rounds: 2, roundRestSeconds: 15 });
    const segments = buildSegments(workout);
    expect(segments[segments.length - 1]!.kind).not.toBe('roundRest');
  });
});

describe('WorkoutEngine', () => {
  it('idle -> preparing -> exercise, honoring configured getReadySeconds', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 5 });
    let snap = engine.start(T0);
    expect(snap.state).toBe('preparing');
    expect(snap.remainingMs).toBe(5000);

    snap = engine.tick(T0 + 4999);
    expect(snap.state).toBe('preparing');

    snap = engine.tick(T0 + 5000);
    expect(snap.state).toBe('exercise');
    expect(snap.currentSegment?.name).toBe('Squats');
    expect(snap.remainingMs).toBe(40_000);
  });

  it('resolves a 0-second get-ready immediately on start', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    const snap = engine.start(T0);
    expect(snap.state).toBe('exercise');
    expect(snap.currentSegment?.name).toBe('Squats');
  });

  it('transitions exercise -> rest -> exercise for a single round with explicit rest steps', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    let snap = engine.start(T0);
    expect(snap.currentSegment?.name).toBe('Squats');

    snap = engine.tick(T0 + 40_000);
    expect(snap.state).toBe('rest');
    expect(snap.currentSegment?.name).toBe('Rest');
    expect(snap.nextSegment?.name).toBe('Push-ups');

    snap = engine.tick(T0 + 40_000 + 20_000);
    expect(snap.state).toBe('exercise');
    expect(snap.currentSegment?.name).toBe('Push-ups');
  });

  it('transitions the last step of a round into roundRest when configured, and completes after the final round with no round rest', () => {
    const workout = makeWorkout({
      steps: [step('Squats', 10)],
      rounds: 2,
      roundRestSeconds: 15,
    });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 0 });
    let snap = engine.start(T0);
    expect(snap.roundNumber).toBe(1);

    snap = engine.tick(T0 + 10_000);
    expect(snap.state).toBe('roundRest');

    snap = engine.tick(T0 + 10_000 + 15_000);
    expect(snap.state).toBe('exercise');
    expect(snap.roundNumber).toBe(2);

    snap = engine.tick(T0 + 10_000 + 15_000 + 10_000);
    expect(snap.state).toBe('complete');
    expect(snap.completionReason).toBe('finished');
  });

  it('advances round-to-round with no round rest configured', () => {
    const workout = makeWorkout({ steps: [step('Squats', 10)], rounds: 2, roundRestSeconds: null });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 0 });
    engine.start(T0);
    const snap = engine.tick(T0 + 10_000);
    expect(snap.state).toBe('exercise');
    expect(snap.roundNumber).toBe(2);
  });

  it('pause freezes remaining time exactly, and resume computes a fresh deadline with zero drift', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    engine.start(T0);
    let snap = engine.tick(T0 + 32_700); // 7.3s remaining of the 40s Squats segment
    expect(snap.remainingMs).toBe(7_300);

    snap = engine.pause(T0 + 32_700);
    expect(snap.state).toBe('paused');
    expect(snap.remainingMs).toBe(7_300);

    // Wall clock advances 500 seconds while paused — must not leak into remaining time.
    snap = engine.resume(T0 + 32_700 + 500_000);
    expect(snap.state).toBe('exercise');
    expect(snap.remainingMs).toBe(7_300);

    snap = engine.tick(T0 + 32_700 + 500_000 + 7_300);
    expect(snap.state).toBe('rest');
  });

  it('pausing during roundRest and preparing both work and resume to the correct state', () => {
    const workout = makeWorkout({ steps: [step('Squats', 10)], rounds: 2, roundRestSeconds: 20 });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 3 });

    let snap = engine.start(T0);
    snap = engine.pause(T0 + 1000);
    expect(snap.state).toBe('paused');
    snap = engine.resume(T0 + 1000);
    expect(snap.state).toBe('preparing');
    expect(snap.remainingMs).toBe(2000);

    snap = engine.tick(T0 + 1000 + 2000); // enters exercise
    snap = engine.tick(T0 + 1000 + 2000 + 10_000); // enters roundRest
    expect(snap.state).toBe('roundRest');
    snap = engine.pause(T0 + 1000 + 2000 + 10_000 + 5000);
    snap = engine.resume(T0 + 1000 + 2000 + 10_000 + 5000 + 99_000);
    expect(snap.state).toBe('roundRest');
    expect(snap.remainingMs).toBe(15_000);
  });

  it('skip forward discards remaining time and starts the next segment at full duration', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    engine.start(T0);
    const snap = engine.skipForward(T0 + 1000); // 1s into a 40s segment
    expect(snap.state).toBe('rest');
    expect(snap.remainingMs).toBe(20_000);
  });

  it('skip forward past the final segment completes the workout', () => {
    const workout = makeWorkout({ steps: [step('Squats', 10)], rounds: 1, roundRestSeconds: null });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 0 });
    engine.start(T0);
    const snap = engine.skipForward(T0 + 1000);
    expect(snap.state).toBe('complete');
  });

  it('skip backward clamps at the first segment instead of going negative', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    engine.start(T0);
    let snap = engine.skipBackward(T0 + 1000);
    expect(snap.segmentIndex).toBe(0);
    expect(snap.currentSegment?.name).toBe('Squats');
    snap = engine.skipBackward(T0 + 2000);
    expect(snap.segmentIndex).toBe(0);
  });

  it('previous returns to the prior segment at full duration', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    engine.start(T0);
    engine.tick(T0 + 40_000); // now in Rest
    const snap = engine.skipBackward(T0 + 40_000 + 5000);
    expect(snap.currentSegment?.name).toBe('Squats');
    expect(snap.remainingMs).toBe(40_000);
  });

  it('a manual-advance (null duration) step never auto-times-out and requires advanceManualStep', () => {
    const workout = makeWorkout({ steps: [step('AMRAP push-ups', null)], rounds: 1 });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 0 });
    let snap = engine.start(T0);
    expect(snap.isManualAdvance).toBe(true);
    expect(snap.remainingMs).toBeNull();

    snap = engine.tick(T0 + 999_999_999);
    expect(snap.state).toBe('exercise'); // still here — no deadline to trigger

    snap = engine.advanceManualStep(T0 + 1000);
    expect(snap.state).toBe('complete');
  });

  it('cascades through every intermediate segment boundary when tick is called long after several should have elapsed (backgrounded tab)', () => {
    const workout = makeWorkout({ steps: [step('A', 10), step('B', 10, 'rest'), step('C', 10)], rounds: 3, roundRestSeconds: 5 });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 0 });
    engine.start(T0);
    // Jump far past the entire workout in one tick.
    const snap = engine.tick(T0 + 10_000_000);
    expect(snap.state).toBe('complete');
    expect(snap.completionReason).toBe('finished');
  });

  it('cascades to a specific mid-workout point correctly, not just to complete', () => {
    const workout = makeWorkout({ steps: [step('A', 10), step('B', 10, 'rest'), step('C', 10)], rounds: 2, roundRestSeconds: 5 });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 0 });
    engine.start(T0);
    // A(10) + B(10) + C(10) + roundRest(5) = 35s elapses exactly into round 2's A.
    const snap = engine.tick(T0 + 35_000);
    expect(snap.state).toBe('exercise');
    expect(snap.currentSegment?.name).toBe('A');
    expect(snap.roundNumber).toBe(2);
    expect(snap.remainingMs).toBe(10_000);
  });

  it('End Workout early from an active exercise state sets complete with reason "early"', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    engine.start(T0);
    const snap = engine.endEarly(T0 + 5000);
    expect(snap.state).toBe('complete');
    expect(snap.completionReason).toBe('early');
  });

  it('End Workout early while paused also completes correctly', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    engine.start(T0);
    engine.pause(T0 + 1000);
    const snap = engine.endEarly(T0 + 2000);
    expect(snap.state).toBe('complete');
    expect(snap.completionReason).toBe('early');
  });

  it('nextSegment and prevAvailable are correct at the first segment, mid-workout, and last segment', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    let snap = engine.start(T0);
    expect(snap.prevAvailable).toBe(false);
    expect(snap.nextSegment?.name).toBe('Rest');

    snap = engine.tick(T0 + 40_000);
    expect(snap.prevAvailable).toBe(true);
    expect(snap.nextSegment?.name).toBe('Push-ups');

    snap = engine.tick(T0 + 60_000);
    expect(snap.nextSegment).toBeNull();
  });

  it('repeated tick() calls with an unchanged now are idempotent', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    engine.start(T0);
    const a = engine.tick(T0 + 5000);
    const b = engine.tick(T0 + 5000);
    expect(a.state).toBe(b.state);
    expect(a.segmentIndex).toBe(b.segmentIndex);
    expect(a.remainingMs).toBe(b.remainingMs);
  });

  it('restoreFromRecovery reconstructs a paused engine at the saved segment and elapsed time', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    const snap = engine.restoreFromRecovery(
      { segmentIndex: 1, remainingMs: 12_000, elapsedTotalMsAtSave: 60_000 },
      T0,
    );
    expect(snap.state).toBe('paused');
    expect(snap.segmentIndex).toBe(1);
    expect(snap.currentSegment?.name).toBe('Rest');
    expect(snap.remainingMs).toBe(12_000);
    expect(snap.elapsedTotalMs).toBe(60_000);

    const resumed = engine.resume(T0 + 1000);
    expect(resumed.state).toBe('rest');
    expect(resumed.remainingMs).toBe(12_000);
  });

  it('elapsedTotalMs accumulates real time and excludes time spent paused', () => {
    const engine = new WorkoutEngine(makeWorkout(), { getReadySeconds: 0 });
    engine.start(T0);
    engine.tick(T0 + 5000);
    engine.pause(T0 + 5000);
    let snap = engine.tick(T0 + 5000 + 60_000); // still paused; time shouldn't move
    expect(snap.elapsedTotalMs).toBe(5000);
    snap = engine.resume(T0 + 5000 + 60_000);
    snap = engine.tick(T0 + 5000 + 60_000 + 2000);
    expect(snap.elapsedTotalMs).toBe(7000);
  });
});
