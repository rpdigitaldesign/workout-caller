import type { Workout, WorkoutStep } from './schema';

/**
 * The workout engine is the single most important module in this app
 * (timer reliability is priority #1). It is a pure, framework-free state
 * machine: no setInterval-decrementing-a-counter, no DOM access, no
 * dependency on React. The only authoritative measure of time is
 * `targetEndTimestamp` (an epoch-ms deadline) compared against a `now`
 * passed in by the caller — this is what makes the timer immune to drift
 * from a throttled/backgrounded tab, since `remaining` is always
 * recomputed from real timestamps rather than accumulated by ticking.
 */

export type EngineState =
  | 'idle'
  | 'preparing'
  | 'exercise'
  | 'rest'
  | 'roundRest'
  | 'paused'
  | 'complete';

export type SegmentOrigin = 'warmup' | 'main' | 'cooldown';
export type SegmentKind = 'exercise' | 'rest' | 'roundRest';

export interface Segment {
  /** Stable-within-a-run key (not persisted) — unique per occurrence, since the same step id repeats across rounds. */
  key: string;
  origin: SegmentOrigin;
  kind: SegmentKind;
  name: string;
  /** null = manual-advance: the engine never auto-completes this segment; the user must call advanceManualStep(). */
  durationSeconds: number | null;
  announce: string | null;
  /** The WorkoutStep.id this segment was built from, or null for a synthetic round-rest segment. */
  stepId: string | null;
  /** 1-based round number for 'main' segments, else null. */
  roundNumber: number | null;
}

export type CompletionReason = 'finished' | 'early' | null;

export interface TimerSnapshot {
  state: EngineState;
  segmentIndex: number; // -1 before the workout has started
  totalSegments: number;
  roundNumber: number | null;
  totalRounds: number;
  /** ms remaining in the current segment; null when paused-with-no-timer, manual-advance, idle, or complete. */
  remainingMs: number | null;
  targetEndTimestamp: number | null;
  elapsedTotalMs: number;
  isManualAdvance: boolean;
  currentSegment: Segment | null;
  nextSegment: Segment | null;
  prevAvailable: boolean;
  completionReason: CompletionReason;
}

const PAUSABLE_STATES: ReadonlySet<EngineState> = new Set([
  'preparing',
  'exercise',
  'rest',
  'roundRest',
]);
const SKIPPABLE_STATES: ReadonlySet<EngineState> = new Set(['exercise', 'rest', 'roundRest']);

function toSegment(step: WorkoutStep, origin: SegmentOrigin, roundNumber: number | null, seq: number): Segment {
  return {
    key: `${origin}-${step.id}-${seq}`,
    origin,
    kind: step.type,
    name: step.name,
    durationSeconds: step.durationSeconds,
    announce: step.announce,
    stepId: step.id,
    roundNumber,
  };
}

/**
 * Flattens a Workout into an ordered list of Segments: warmup steps, then
 * (if `postWarmupRestSeconds` is set) a ONE-TIME rest, then `rounds`
 * repetitions of `steps` (with a synthetic roundRest segment between
 * repetitions — never after the last one, and never when roundRestSeconds
 * is null or 0), then (if `preCooldownRestSeconds` is set) a ONE-TIME
 * rest, then cooldown steps.
 *
 * The two one-time rests are represented as plain `kind: 'rest'` segments
 * (not `roundRest`) since they aren't tied to round repetition — this
 * reuses the existing rest handling everywhere downstream (engine state,
 * speech, UI) with no new segment kind required.
 */
export function buildSegments(workout: Workout): Segment[] {
  const segments: Segment[] = [];
  let seq = 0;

  for (const step of workout.warmup) {
    segments.push(toSegment(step, 'warmup', null, seq++));
  }

  if (workout.postWarmupRestSeconds !== null && workout.postWarmupRestSeconds > 0) {
    segments.push({
      key: `postwarmuprest-${seq++}`,
      origin: 'warmup',
      kind: 'rest',
      name: 'Rest',
      durationSeconds: workout.postWarmupRestSeconds,
      announce: null,
      stepId: null,
      roundNumber: null,
    });
  }

  for (let round = 1; round <= workout.rounds; round++) {
    for (const step of workout.steps) {
      segments.push(toSegment(step, 'main', round, seq++));
    }
    const isLastRound = round === workout.rounds;
    if (!isLastRound && workout.roundRestSeconds !== null && workout.roundRestSeconds > 0) {
      segments.push({
        key: `roundrest-${round}-${seq++}`,
        origin: 'main',
        kind: 'roundRest',
        name: 'Rest',
        durationSeconds: workout.roundRestSeconds,
        announce: null,
        stepId: null,
        roundNumber: round,
      });
    }
  }

  if (workout.preCooldownRestSeconds !== null && workout.preCooldownRestSeconds > 0) {
    segments.push({
      key: `precooldownrest-${seq++}`,
      origin: 'cooldown',
      kind: 'rest',
      name: 'Rest',
      durationSeconds: workout.preCooldownRestSeconds,
      announce: null,
      stepId: null,
      roundNumber: null,
    });
  }

  for (const step of workout.cooldown) {
    segments.push(toSegment(step, 'cooldown', null, seq++));
  }

  return segments;
}

