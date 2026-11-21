'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { useSetResults } from '@/hooks/useSetResults';
import { segmentSetKey } from '@/lib/workout/setResults';
import type { Segment } from '@/lib/workout/engine';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useSpeechSettings } from '@/hooks/useSpeechSettings';
import { useIntervalAnnouncements } from '@/hooks/useIntervalAnnouncements';
import { GetReadyScreen } from './GetReadyScreen';
import { ExerciseScreen } from './ExerciseScreen';
import { RestScreen } from './RestScreen';
import { PauseOverlay } from './PauseOverlay';
import { CompletionScreen } from './CompletionScreen';
import { EndWorkoutDialog } from './EndWorkoutDialog';
import { Button } from '@/components/ui/Button';
import { speechController } from '@/lib/speech/speech';
import { toneController } from '@/lib/audio/tones';
import { estimateWorkoutDuration, formatDuration } from '@/lib/workout/duration';
import { saveActiveWorkout, clearActiveWorkout, type ActiveWorkoutRecovery } from '@/lib/offline/localStore';
import { completeWorkoutSession } from '@/lib/offline/syncQueue';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { saveDraft } from '@/lib/workout/draftStore';
import type { Workout } from '@/lib/workout/schema';

export interface ActiveRunProps {
  runId: string;
  workout: Workout;
  templateId: string | null;
  scheduledWorkoutId: string | null;
  isRecovery: boolean;
  recoveryData?: ActiveWorkoutRecovery | null;
  userId: string | null;
}

