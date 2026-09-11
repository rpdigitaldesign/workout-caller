'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ScheduleSheet } from '@/components/calendar/ScheduleSheet';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { deleteTemplate, duplicateTemplate, listAllTemplates } from '@/lib/database/templates';
import { scheduleWorkout } from '@/lib/database/scheduled';
import { saveDraft } from '@/lib/workout/draftStore';
import type { ModifyWorkoutResult, WorkoutTemplate } from '@/lib/workout/schema';
import { formatDuration, estimateWorkoutDuration } from '@/lib/workout/duration';

function TemplateCard({
  template,
  onChanged,
}: {
  template: WorkoutTemplate;
  onChanged: () => void;
}) {
  const router = useRouter();
  const user = useAuthUser();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const estimate = estimateWorkoutDuration(template.workout);

  const handleStart = () => {
    const runId = uuid();
    saveDraft(runId, { workout: template.workout, source: 'manual', templateId: template.id });
    router.push(`/workout/${runId}/run`);
  };

  const handleDuplicate = async () => {
    if (!user) return;
    const client = createSupabaseBrowserClient();
    await duplicateTemplate(client, template.id, user.id);
    onChanged();
  };

  const handleDelete = async () => {
    const client = createSupabaseBrowserClient();
    await deleteTemplate(client, template.id);
    setConfirmDelete(false);
    onChanged();
  };

  const handleApplyModification = async () => {
    setApplying(true);
    setError(null);
    try {
      const response = await fetch('/api/modify-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workout: template.workout, instruction }),
      });
      const result = (await response.json()) as ModifyWorkoutResult;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const draftId = uuid();
      saveDraft(draftId, {
        workout: result.workout,
        source: 'modified',
        parentTemplateId: template.id,
        originalWorkout: template.workout,
      });
      router.push(`/review/${draftId}`);
    } catch {
      setError('The AI modifier is temporarily unavailable.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{template.workout.title}</h3>
          <p className="text-sm text-text-muted">
            {template.workout.rounds} round{template.workout.rounds === 1 ? '' : 's'} · {formatDuration(estimate.totalSeconds)}
            {estimate.hasManualSteps ? '+' : ''}
          </p>
          {template.workout.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {template.workout.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-text-muted">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="md" onClick={handleStart}>
          Start Now
        </Button>
        <Button size="md" variant="secondary" onClick={() => setScheduling(true)}>
          Schedule
        </Button>
        <Button size="md" variant="secondary" onClick={() => router.push(`/workouts/${template.id}`)}>
          Edit
        </Button>
        <Button size="md" variant="secondary" onClick={handleDuplicate}>
          Duplicate
        </Button>
        <Button size="md" variant="secondary" onClick={() => setModifying((v) => !v)}>
          Create Modified Version
        </Button>
        <Button size="md" variant="danger" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>

      {modifying && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. replace push-ups with chest presses"
            className="focus-ring rounded-lg border border-border bg-bg px-3 py-2.5"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="md" onClick={handleApplyModification} disabled={applying || instruction.trim() === ''}>
            {applying ? 'Applying…' : 'Apply'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this template?"
        description="This cannot be undone. History and scheduled workouts that already used it are unaffected."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <ScheduleSheet
        open={scheduling}
        workoutTitle={template.workout.title}
        onClose={() => setScheduling(false)}
        onConfirm={async ({ date, time, notes }) => {
          if (!user) return;
          const client = createSupabaseBrowserClient();
          await scheduleWorkout(client, {
            userId: user.id,
            templateId: template.id,
            workoutSnapshot: template.workout,
            title: template.workout.title,
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

export default function WorkoutsPage() {
  const user = useAuthUser();
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const refresh = () => {
    if (!user) return;
    const client = createSupabaseBrowserClient();
    void listAllTemplates(client, user.id).then(setTemplates);
  };

  useEffect(refresh, [user]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (templates ?? []).forEach((t) => t.workout.tags.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [templates]);

  const visible = (templates ?? []).filter((t) => !tagFilter || t.workout.tags.includes(tagFilter));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workouts</h1>
        <Button onClick={() => router.push('/create')}>+ New</Button>
      </div>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setTagFilter(null)}
            className={`focus-ring rounded-full px-3 py-1.5 text-sm ${tagFilter === null ? 'bg-accent text-black' : 'bg-surface-raised text-text-muted'}`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag)}
              className={`focus-ring rounded-full px-3 py-1.5 text-sm ${tagFilter === tag ? 'bg-accent text-black' : 'bg-surface-raised text-text-muted'}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {templates === null && <p className="text-text-muted">Loading…</p>}
      {templates !== null && visible.length === 0 && <p className="text-text-muted">No workouts yet.</p>}

      <div className="flex flex-col gap-4">
        {visible.map((template) => (
          <TemplateCard key={template.id} template={template} onChanged={refresh} />
        ))}
      </div>
    </div>
  );
}
