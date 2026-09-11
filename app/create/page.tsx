'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { WorkoutEditor } from '@/components/editor/WorkoutEditor';
import { WorkoutActionBar } from '@/components/editor/WorkoutActionBar';
import { ScheduleSheet } from '@/components/calendar/ScheduleSheet';
import { blankWorkout } from '@/lib/workout/blank';
import { WorkoutSchema, type Workout } from '@/lib/workout/schema';
import { saveDraft } from '@/lib/workout/draftStore';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { createTemplate } from '@/lib/database/templates';
import { scheduleWorkout } from '@/lib/database/scheduled';
import { useAuthUser } from '@/hooks/useAuthUser';

export default function CreateWorkoutPage() {
  const router = useRouter();
  const user = useAuthUser();
  const [workout, setWorkout] = useState<Workout>(blankWorkout);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validation = WorkoutSchema.safeParse(workout);
  const canStart = validation.success && workout.title.trim() !== '';

  const handleStart = () => {
    const runId = uuid();
    saveDraft(runId, { workout, source: 'manual' });
    router.push(`/workout/${runId}/run`);
  };

  const handleSaveAsTemplate = async () => {
    if (!user) return setError('Sign in to save templates.');
    setSaving(true);
    setError(null);
    try {
      const client = createSupabaseBrowserClient();
      await createTemplate(client, { userId: user.id, workout, source: 'manual' });
      router.push('/workouts');
    } catch {
      setError('Could not save this template. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Create Workout</h1>
      {error && <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <WorkoutEditor value={workout} onChange={setWorkout} />
      <div className="h-6" />
      <WorkoutActionBar
        canStart={canStart}
        saving={saving}
        onStart={handleStart}
        onSaveAsTemplate={handleSaveAsTemplate}
        onSchedule={() => setScheduling(true)}
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
