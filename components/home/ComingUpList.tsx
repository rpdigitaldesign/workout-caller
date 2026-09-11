'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { listUpcomingScheduledWorkouts } from '@/lib/database/scheduled';
import { saveDraft } from '@/lib/workout/draftStore';
import type { ScheduledWorkout } from '@/lib/workout/schema';

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDayLabel(dateStr: string): string {
  const today = todayDateStr();
  if (dateStr === today) return 'Today';
  const date = new Date(dateStr + 'T00:00:00');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function ComingUpList() {
  const user = useAuthUser();
  const router = useRouter();
  const [items, setItems] = useState<ScheduledWorkout[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const client = createSupabaseBrowserClient();
    void listUpcomingScheduledWorkouts(client, user.id, { fromDate: todayDateStr(), limit: 5 }).then(setItems);
  }, [user]);

  const handleStart = (item: ScheduledWorkout) => {
    const runId = uuid();
    saveDraft(runId, { workout: item.workoutSnapshot, source: 'manual', templateId: item.templateId, scheduledWorkoutId: item.id });
    router.push(`/workout/${runId}/run`);
  };

  if (!user || items === null) return null;
  if (items.length === 0) {
    return (
      <Card>
        <h2 className="mb-1 text-lg font-semibold">Coming Up</h2>
        <p className="text-sm text-text-muted">Nothing scheduled yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">Coming Up</h2>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {formatDayLabel(item.scheduledDate)}
              </p>
              <p className="font-medium">{item.title}</p>
              {item.scheduledTime && <p className="text-sm text-text-muted">{item.scheduledTime}</p>}
            </div>
            {item.scheduledDate === todayDateStr() && (
              <Button size="md" onClick={() => handleStart(item)}>
                Start
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
