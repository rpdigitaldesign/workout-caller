'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { WorkoutEditor } from '@/components/editor/WorkoutEditor';
import { Button } from '@/components/ui/Button';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { getTemplate, updateTemplateWorkout } from '@/lib/database/templates';
import { WorkoutSchema, type Workout, type WorkoutTemplate } from '@/lib/workout/schema';

export default function EditTemplatePage() {
  const params = useParams<{ templateId: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<WorkoutTemplate | null | undefined>(undefined);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void getTemplate(client, params.templateId).then((t) => {
      setTemplate(t);
      if (t) setWorkout(t.workout);
    });
  }, [params.templateId]);

  if (template === undefined) return <div className="mx-auto max-w-2xl px-4 py-8">Loading…</div>;
  if (template === null || !workout) return <div className="mx-auto max-w-2xl px-4 py-8">Template not found.</div>;

  const canSave = WorkoutSchema.safeParse(workout).success;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const client = createSupabaseBrowserClient();
      await updateTemplateWorkout(client, template.id, workout);
      router.push('/workouts');
    } catch {
      setError('Could not save your changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Edit Workout</h1>
      {error && <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <WorkoutEditor value={workout} onChange={setWorkout} />
      <div className="sticky bottom-0 -mx-4 mt-6 flex gap-3 border-t border-border bg-bg/95 px-4 py-4 backdrop-blur">
        <Button size="lg" disabled={!canSave || saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button size="lg" variant="ghost" onClick={() => router.push('/workouts')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
