'use client';

import { v4 as uuid } from 'uuid';
import { StepRow } from './StepRow';
import { Button } from '@/components/ui/Button';
import { LIMITS, type Workout, type WorkoutStep } from '@/lib/workout/schema';
import { estimateWorkoutDuration, formatDuration } from '@/lib/workout/duration';

export interface WorkoutEditorProps {
  value: Workout;
  onChange: (next: Workout) => void;
}

function newStep(type: WorkoutStep['type'] = 'exercise'): WorkoutStep {
  return {
    id: uuid(),
    type,
    name: type === 'rest' ? 'Rest' : '',
    durationSeconds: type === 'rest' ? 20 : 30,
    reps: null,
    notes: null,
    announce: null,
  };
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

function StepList({
  label,
  steps,
  onUpdate,
  emptyHint,
}: {
  label: string;
  steps: WorkoutStep[];
  onUpdate: (next: WorkoutStep[]) => void;
  emptyHint: string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{label}</h3>
        <Button
          type="button"
          size="md"
          variant="secondary"
          disabled={steps.length >= LIMITS.MAX_STEPS}
          onClick={() => onUpdate([...steps, newStep()])}
        >
          + Add
        </Button>
      </div>
      {steps.length === 0 && <p className="text-sm text-text-muted">{emptyHint}</p>}
      <div className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            onChange={(next) => onUpdate(steps.map((s, i) => (i === index ? next : s)))}
            onDelete={() => onUpdate(steps.filter((_, i) => i !== index))}
            onMoveUp={() => onUpdate(move(steps, index, index - 1))}
            onMoveDown={() => onUpdate(move(steps, index, index + 1))}
            canMoveUp={index > 0}
            canMoveDown={index < steps.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * The single workout editor shared by manual creation (app/create) and
 * AI-output review (app/review/[draftId]) — this is what keeps "the app
 * must work with zero AI dependency" true: this component has no idea
 * where `value` came from.
 */
export function WorkoutEditor({ value, onChange }: WorkoutEditorProps) {
  const estimate = estimateWorkoutDuration(value);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface-raised px-4 py-3">
        <span className="text-sm text-text-muted">Estimated duration: </span>
        <span className="font-semibold">
          {formatDuration(estimate.totalSeconds)}
          {estimate.hasManualSteps ? '+' : ''}
        </span>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-muted">Title</label>
        <input
          value={value.title}
          maxLength={LIMITS.TITLE_MAX}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5"
          placeholder="Workout title"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-muted">Rounds</label>
          <input
            type="number"
            min={1}
            max={LIMITS.MAX_ROUNDS}
            value={value.rounds}
            onChange={(e) => onChange({ ...value, rounds: Math.max(1, Number(e.target.value) || 1) })}
            className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-muted">
            Rest between rounds (sec)
          </label>
          <input
            type="number"
            min={0}
            value={value.roundRestSeconds ?? ''}
            placeholder="None"
            onChange={(e) =>
              onChange({ ...value, roundRestSeconds: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })
            }
            className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5"
          />
        </div>
      </div>

      <StepList
        label="Warmup"
        steps={value.warmup}
        onUpdate={(next) => onChange({ ...value, warmup: next })}
        emptyHint="No warmup steps."
      />

      <StepList
        label="Steps (repeat each round)"
        steps={value.steps}
        onUpdate={(next) => onChange({ ...value, steps: next })}
        emptyHint="Add at least one step."
      />

      <StepList
        label="Cooldown"
        steps={value.cooldown}
        onUpdate={(next) => onChange({ ...value, cooldown: next })}
        emptyHint="No cooldown steps."
      />

      <div>
        <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-muted">Notes</label>
        <textarea
          value={value.notes ?? ''}
          maxLength={LIMITS.NOTES_MAX}
          onChange={(e) => onChange({ ...value, notes: e.target.value === '' ? null : e.target.value })}
          className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5"
          rows={2}
          placeholder="Optional notes (equipment, location, etc.)"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-muted">Tags</label>
        <input
          value={value.tags.join(', ')}
          onChange={(e) =>
            onChange({
              ...value,
              tags: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, LIMITS.MAX_TAGS),
            })
          }
          placeholder="Upper Body, Cardio, ..."
          className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5"
        />
      </div>
    </div>
  );
}