export interface WorkoutEngineOptions {
  getReadySeconds: number;
}

export class WorkoutEngine {
  private readonly segments: Segment[];
  private readonly totalRounds: number;
  private readonly maxCascade: number;
  private readonly getReadySeconds: number;

  private state: EngineState = 'idle';
  private segmentIndex = -1;
  private targetEndTimestamp: number | null = null;

  private pausedFromState: EngineState | null = null;
  private pausedAt: number | null = null;
  private remainingMsAtPause: number | null = null;

  private startedAtWallClock: number | null = null;
  private totalPausedMs = 0;
  private completionReason: CompletionReason = null;

  constructor(workout: Workout, options: WorkoutEngineOptions) {
    this.segments = buildSegments(workout);
    this.totalRounds = workout.rounds;
    this.maxCascade = this.segments.length + 2;
    this.getReadySeconds = Math.max(0, options.getReadySeconds);
  }

  /**
   * Reconstructs a paused engine at a previously-saved point (used for
   * active-workout recovery after a reload). Always restores into the
   * `paused` state — never auto-resumes speech/audio, since resuming
   * requires a fresh user gesture. `elapsedTotalMsAtSave` is preserved so
   * elapsedTotalMs keeps counting up correctly after resume.
   */
  restoreFromRecovery(
    params: { segmentIndex: number; remainingMs: number | null; elapsedTotalMsAtSave: number },
    now = Date.now(),
  ): TimerSnapshot {
    if (this.state !== 'idle') return this.getSnapshot(now);
    const clamped = Math.max(0, Math.min(params.segmentIndex, this.segments.length - 1));
    this.segmentIndex = clamped;
    this.startedAtWallClock = now - params.elapsedTotalMsAtSave;
    this.totalPausedMs = 0;
    const segment = this.segments[clamped]!;
    this.pausedFromState = segment.kind;
    this.pausedAt = now;
    this.remainingMsAtPause = segment.durationSeconds !== null ? params.remainingMs : null;
    this.state = 'paused';
    this.targetEndTimestamp = null;
    return this.getSnapshot(now);
  }

  /** idle -> preparing. Must be called synchronously inside a user-gesture handler (Start Workout tap) so callers can also init AudioContext/speechSynthesis/wakeLock in the same gesture. */
  start(now = Date.now()): TimerSnapshot {
    if (this.state !== 'idle') return this.getSnapshot(now);
    this.startedAtWallClock = now;
    this.totalPausedMs = 0;
    this.state = 'preparing';
    this.segmentIndex = -1;
    this.targetEndTimestamp = now + this.getReadySeconds * 1000; // 0s get-ready resolves immediately via tick() below
    return this.tick(now);
  }

  pause(now = Date.now()): TimerSnapshot {
    if (!PAUSABLE_STATES.has(this.state)) return this.getSnapshot(now);
    this.pausedFromState = this.state;
    this.pausedAt = now;
    this.remainingMsAtPause = this.targetEndTimestamp !== null ? Math.max(0, this.targetEndTimestamp - now) : null;
    this.state = 'paused';
    this.targetEndTimestamp = null;
    return this.getSnapshot(now);
  }

  resume(now = Date.now()): TimerSnapshot {
    if (this.state !== 'paused' || this.pausedFromState === null || this.pausedAt === null) {
      return this.getSnapshot(now);
    }
    this.totalPausedMs += now - this.pausedAt;
    this.state = this.pausedFromState;
    this.targetEndTimestamp = this.remainingMsAtPause !== null ? now + this.remainingMsAtPause : null;
    this.pausedFromState = null;
    this.pausedAt = null;
    this.remainingMsAtPause = null;
    return this.getSnapshot(now);
  }

  /** Discards any remaining time in the current segment and starts the next one at its full duration. */
  skipForward(now = Date.now()): TimerSnapshot {
    if (!SKIPPABLE_STATES.has(this.state)) return this.getSnapshot(now);
    const nextIndex = this.segmentIndex + 1;
    if (nextIndex >= this.segments.length) {
      this.finish('finished');
      return this.getSnapshot(now);
    }
    this.segmentIndex = nextIndex;
    this.enterSegmentAt(now);
    return this.getSnapshot(now);
  }

