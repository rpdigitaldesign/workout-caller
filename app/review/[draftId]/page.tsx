'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { WorkoutEditor } from '@/components/editor/WorkoutEditor';
import { WorkoutActionBar } from '@/components/editor/WorkoutActionBar';
import { ScheduleSheet } from '@/components/calendar/ScheduleSheet';
import { DiffPreview } from '@/components/modify/DiffPreview';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { WorkoutSchema, type Workout } from '@/lib/workout/schema';
import { loadDraft, saveDraft, type WorkoutDraft } from '@/lib/workout/draftStore';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { createTemplate } from '@/lib/database/templates';
import { scheduleWorkout } from '@/lib/database/scheduled';
import { useAuthUser } from '@/hooks/useAuthUser';

export default function ReviewWorkoutPage() {
  const params = useParams<{ draftId: string }>();
  const router = useRouter();
  const user = useAuthUser();

  const [draft, setDraft] = useState<WorkoutDraft | null | undefined>(undefined);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingBack, setConfirmingBack] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    // sessionStorage is only available client-side; deferring this read to an
    // effect (rather than a lazy useState initializer) avoids a server/client
    // hydration mismatch, since this page is also rendered once on the server.
    const loaded = loadDraft(params.draftId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(loaded);
    if (loaded) setWorkout(loaded.workout);
  }, [params.draftId]);

  if (draft === undefined) return <div className="mx-auto max-w-2xl px-4 py-8">Loading…</div>;
  if (draft === null || !workout) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-text-muted">This draft has expired or was already used.</p>
        <button className="mt-4 text-accent underline" onClick={() => router.push('/')}>
          Back to Home
        </button>
      </div>
    );
  }

  const validation = WorkoutSchema.safeParse(workout);
  const canStart = validation.success && workout.title.trim() !== '';

  const handleBack = () => {
    if (!isDirty) {
      router.push('/');
      return;
    }
    setConfirmingBack(true);
  };

  const handleSaveDraftAndLeave = () => {
    saveDraft(params.draftId, { ...draft, workout });
    setConfirmingBack(false);
    router.push('/');
  };

  const handleStart = () => {
    const runId = uuid();
    saveDraft(runId, {
      workout,
      source: draft.source,
      templateId: draft.parentTemplateId ?? null,
    });
    router.push(`/workout/${runId}/run`);
  };

  const handleSaveAsTemplate = async () => {
    if (!user) return setError('Sign in to save templates.');
    setSaving(true);
    setError(null);
    try {
      const client = createSupabaseBrowserClient();
      await createTemplate(client, {
        userId: user.id,
        workout,
        source: draft.source === 'manual' ? 'manual' : 'ai',
        parentTemplateId: draft.parentTemplateId ?? null,
      });
      router.push('/workouts');
    } catch {
      setError('Could not save this template. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="focus-ring -ml-1 rounded-lg px-1 py-1 text-sm font-semibold text-text-muted hover:text-text"
        >
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold">Review Workout</h1>
      </div>
      {draft.parentTemplateId && <p className="mb-4 text-sm text-text-muted">Based on an existing workout</p>}
      {error && <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {draft.originalWorkout && (
        <div className="mb-6">
          <DiffPreview original={draft.originalWorkout} modified={workout} />
        </div>
      )}

      <WorkoutEditor
        value={workout}
        onChange={(next) => {
          setWorkout(next);
          setIsDirty(true);
        }}
      />
      <div className="h-6" />
      <WorkoutActionBar
        canStart={canStart}
        saving={saving}
        onStart={handleStart}
        onSaveAsTemplate={handleSaveAsTemplate}
        onSchedule={() => setScheduling(true)}
        onBack={handleBack}
      />
      <ConfirmDialog
        open={confirmingBack}
        title="Leave without saving?"
        description="You have unsaved changes to this workout."
        confirmLabel="Discard"
        cancelLabel="Continue editing"
        danger
        initialFocus="cancel"
        onCancel={() => setConfirmingBack(false)}
        onConfirm={() => router.push('/')}
        extraAction={{ label: 'Save draft', onClick: handleSaveDraftAndLeave }}
      />
      <ScheduleSheet
        open={scheduling}
        workoutTitle={workout.title || 'Untitled Workout'}
        onClose={() => setScheduling(false)}
        onConfirm={async ({ date, time, notes }) => {
          if (!user) return setError('Sign in to schedule workouts.');
          const client = createSupabaseBrowserClient();
          await scheduleWorkout(client, {
            userId: user.id,
            workoutSnapshot: workout,
            title: workout.title || 'Untitled Workout',
            scheduledDate: date,
            scheduledTime: time,
            notes,
          });
          router.push('/calendar');
        }}
      />
    </div>
  );
}
