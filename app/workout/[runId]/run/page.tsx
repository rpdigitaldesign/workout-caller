'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ActiveRun } from '@/components/workout-run/ActiveRun';
import { useAuthUser } from '@/hooks/useAuthUser';
import { loadDraft } from '@/lib/workout/draftStore';
import { loadActiveWorkout, type ActiveWorkoutRecovery } from '@/lib/offline/localStore';
import type { Workout } from '@/lib/workout/schema';

interface RunSource {
  workout: Workout;
  templateId: string | null;
  scheduledWorkoutId: string | null;
  recoveryData?: ActiveWorkoutRecovery | null;
}

export default function RunWorkoutPage() {
  const params = useParams<{ runId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = useAuthUser();
  const isRecovery = searchParams.get('recover') === '1';

  const [source, setSource] = useState<RunSource | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Always check for a recovery record — not just when `?recover=1` is
      // present — so a plain browser refresh on THIS SAME run URL (no query
      // param at all) can still find and restore its own in-progress state,
      // rather than silently falling through to the pre-start draft and
      // discarding progress. `?recover=1` (the Home-banner entry point,
      // which mints a fresh runId unrelated to the original run) still
      // forces recovery unconditionally, regardless of any runId match.
      const recovery = await loadActiveWorkout();
      if (cancelled) return;
      const matchesThisRun = recovery !== null && recovery.runId === params.runId;

      if (isRecovery || matchesThisRun) {
        setSource(recovery ? { workout: recovery.workout, templateId: recovery.templateId, scheduledWorkoutId: recovery.scheduledWorkoutId, recoveryData: recovery } : null);
        return;
      }

      const draft = loadDraft(params.runId);
      setSource(draft ? { workout: draft.workout, templateId: draft.templateId ?? null, scheduledWorkoutId: draft.scheduledWorkoutId ?? null } : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isRecovery, params.runId]);

  if (source === undefined) {
    return <div className="flex min-h-dvh items-center justify-center bg-bg text-text-muted">Loading…</div>;
  }

  if (source === null) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg text-center">
        <p className="text-text-muted">This workout couldn&apos;t be loaded — it may have expired.</p>
        <button className="text-accent underline" onClick={() => router.push('/')}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <ActiveRun
      runId={params.runId}
      workout={source.workout}
      templateId={source.templateId}
      scheduledWorkoutId={source.scheduledWorkoutId}
      isRecovery={source.recoveryData != null}
      recoveryData={source.recoveryData}
      userId={user?.id ?? null}
    />
  );
}
