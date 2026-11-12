'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { WorkoutEditor } from '@/components/editor/WorkoutEditor';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { getScheduledWorkout, updateScheduledWorkout } from '@/lib/database/scheduled';
import { WorkoutSchema, type ScheduledWorkout, type Workout } from '@/lib/workout/schema';

const LABEL = 'mb-1 block text-sm font-semibold uppercase tracking-wide text-text-muted';
const INPUT = 'focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5';

export default function EditScheduledWorkoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<ScheduledWorkout | null | undefined>(undefined);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmingBack, setConfirmingBack] = useState(false);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void getScheduledWorkout(client, params.id).then((s) => {
      setItem(s);
      if (!s) return;
      setWorkout(s.workoutSnapshot);
      setDate(s.scheduledDate);
      setTime(s.scheduledTime ? s.scheduledTime.slice(0, 5) : '');
      setNotes(s.notes ?? '');
    });
  }, [params.id]);

  if (item === undefined) return <div className="mx-auto max-w-2xl px-4 py-8">Loading…</div>;
  if (item === null || !workout) return <div className="mx-auto max-w-2xl px-4 py-8">Scheduled workout not found.</div>;
  if (item.status !== 'scheduled') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-text-muted">This workout can no longer be edited because it is {item.status}.</p>
        <Button className="mt-4" variant="secondary" onClick={() => router.push(`/calendar/day/${item.scheduledDate}`)}>
          Back to the day
        </Button>
      </div>
    );
  }

  const backTarget = `/calendar/day/${item.scheduledDate}`;
  const canSave = WorkoutSchema.safeParse(workout).success && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const handleBack = () => {
    if (!isDirty) {
      router.push(backTarget);
      return;
    }
    setConfirmingBack(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const client = createSupabaseBrowserClient();
      await updateScheduledWorkout(client, item.id, {
        workoutSnapshot: workout,
        scheduledDate: date,
        scheduledTime: time === '' ? null : time,
        notes: notes.trim() === '' ? null : notes.trim(),
      });
      router.push(`/calendar/day/${date}`);
    } catch {
      setError('Could not save your changes.');
    } finally {
      setSaving(false);
    }
  };

  const markDirty = () => setIsDirty(true);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-2">
        <BackButton onClick={handleBack} label="Back to the day" />
      </div>
      <h1 className="text-2xl font-bold">Edit Scheduled Workout</h1>
      <p className="mb-6 mt-1 text-sm text-text-muted">
        Changes apply to this scheduled workout only. The saved workout it came from is not changed.
      </p>
      {error && <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mb-6 flex flex-col gap-4">
        <div>
          <label htmlFor="sched-date" className={LABEL}>Date</label>
          <input
            id="sched-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              markDirty();
            }}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="sched-time" className={LABEL}>Time (optional)</label>
          <input
            id="sched-time"
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              markDirty();
            }}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="sched-notes" className={LABEL}>Notes (optional)</label>
          <input
            id="sched-notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              markDirty();
            }}
            placeholder="Gym before work, hotel gym, use dumbbells..."
            className={INPUT}
          />
        </div>
      </div>

      <WorkoutEditor
        value={workout}
        onChange={(next) => {
          setWorkout(next);
          markDirty();
        }}
      />
      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] -mx-4 mt-6 flex gap-3 border-t border-border bg-bg/95 px-4 py-4 backdrop-blur md:bottom-0">
        <Button size="lg" disabled={!canSave || saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmingBack}
        title="Discard changes?"
        description="You have unsaved changes to this scheduled workout."
        confirmLabel="Discard"
        cancelLabel="Continue editing"
        danger
        initialFocus="cancel"
        onCancel={() => setConfirmingBack(false)}
        onConfirm={() => router.push(backTarget)}
      />
    </div>
  );
}
