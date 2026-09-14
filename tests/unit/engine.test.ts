import { describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { WorkoutEngine, buildSegments } from '@/lib/workout/engine';
import type { Workout, WorkoutStep } from '@/lib/workout/schema';

function step(name: string, durationSeconds: number | null, restAfterSeconds: number | null = null): WorkoutStep {
  return { id: uuid(), name, durationSeconds, reps: null, restAfterSeconds, notes: null, announce: null };
}

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    title: 'Test Workout',
    rounds: 1,
    roundRestSeconds: null,
    warmup: [],
    steps: [step('Squats', 40, 20), step('Push-ups', 30)],
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
    // Squats + rest(20) + Push-ups, per round.
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

  it("a step's restAfterSeconds produces a rest segment immediately after it", () => {
    const workout = makeWorkout({ warmup: [step('Jog', 60, 15)] });
    const segments = buildSegments(workout);
    expect(segments[0]!.name).toBe('Jog');
    expect(segments[1]!.kind).toBe('rest');
    expect(segments[1]!.durationSeconds).toBe(15);
  });

  it("the last warmup step's restAfterSeconds acts as a one-time rest before round 1, never repeated across rounds", () => {
    const workout = makeWorkout({
      warmup: [step('Walking warmup', 300, 60)],
      steps: [step('Squats', 40)],
      rounds: 3,
    });
    const segments = buildSegments(workout);
    // warmup(1) + rest(1) + 3 rounds * 1 step = 5
    expect(segments).toHaveLength(1 + 1 + 3);
    expect(segments[0]!.name).toBe('Walking warmup');
    expect(segments[1]!.kind).toBe('rest');
    expect(segments[1]!.durationSeconds).toBe(60);
    expect(segments[1]!.origin).toBe('warmup');
    expect(segments[1]!.roundNumber).toBeNull();
    // It occurs exactly once, not once per round.
    expect(segments.filter((s) => s.durationSeconds === 60).length).toBe(1);
    expect(segments[2]!.name).toBe('Squats');
    expect(segments[2]!.roundNumber).toBe(1);
  });

  it('omits per-step rest when restAfterSeconds is null or explicit 0, distinct from roundRestSeconds', () => {
    const workout = makeWorkout({
      warmup: [step('Warmup', 60, 0)], // explicit zero -> no rest, even though it's the last warmup item
      steps: [step('Squats', 40, null)], // no pre-cooldown rest on the final round's last step
      rounds: 2,
      cooldown: [step('Stretch', 60)],
      roundRestSeconds: 15,
    });
    const segments = buildSegments(workout);
    // warmup(1, no rest) + round1 Squats(1)+roundRest(1) + round2 Squats(1, no rest) + cooldown(1) = 5
    expect(segments).toHaveLength(5);
    expect(segments.filter((s) => s.kind === 'rest').length).toBe(0);
    expect(segments.filter((s) => s.kind === 'roundRest').length).toBe(1);
  });

  describe('pre-cooldown rest correctness (the last main step doubling as a one-time transition)', () => {
    it('1 round: the last (only) main step\'s restAfterSeconds fires once, before cooldown', () => {
      const workout = makeWorkout({
        steps: [step('Squats', 40, 30)],
        rounds: 1,
        cooldown: [step('Stretch', 20)],
      });
      const segments = buildSegments(workout);
      expect(segments).toHaveLength(3);
      expect(segments[0]!.name).toBe('Squats');
      expect(segments[1]!.kind).toBe('rest');
      expect(segments[1]!.durationSeconds).toBe(30);
      expect(segments[2]!.name).toBe('Stretch');
    });

    it('multiple rounds + roundRestSeconds + the last step\'s restAfterSeconds: roundRest fires at every non-final boundary, the one-time rest fires exactly once after the final round', () => {
      const workout = makeWorkout({
        steps: [step('Squats', 40, 30)],
        rounds: 3,
        roundRestSeconds: 15,
        cooldown: [step('Stretch', 20)],
      });
      const segments = buildSegments(workout);
      const roundRests = segments.filter((s) => s.kind === 'roundRest');
      const oneTimeRests = segments.filter((s) => s.kind === 'rest');
      expect(roundRests).toHaveLength(2);
      expect(roundRests.every((s) => s.durationSeconds === 15)).toBe(true);
      expect(oneTimeRests).toHaveLength(1);
      expect(oneTimeRests[0]!.durationSeconds).toBe(30);
      // The one-time rest sits immediately before cooldown, at the very end.
      const stretchIndex = segments.findIndex((s) => s.name === 'Stretch');
      expect(segments[stretchIndex - 1]).toBe(oneTimeRests[0]);
      // It must NOT appear after round 1 or round 2's Squats — only roundRest does there.
      const squatsIndices = segments.reduce<number[]>((acc, s, i) => (s.name === 'Squats' ? [...acc, i] : acc), []);
      expect(segments[squatsIndices[0]! + 1]!.kind).toBe('roundRest');
      expect(segments[squatsIndices[1]! + 1]!.kind).toBe('roundRest');
      expect(segments[squatsIndices[2]! + 1]!.kind).toBe('rest');
    });

    it('multiple rounds with NO round rest + the last step\'s restAfterSeconds: no rest between non-final rounds, one-time rest still fires once at the end', () => {
      const workout = makeWorkout({
        steps: [step('Squats', 40, 30)],
        rounds: 3,
        roundRestSeconds: null,
        cooldown: [step('Stretch', 20)],
      });
      const segments = buildSegments(workout);
      expect(segments.filter((s) => s.kind === 'roundRest')).toHaveLength(0);
      const restSegments = segments.filter((s) => s.kind === 'rest');
      expect(restSegments).toHaveLength(1);
      expect(restSegments[0]!.durationSeconds).toBe(30);
      // Squats appears 3 times back-to-back with no rest between rounds 1-2 or 2-3.
      const names = segments.map((s) => s.name);
      expect(names).toEqual(['Squats', 'Squats', 'Squats', 'Rest', 'Stretch']);
    });

    it('exercise-level rest + round rest + the last step\'s one-time restAfterSeconds all fire independently with no interference', () => {
      const workout = makeWorkout({
        steps: [step('Squats', 40, 10), step('Push-ups', 30, 30)],
        rounds: 2,
        roundRestSeconds: 45,
        cooldown: [step('Stretch', 20)],
      });
      const segments = buildSegments(workout);
      const kindsAndDurations = segments.map((s) => `${s.kind}:${s.durationSeconds}`);
      expect(kindsAndDurations).toEqual([
        'exercise:40', // Squats round 1
        'rest:10', // Squats' own inter-exercise rest
        'exercise:30', // Push-ups round 1
        'roundRest:45', // between rounds — Push-ups' own restAfterSeconds (30) ignored here
        'exercise:40', // Squats round 2
        'rest:10',
        'exercise:30', // Push-ups round 2 (final round)
        'rest:30', // Push-ups' own restAfterSeconds now fires — one-time, before cooldown
        'exercise:20', // Stretch
      ]);
    });

    it('no cooldown: the last main step of the final round is the true final step, so its restAfterSeconds never fires', () => {
      const workout = makeWorkout({
        steps: [step('Squats', 40, 30)],
        rounds: 2,
        roundRestSeconds: 15,
        cooldown: [],
      });
      const segments = buildSegments(workout);
      expect(segments).toHaveLength(3); // Squats, roundRest, Squats
      expect(segments[segments.length - 1]!.name).toBe('Squats');
      expect(segments.some((s) => s.durationSeconds === 30)).toBe(false);
    });

    it('no warmup: the main section starts immediately with no missing or extra segment', () => {
      const workout = makeWorkout({ warmup: [], steps: [step('Squats', 40)], rounds: 1 });
      const segments = buildSegments(workout);
      expect(segments[0]!.origin).toBe('main');
      expect(segments[0]!.name).toBe('Squats');
    });

    it('rounds:1 with roundRestSeconds set never fires a round rest (no round boundary exists)', () => {
      const workout = makeWorkout({ steps: [step('Squats', 40)], rounds: 1, roundRestSeconds: 20 });
      const segments = buildSegments(workout);
      expect(segments.some((s) => s.kind === 'roundRest')).toBe(false);
    });
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

  it('transitions exercise -> rest -> exercise for a single round via restAfterSeconds', () => {
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

  it('a reps-based step is manual-advance and carries its reps count through to the segment', () => {
    const workout = makeWorkout({ steps: [{ ...step('Glute Bridge', null), reps: 15 }], rounds: 1 });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 0 });
    const snap = engine.start(T0);
    expect(snap.isManualAdvance).toBe(true);
    expect(snap.currentSegment?.reps).toBe(15);
  });

  it('cascades through every intermediate segment boundary when tick is called long after several should have elapsed (backgrounded tab)', () => {
    const workout = makeWorkout({ steps: [step('A', 10, 10), step('C', 10)], rounds: 3, roundRestSeconds: 5 });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 0 });
    engine.start(T0);
    // Jump far past the entire workout in one tick.
    const snap = engine.tick(T0 + 10_000_000);
    expect(snap.state).toBe('complete');
    expect(snap.completionReason).toBe('finished');
  });

  it('cascades to a specific mid-workout point correctly, not just to complete', () => {
    const workout = makeWorkout({ steps: [step('A', 10, 10), step('C', 10)], rounds: 2, roundRestSeconds: 5 });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 0 });
    engine.start(T0);
    // A(10) + rest(10) + C(10) + roundRest(5) = 35s elapses exactly into round 2's A.
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

  it('plays through warmup -> one-time post-warmup rest (via the last warmup step) -> round 1, occurring only once even across multiple rounds', () => {
    const workout = makeWorkout({
      warmup: [step('Walking warmup', 300, 60)],
      steps: [step('Squats', 40)],
      rounds: 2,
    });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 0 });
    let snap = engine.start(T0);
    expect(snap.state).toBe('exercise');
    expect(snap.currentSegment?.name).toBe('Walking warmup');

    snap = engine.tick(T0 + 300_000);
    expect(snap.state).toBe('rest');
    expect(snap.remainingMs).toBe(60_000);

    snap = engine.tick(T0 + 300_000 + 60_000);
    expect(snap.state).toBe('exercise');
    expect(snap.currentSegment?.name).toBe('Squats');
    expect(snap.roundNumber).toBe(1);

    // Advance into round 2 — the post-warmup rest must not repeat.
    snap = engine.tick(T0 + 300_000 + 60_000 + 40_000);
    expect(snap.state).toBe('exercise');
    expect(snap.roundNumber).toBe(2);
  });

  it("plays through the last round -> one-time pre-cooldown rest (via the last main step) -> cooldown", () => {
    const workout = makeWorkout({
      steps: [step('Squats', 40, 30)],
      rounds: 1,
      cooldown: [step('Stretch', 20)],
    });
    const engine = new WorkoutEngine(workout, { getReadySeconds: 0 });
    let snap = engine.start(T0);
    expect(snap.currentSegment?.name).toBe('Squats');

    snap = engine.tick(T0 + 40_000);
    expect(snap.state).toBe('rest');
    expect(snap.remainingMs).toBe(30_000);

    snap = engine.tick(T0 + 40_000 + 30_000);
    expect(snap.state).toBe('exercise');
    expect(snap.currentSegment?.name).toBe('Stretch');

    snap = engine.tick(T0 + 40_000 + 30_000 + 20_000);
    expect(snap.state).toBe('complete');
  });
});
