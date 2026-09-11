'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { QuickAddSheet } from '@/components/calendar/QuickAddSheet';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { listScheduledWorkoutsOnDate, rescheduleWorkout, skipScheduledWorkout, cancelScheduledWorkout } from '@/lib/database/scheduled';
import { listSessionsBetween } from '@/lib/database/sessions';
import { saveDraft } from '@/lib/workout/draftStore';
import { formatDuration } from '@/lib/workout/duration';
import type { ScheduledWorkout, WorkoutSession } from '@/lib/workout/schema';

function ScheduledCard({ item, onChanged }: { item: ScheduledWorkout; onChanged: () => void }) {
  const router = useRouter();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState(item.scheduledDate);

  const handleStart = () => {
    const runId = uuid();
    saveDraft(runId, { workout: item.workoutSnapshot, source: 'manual', templateId: item.templateId, scheduledWorkoutId: item.id });
    router.push(`/workout/${runId}/run`);
  };

  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Scheduled</p>
      <h3 className="text-lg font-semibold">{item.title}</h3>
      {item.scheduledTime && <p className="text-text-muted">{item.scheduledTime}</p>}
      {item.notes && <p className="mt-1 text-sm text-text-muted">{item.notes}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="md" onClick={handleStart}>
          Start
        </Button>
        <Button size="md" variant="secondary" onClick={() => setRescheduling((v) => !v)}>
          Reschedule
        </Button>
        <Button size="md" variant="secondary" onClick={() => setConfirmSkip(true)}>
          Skip
        </Button>
        <Button size="md" variant="danger" onClick={() => setConfirmCancel(true)}>
          Cancel
        </Button>
      </div>
      {rescheduling && (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="focus-ring rounded-lg border border-border bg-bg px-3 py-2"
          />
          <Button
            size="md"
            onClick={async () => {
              const client = createSupabaseBrowserClient();
              await rescheduleWorkout(client, item.id, newDate, item.scheduledTime);
              setRescheduling(false);
              onChanged();
            }}
          >
            Move
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmSkip}
        title="Skip this workout?"
        description="It stays in your history as skipped — nothing is deleted."
        confirmLabel="Skip"
        onConfirm={async () => {
          const client = createSupabaseBrowserClient();
          await skipScheduledWorkout(client, item.id);
          setConfirmSkip(false);
          onChanged();
        }}
        onCancel={() => setConfirmSkip(false)}
      />
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this scheduled workout?"
        confirmLabel="Cancel Workout"
        danger
        onConfirm={async () => {
          const client = createSupabaseBrowserClient();
          await cancelScheduledWorkout(client, item.id);
          setConfirmCancel(false);
          onChanged();
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </Card>
  );
}

function CompletedCard({ session }: { session: WorkoutSession }) {
  const router = useRouter();
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {session.status === 'partial' ? 'Partial' : 'Completed'}
      </p>
      <h3 className="text-lg font-semibold">{session.title}</h3>
      <p className="text-text-muted">
        {new Date(session.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        {session.actualDurationSeconds !== null ? ` · ${formatDuration(session.actualDurationSeconds)}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="md" variant="secondary" onClick={() => router.push(`/history/${session.id}`)}>
          View
        </Button>
        <Button
          size="md"
          variant="secondary"
          onClick={() => {
            const runId = uuid();
            saveDraft(runId, { workout: session.workoutSnapshot, source: 'manual', templateId: session.templateId });
            router.push(`/workout/${runId}/run`);
          }}
        >
          Repeat
        </Button>
        <Button
          size="md"
          variant="secondary"
          onClick={() => {
            const draftId = uuid();
            saveDraft(draftId, { workout: session.workoutSnapshot, source: 'modified', originalWorkout: session.workoutSnapshot });
            router.push(`/review/${draftId}`);
          }}
        >
          Modify
        </Button>
      </div>
    </Card>
  );
}

export default function DayDetailsPage() {
  const params = useParams<{ date: string }>();
  const router = useRouter();
  const user = useAuthUser();
  const [scheduled, setScheduled] = useState<ScheduledWorkout[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);

  const refresh = () => {
    if (!user) return;
    const client = createSupabaseBrowserClient();
    void Promise.all([
      listScheduledWorkoutsOnDate(client, user.id, params.date),
      listSessionsBetween(client, user.id, `${params.date}T00:00:00.000Z`, `${params.date}T23:59:59.999Z`),
    ]).then(([s, sess]) => {
      setScheduled(s.filter((x) => x.status !== 'completed'));
      setSessions(sess);
      setLoaded(true);
    });
  };

  useEffect(refresh, [user, params.date]);

  const label = new Date(params.date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button className="mb-4 text-sm text-text-muted hover:text-text" onClick={() => router.push('/calendar')}>
        ← Back to Calendar
      </button>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{label}</h1>
        <Button onClick={() => setQuickAdd(true)}>Schedule Workout</Button>
      </div>

      {loaded && scheduled.length === 0 && sessions.length === 0 && (
        <p className="text-text-muted">Nothing on this day.</p>
      )}

      <div className="flex flex-col gap-4">
        {sessions.map((s) => (
          <CompletedCard key={s.id} session={s} />
        ))}
        {scheduled.map((s) => (
          <ScheduledCard key={s.id} item={s} onChanged={refresh} />
        ))}
      </div>

      <QuickAddSheet
        open={quickAdd}
        date={params.date}
        onClose={() => setQuickAdd(false)}
        onScheduled={() => {
          setQuickAdd(false);
          refresh();
        }}
      />
    </div>
  );
}
