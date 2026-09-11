'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { ScheduleSheet } from './ScheduleSheet';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { listAllTemplates } from '@/lib/database/templates';
import { scheduleWorkout } from '@/lib/database/scheduled';
import type { WorkoutTemplate } from '@/lib/workout/schema';

export function QuickAddSheet({ open, date, onClose, onScheduled }: { open: boolean; date: string; onClose: () => void; onScheduled: () => void }) {
  const user = useAuthUser();
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selected, setSelected] = useState<WorkoutTemplate | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    const client = createSupabaseBrowserClient();
    void listAllTemplates(client, user.id).then(setTemplates);
  }, [open, user]);

  if (selected) {
    return (
      <ScheduleSheet
        open={open}
        workoutTitle={selected.workout.title}
        defaultDate={date}
        onClose={() => {
          setSelected(null);
          onClose();
        }}
        onConfirm={async ({ date: d, time, notes }) => {
          if (!user) return;
          const client = createSupabaseBrowserClient();
          await scheduleWorkout(client, {
            userId: user.id,
            templateId: selected.id,
            workoutSnapshot: selected.workout,
            title: selected.workout.title,
            scheduledDate: d,
            scheduledTime: time,
            notes,
          });
          setSelected(null);
          onScheduled();
        }}
      />
    );
  }

  return (
    <Sheet open={open} title={`Schedule for ${date}`} onClose={onClose}>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">Existing template</p>
        {templates.length === 0 && <p className="text-sm text-text-muted">No saved templates yet.</p>}
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            className="focus-ring rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-left hover:bg-border"
          >
            {t.workout.title}
          </button>
        ))}
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <Button variant="secondary" onClick={() => router.push('/create')}>
            Create Manually
          </Button>
          <Button variant="secondary" onClick={() => router.push('/')}>
            Create with AI
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
