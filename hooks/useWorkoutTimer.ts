'use client';

import { useEffect, useState } from 'react';
import { WorkoutEngine, type TimerSnapshot } from '@/lib/workout/engine';
import type { Workout } from '@/lib/workout/schema';

const TICK_INTERVAL_MS = 250;

export interface UseWorkoutTimerResult {
  snapshot: TimerSnapshot;
  start: () => void;
  restoreFromRecovery: (params: { segmentIndex: number; remainingMs: number | null; elapsedTotalMsAtSave: number }) => void;
  pause: () => void;
  resume: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  advanceManualStep: () => void;
  endEarly: () => void;
}

/**
 * The single owner of a WorkoutEngine instance and its recurring tick.
 * Every workout-run screen renders purely from `snapshot` — no component
 * keeps its own competing timer state. Re-ticks immediately on
 * visibilitychange so returning to a backgrounded tab always recomputes
 * from real elapsed time rather than resuming a stale countdown.
 *
 * The engine instance itself is created via useState's lazy initializer
 * (not a ref read during render) so it's created exactly once and never
 * touched outside effects/handlers thereafter.
 */
export function useWorkoutTimer(workout: Workout, getReadySeconds: number): UseWorkoutTimerResult {
  const [engine] = useState(() => new WorkoutEngine(workout, { getReadySeconds }));
  const [snapshot, setSnapshot] = useState<TimerSnapshot>(() => engine.getSnapshot());

  useEffect(() => {
    const interval = window.setInterval(() => setSnapshot(engine.tick()), TICK_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setSnapshot(engine.tick());
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [engine]);

  return {
    snapshot,
    start: () => setSnapshot(engine.start()),
    restoreFromRecovery: (params) => setSnapshot(engine.restoreFromRecovery(params)),
    pause: () => setSnapshot(engine.pause()),
    resume: () => setSnapshot(engine.resume()),
    skipForward: () => setSnapshot(engine.skipForward()),
    skipBackward: () => setSnapshot(engine.skipBackward()),
    advanceManualStep: () => setSnapshot(engine.advanceManualStep()),
    endEarly: () => setSnapshot(engine.endEarly()),
  };
}