export function ActiveRun({ runId, workout, templateId, scheduledWorkoutId, isRecovery, recoveryData, userId }: ActiveRunProps) {
  const router = useRouter();
  const { settings, tonesEnabled, getReadySeconds } = useSpeechSettings();
  const timer = useWorkoutTimer(workout, getReadySeconds);
  const [phase, setPhase] = useState<'preview' | 'running'>(isRecovery ? 'running' : 'preview');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const leaveFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'synced' | 'queued'>('idle');
  const restoredRef = useRef(false);
  const completionHandledRef = useRef(false);

  const sets = useSetResults(userId, recoveryData?.setResults ?? []);
  const snapshot = timer.snapshot;

  // Which set is the weight for? The set just finished while resting; or, for a set with no
  // rest after it (e.g. the last exercise), the set in progress.
  const weightSegment: Segment | null =
    snapshot.state === 'rest' || snapshot.state === 'roundRest'
      ? snapshot.previousSegment?.kind === 'exercise'
        ? snapshot.previousSegment
        : null
      : snapshot.state === 'exercise' && (snapshot.nextSegment === null || snapshot.nextSegment.kind === 'exercise')
        ? snapshot.currentSegment
        : null;
  const weightProps = (() => {
    if (!weightSegment) return null;
    const setId = segmentSetKey(weightSegment);
    if (setId === null) return null;
    const { logged, suggestion } = sets.entryFor(weightSegment);
    const set = weightSegment.roundNumber !== null && snapshot.totalRounds > 1 ? ` · set ${weightSegment.roundNumber}` : '';
    return {
      setId,
      label: `${weightSegment.name}${set}`,
      logged,
      suggestion,
      onLog: (w: number | null) => sets.log(weightSegment, w),
    };
  })();
  const isRunActive = phase === 'running' && snapshot.state !== 'idle' && snapshot.state !== 'complete';

  useWakeLock(isRunActive);
  const { leave } = useLeaveGuard(isRunActive, () => {
    timer.pause();
    setConfirmLeave(true);
  });
  useEffect(
    () => () => {
      if (leaveFallbackRef.current) clearTimeout(leaveFallbackRef.current);
    },
    [],
  );
  useIntervalAnnouncements(snapshot, settings, tonesEnabled);

  // Restore a recovered run's exact position once, on mount.
  useEffect(() => {
    if (isRecovery && recoveryData && !restoredRef.current) {
      restoredRef.current = true;
      timer.restoreFromRecovery({
        segmentIndex: recoveryData.segmentIndex,
        remainingMs: recoveryData.remainingMs,
        elapsedTotalMsAtSave: recoveryData.elapsedTotalMsAtSave,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecovery, recoveryData]);

  // Persist recovery state on meaningful transitions (not every 250ms tick).
  useEffect(() => {
    if (!isRunActive) return;
    void saveActiveWorkout({
      runId,
      workout,
      templateId,
      scheduledWorkoutId,
      getReadySeconds,
      segmentIndex: snapshot.segmentIndex,
      remainingMs: snapshot.remainingMs,
      elapsedTotalMsAtSave: snapshot.elapsedTotalMs,
      setResults: sets.results,
      savedAt: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.segmentIndex, snapshot.state, sets.results]);

  // Handle completion: save the session (offline-safe) and clear recovery state.
  useEffect(() => {
    if (snapshot.state !== 'complete' || completionHandledRef.current) return;
    completionHandledRef.current = true;
    void (async () => {
      await clearActiveWorkout();
      speechController.cancel();

      if (!userId) {
        setSaveState('queued');
        return;
      }

      const status = snapshot.completionReason === 'early' ? 'partial' : 'completed';
      const client = createSupabaseBrowserClient();
      try {
        const { synced } = await completeWorkoutSession(client, {
          userId,
          templateId,
          scheduledWorkoutId,
          workoutSnapshot: workout,
          title: workout.title,
          startedAt: new Date(Date.now() - snapshot.elapsedTotalMs).toISOString(),
          completedAt: new Date().toISOString(),
          status,
          actualDurationSeconds: Math.round(snapshot.elapsedTotalMs / 1000),
          completedIntervals: snapshot.segmentIndex + 1,
          totalIntervals: snapshot.totalSegments,
          setResults: sets.results,
        });
        setSaveState(synced ? 'synced' : 'queued');
      } catch {
        setSaveState('queued');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.state]);

  useEffect(() => {
    return () => {
      // Leaving the run page entirely (not just pausing) — stop any in-flight speech and release audio.
      speechController.cancel();
    };
  }, []);

  const handleStart = () => {
    // Must happen synchronously inside this click handler — the user gesture required by iOS for audio/speech.
    speechController.prime();
    toneController.init();
    timer.start();
    setPhase('running');
  };

  const handleResume = () => {
    speechController.prime();
    toneController.init();
    timer.resume();
  };

  const handleRepeat = () => {
    const runId = uuid();
    saveDraft(runId, { workout, source: 'manual', templateId, scheduledWorkoutId: null });
    router.push(`/workout/${runId}/run`);
  };

  if (phase === 'preview') {
    const estimate = estimateWorkoutDuration(workout);
    return (
      <div className="flex h-safe-dvh flex-col items-center overflow-hidden bg-bg px-6 py-8 text-center short:py-3">
        <h1 className="line-clamp-2 shrink-0 text-3xl font-bold short:text-xl">{workout.title}</h1>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden short:gap-1.5">
          <p className="text-text-muted short:text-sm">
            {workout.rounds} round{workout.rounds === 1 ? '' : 's'} · Estimated {formatDuration(estimate.totalSeconds)}
            {estimate.hasManualSteps ? '+' : ''}
          </p>
          <p className="line-clamp-2 max-w-sm text-sm text-text-muted short:hidden">
            For the most reliable timing, keep Workout Caller open while exercising.
          </p>
        </div>

        <Button size="lg" onClick={handleStart} className="shrink-0 short:min-h-10 short:py-2 short:text-sm">
          Start Workout
        </Button>
      </div>
    );
  }

  if (snapshot.state === 'complete') {
    return (
      <CompletionScreen
        snapshot={snapshot}
        synced={saveState === 'synced' ? true : saveState === 'queued' ? false : null}
        onDone={() => router.push('/')}
        onRepeat={handleRepeat}
      />
    );
  }

  return (
    <>
      {snapshot.state === 'preparing' && <GetReadyScreen snapshot={snapshot} />}
      {snapshot.state === 'exercise' && (
        <ExerciseScreen
          snapshot={snapshot}
          onPause={timer.pause}
          onSkip={timer.skipForward}
          onPrevious={timer.skipBackward}
          onAdvanceManual={timer.advanceManualStep}
          weight={weightProps}
        />
      )}
      {(snapshot.state === 'rest' || snapshot.state === 'roundRest') && (
        <RestScreen
          snapshot={snapshot}
          onPause={timer.pause}
          onSkip={timer.skipForward}
          onPrevious={timer.skipBackward}
          weight={weightProps}
        />
      )}
      {snapshot.state === 'paused' && (
        <PauseOverlay snapshot={snapshot} onResume={handleResume} onEndEarly={() => setConfirmEnd(true)} />
      )}
      <ConfirmDialog
        open={confirmLeave}
        title="Leave this workout?"
        description="Your workout is paused, not lost. You can pick it up again from the Home screen."
        confirmLabel="Leave"
        cancelLabel="Keep going"
        danger
        initialFocus="cancel"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          leave();
          // If there was no earlier page to go back to, fall back to Home.
          leaveFallbackRef.current = setTimeout(() => router.push('/'), 400);
        }}
      />
      <EndWorkoutDialog
        open={confirmEnd}
        onContinue={() => setConfirmEnd(false)}
        onSavePartial={() => {
          setConfirmEnd(false);
          timer.endEarly();
        }}
        onDiscard={async () => {
          setConfirmEnd(false);
          await clearActiveWorkout();
          speechController.cancel();
          router.push('/');
        }}
      />
    </>
  );
}
