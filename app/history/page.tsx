'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ScheduleSheet } from '@/components/calendar/ScheduleSheet';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { listRecentSessions } from '@/lib/database/sessions';
import { scheduleWorkout } from '@/lib/database/scheduled';
import { saveDraft } from '@/lib/workout/draftStore';
import type { WorkoutSession } from '@/lib/workout/schema';
import { formatDuration } from '@/lib/workout/duration';

const STATUS_LABEL: Record<WorkoutSession['status'], string> = {
  completed: 'Completed',
  partial: 'Partial',
  abandoned: 'Abandoned',
};

function SessionCard({ session }: { session: WorkoutSession }) {
  const router = useRouter();
  const user = useAuthUser();
  const [scheduling, setScheduling] = useState(false);
  const started = new Date(session.startedAt);

  const handleRepeat = () => {
    const runId = uuid();
    saveDraft(runId, { workout: session.workoutSnapshot, source: 'manual', templateId: session.templateId });
    router.push(`/workout/${runId}/run`);
  };

  const handleModify = () => {
    const draftId = uuid();
    saveDraft(draftId, {
      workout: session.workoutSnapshot,
      source: 'modified',
      originalWorkout: session.workoutSnapshot,
    });
    router.push(`/review/${draftId}`);
  };

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{session.title}</h3>
          <p className="text-sm text-text-muted">
            {started.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
            {started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <span className="rounded-full bg-surface-raised px-2 py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {STATUS_LABEL[session.status]}
        </span>
      </div>
      <p className="mt-2 text-sm text-text-muted">
        {session.actualDurationSeconds !== null ? formatDuration(session.actualDurationSeconds) : '—'}
        {session.completedIntervals !== null && session.totalIntervals !== null
          ? ` · ${session.completedIntervals}/${session.totalIntervals} intervals`
          : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="md" variant="secondary" onClick={() => router.push(`/history/${session.id}`)}>
          View
        </Button>
        <Button size="md" variant="secondary" onClick={handleRepeat}>
          Repeat Now
        </Button>
        <Button size="md" variant="secondary" onClick={() => setScheduling(true)}>
          Schedule Again
        </Button>
        <Button size="md" variant="secondary" onClick={handleModify}>
          Create Modified Version
        </Button>
      </div>
      <ScheduleSheet
        open={scheduling}
        workoutTitle={session.title}
        onClose={() => setScheduling(false)}
        onConfirm={async ({ date, time, notes }) => {
          if (!user) return;
          const client = createSupabaseBrowserClient();
          await scheduleWorkout(client, {
            userId: user.id,
            templateId: session.templateId,
            workoutSnapshot: session.workoutSnapshot,
            title: session.title,
            scheduledDate: date,
            scheduledTime: time,
            notes,
          });
          router.push('/calendar');
        }}
      />
    </Card>
  );
}

export default function HistoryPage() {
  const user = useAuthUser();
  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const client = createSupabaseBrowserClient();
    void listRecentSessions(client, user.id, { limit: 50 }).then(setSessions);
  }, [user]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">History</h1>
      {sessions === null && <p className="text-text-muted">Loading…</p>}
      {sessions !== null && sessions.length === 0 && <p className="text-text-muted">No completed workouts yet.</p>}
      <div className="flex flex-col gap-4">
        {(sessions ?? []).map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
