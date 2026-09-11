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
      if (isRecovery) {
        const recovery = await loadActiveWorkout();
        if (cancelled) return;
        setSource(recovery ? { workout: recovery.workout, templateId: recovery.templateId, scheduledWorkoutId: recovery.scheduledWorkoutId, recoveryData: recovery } : null);
      } else {
        const draft = loadDraft(params.runId);
        setSource(draft ? { workout: draft.workout, templateId: draft.templateId ?? null, scheduledWorkoutId: draft.scheduledWorkoutId ?? null } : null);
      }
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
      workout={source.workout}
      templateId={source.templateId}
      scheduledWorkoutId={source.scheduledWorkoutId}
      isRecovery={isRecovery}
      recoveryData={source.recoveryData}
      userId={user?.id ?? null}
    />
  );
}