  /** Returns to the previous segment at its full duration; clamps at the first segment rather than going negative. */
  skipBackward(now = Date.now()): TimerSnapshot {
    if (!SKIPPABLE_STATES.has(this.state)) return this.getSnapshot(now);
    this.segmentIndex = Math.max(0, this.segmentIndex - 1);
    this.enterSegmentAt(now);
    return this.getSnapshot(now);
  }

  /** For a manual-advance (durationSeconds === null) segment: the user taps Next instead of it auto-timing-out. */
  advanceManualStep(now = Date.now()): TimerSnapshot {
    const current = this.currentSegmentOrNull();
    if (!current || current.durationSeconds !== null) return this.getSnapshot(now);
    return this.skipForward(now);
  }

  /** Ends the workout before it would naturally finish (the "End Workout" flow). Caller is responsible for the confirmation dialog. */
  endEarly(now = Date.now()): TimerSnapshot {
    if (this.state === 'idle' || this.state === 'complete') return this.getSnapshot(now);
    this.finish('early');
    return this.getSnapshot(now);
  }

  /**
   * The reconciliation call. Must be invoked by the caller on a recurring
   * basis (e.g. every 250ms) AND immediately on `visibilitychange` back to
   * visible AND immediately after `resume()`. Never decrements a counter —
   * always recomputes from `now` vs `targetEndTimestamp`, cascading
   * through every segment boundary that has already passed (e.g. several
   * intervals' worth of time if the tab was backgrounded) rather than
   * jumping straight to wherever `now` lands.
   */
  tick(now = Date.now()): TimerSnapshot {
    let guard = 0;
    while (
      this.state !== 'paused' &&
      this.state !== 'complete' &&
      this.targetEndTimestamp !== null &&
      now >= this.targetEndTimestamp &&
      guard < this.maxCascade
    ) {
      this.advanceOneSegment();
      guard++;
    }
    return this.getSnapshot(now);
  }

  getSnapshot(now = Date.now()): TimerSnapshot {
    const segment = this.currentSegmentOrNull();
    const nextSegment = this.computeNextSegment();

    let remainingMs: number | null;
    if (this.state === 'paused') {
      remainingMs = this.remainingMsAtPause;
    } else if (this.targetEndTimestamp !== null) {
      remainingMs = Math.max(0, this.targetEndTimestamp - now);
    } else {
      remainingMs = null;
    }

    const clockNow = this.state === 'paused' && this.pausedAt !== null ? this.pausedAt : now;
    const elapsedTotalMs =
      this.startedAtWallClock !== null
        ? Math.max(0, clockNow - this.startedAtWallClock - this.totalPausedMs)
        : 0;

    return {
      state: this.state,
      segmentIndex: this.segmentIndex,
      totalSegments: this.segments.length,
      roundNumber: segment?.roundNumber ?? null,
      totalRounds: this.totalRounds,
      remainingMs,
      targetEndTimestamp: this.targetEndTimestamp,
      elapsedTotalMs,
      isManualAdvance: segment?.durationSeconds === null,
      currentSegment: segment,
      nextSegment,
      prevAvailable: this.segmentIndex > 0,
      completionReason: this.completionReason,
    };
  }

  private currentSegmentOrNull(): Segment | null {
    return this.segmentIndex >= 0 && this.segmentIndex < this.segments.length
      ? this.segments[this.segmentIndex]!
      : null;
  }

  private computeNextSegment(): Segment | null {
    if (this.state === 'preparing') return this.segments[0] ?? null;
    const nextIndex = this.segmentIndex + 1;
    return nextIndex < this.segments.length ? this.segments[nextIndex]! : null;
  }

  /** Advances exactly one step during tick()'s cascade: preparing -> first segment, or segment N -> N+1 -> complete. Anchors the new deadline to the OLD deadline (not `now`) so cascading through several missed boundaries doesn't drift. */
  private advanceOneSegment(): void {
    const anchor = this.targetEndTimestamp!;
    if (this.state === 'preparing') {
      this.segmentIndex = 0;
      this.enterSegmentAt(anchor);
      return;
    }
    const nextIndex = this.segmentIndex + 1;
    if (nextIndex >= this.segments.length) {
      this.finish('finished');
      return;
    }
    this.segmentIndex = nextIndex;
    this.enterSegmentAt(anchor);
  }

  /** Enters `segments[segmentIndex]` with a deadline anchored at `anchor` — `now` for skip/previous/manual-advance (discards remaining time), or the previous segment's exact boundary for tick()'s cascade (avoids drift). */
  private enterSegmentAt(anchor: number): void {
    const segment = this.segments[this.segmentIndex]!;
    this.state = segment.kind;
    this.targetEndTimestamp = segment.durationSeconds !== null ? anchor + segment.durationSeconds * 1000 : null;
  }

  private finish(reason: 'finished' | 'early'): void {
    this.state = 'complete';
    this.targetEndTimestamp = null;
    this.completionReason = reason;
  }
}
