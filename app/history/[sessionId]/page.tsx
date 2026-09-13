'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { getSession } from '@/lib/database/sessions';
import type { WorkoutSession, WorkoutStep } from '@/lib/workout/schema';
import { formatDuration } from '@/lib/workout/duration';

function StepLine({ step }: { step: WorkoutStep }) {
  return (
    <li className="flex justify-between border-b border-border py-2 text-sm last:border-0">
      <span>{step.name}</span>
      <span className="text-text-muted">{step.durationSeconds !== null ? `${step.durationSeconds}s` : '—'}</span>
    </li>
  );
}

export default function SessionDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null | undefined>(undefined);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void getSession(client, params.sessionId).then(setSession);
  }, [params.sessionId]);

  if (session === undefined) return <div className="mx-auto max-w-2xl px-4 py-8">Loading…</div>;
  if (session === null) return <div className="mx-auto max-w-2xl px-4 py-8">Session not found.</div>;

  const workout = session.workoutSnapshot;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">{session.title}</h1>
      <p className="mb-6 text-text-muted">
        {new Date(session.startedAt).toLocaleString()} ·{' '}
        {session.actualDurationSeconds !== null ? formatDuration(session.actualDurationSeconds) : '—'} · {session.status}
      </p>

      {workout.warmup.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Warmup
            {workout.postWarmupRestSeconds ? ` · ${workout.postWarmupRestSeconds}s rest after (one-time)` : ''}
          </h2>
          <ul>
            {workout.warmup.map((s) => (
              <StepLine key={s.id} step={s} />
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
          {workout.rounds} round{workout.rounds === 1 ? '' : 's'}
          {workout.roundRestSeconds ? ` · ${workout.roundRestSeconds}s between rounds` : ''}
          {workout.preCooldownRestSeconds ? ` · ${workout.preCooldownRestSeconds}s rest after (one-time)` : ''}
        </h2>
        <ul>
          {workout.steps.map((s) => (
            <StepLine key={s.id} step={s} />
          ))}
        </ul>
      </Card>

      {workout.cooldown.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">Cooldown</h2>
          <ul>
            {workout.cooldown.map((s) => (
              <StepLine key={s.id} step={s} />
            ))}
          </ul>
        </Card>
      )}

      {workout.notes && <p className="mb-4 text-sm text-text-muted">{workout.notes}</p>}

      <Button variant="ghost" onClick={() => router.push('/history')}>
        Back to History
      </Button>
    </div>
  );
}
