'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { listRecentTemplates } from '@/lib/database/templates';
import { saveDraft } from '@/lib/workout/draftStore';
import type { WorkoutTemplate } from '@/lib/workout/schema';

export function RecentWorkoutsList() {
  const user = useAuthUser();
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const client = createSupabaseBrowserClient();
    void listRecentTemplates(client, user.id, { limit: 5 }).then(setTemplates);
  }, [user]);

  const handleStart = (template: WorkoutTemplate) => {
    const runId = uuid();
    saveDraft(runId, { workout: template.workout, source: 'manual', templateId: template.id });
    router.push(`/workout/${runId}/run`);
  };

  if (!user || templates === null) return null;
  if (templates.length === 0) {
    return (
      <Card>
        <h2 className="mb-1 text-lg font-semibold">Recent Workouts</h2>
        <p className="text-sm text-text-muted">Nothing saved yet — parse or create a workout to get started.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">Recent Workouts</h2>
      <div className="flex flex-col gap-3">
        {templates.map((template) => (
          <div key={template.id} className="flex items-center justify-between gap-3">
            <p className="font-medium">{template.workout.title}</p>
            <Button size="md" variant="secondary" onClick={() => handleStart(template)}>
              Start Now
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
