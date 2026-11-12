'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { listScheduledWorkoutsOnDate } from '@/lib/database/scheduled';
import { saveDraft } from '@/lib/workout/draftStore';
import { localDateStr } from '@/lib/calendar/today';
import { formatDuration, estimateWorkoutDuration } from '@/lib/workout/duration';
import type { ScheduledWorkout } from '@/lib/workout/schema';

/**
 * Today's scheduled workouts with a one-tap Start, at the top of Home. Renders
 * nothing when there is nothing planned for today (or on a loading/error), so it
 * never adds an empty box.
 */
export function TodayCard() {
  const user = useAuthUser();
  const router = useRouter();
  const [items, setItems] = useState<ScheduledWorkout[]>([]);

  useEffect(() => {
    if (!user) return;
    const client = createSupabaseBrowserClient();
    listScheduledWorkoutsOnDate(client, user.id, localDateStr())
      .then((all) => setItems(all.filter((i) => i.status === 'scheduled')))
      .catch(() => setItems([]));
  }, [user]);

  const handleStart = (item: ScheduledWorkout) => {
    const runId = uuid();
    saveDraft(runId, { workout: item.workoutSnapshot, source: 'manual', templateId: item.templateId, scheduledWorkoutId: item.id });
    router.push(`/workout/${runId}/run`);
  };

  if (items.length === 0) return null;

  return (
    <Card className="border-accent/40">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">Today</h2>
      <div className="flex flex-col gap-4">
        {items.map((item) => {
          const estimate = estimateWorkoutDuration(item.workoutSnapshot);
          return (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{item.title}</p>
                <p className="text-sm text-text-muted">
                  {item.scheduledTime ? `${item.scheduledTime.slice(0, 5)} · ` : ''}
                  {formatDuration(estimate.totalSeconds)}
                  {estimate.hasManualSteps ? '+' : ''}
                </p>
              </div>
              <Button size="md" onClick={() => handleStart(item)}>
                Start
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
