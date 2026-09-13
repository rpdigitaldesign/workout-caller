'use client';

import { v4 as uuid } from 'uuid';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
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

/**
 * A nullable rest-duration input, used for all three rest settings
 * (round, post-warmup, pre-cooldown). `hint` spells out whether the value
 * repeats or applies once, since that distinction is easy to miss
 * otherwise — e.g. "Rest between rounds" and "Rest after warmup" look
 * similar but behave very differently in the timer.
 */
function RestSecondsField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="flex-1">
      <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-muted">{label}</label>
      <input
        type="number"
        min={0}
        value={value ?? ''}
        placeholder="None"
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
        className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5"
      />
      <p className="mt-1 text-xs text-text-muted">{hint}</p>
    </div>
  );
}

function StepList({
  listId,
  label,
  steps,
  onUpdate,
  emptyHint,
}: {
  /** Stable, unique per call site — passed to DndContext so its internal
   * accessibility-description id is deterministic across server and client
   * renders. Without this, dnd-kit falls back to a module-level counter
   * that increments once per DndContext instance mounted on the page;
   * with three independent StepLists that counter's value doesn't line up
   * between the server-rendered HTML and the client's hydration pass,
   * producing a real (if harmless) hydration-mismatch warning. */
  listId: string;
  label: string;
  steps: WorkoutStep[];
  onUpdate: (next: WorkoutStep[]) => void;
  emptyHint: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameFor = (id: string | number) => steps.find((s) => s.id === id)?.name.trim() || 'step';

  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up ${nameFor(active.id)}.`;
    },
    onDragOver({ active, over }) {
      return over ? `${nameFor(active.id)} was moved.` : `${nameFor(active.id)} is no longer over a droppable area.`;
    },
    onDragEnd({ active, over }) {
      return over ? `${nameFor(active.id)} was dropped.` : `${nameFor(active.id)} was dropped without reordering.`;
    },
    onDragCancel({ active }) {
      return `Reordering ${nameFor(active.id)} was cancelled.`;
    },
  };

  // dnd-kit hands back ids, not indices, and `steps` may have changed shape
  // since the drag started (e.g. a different row was deleted mid-drag via
  // a second touch point, or a mouse click during a keyboard-driven drag).
  // Resolve indices against the CURRENT array and bail out — rather than
  // splicing against a stale/-1 index — if either the dragged row or the
  // drop target no longer exists.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onUpdate(move(steps, oldIndex, newIndex));
  };

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
      <DndContext
        id={listId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements }}
      >
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                onChange={(next) => onUpdate(steps.map((s, i) => (i === index ? next : s)))}
                onDelete={() => onUpdate(steps.filter((_, i) => i !== index))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
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
        <RestSecondsField
          label="Rest between rounds (sec)"
          hint="Repeats between every round."
          value={value.roundRestSeconds}
          onChange={(roundRestSeconds) => onChange({ ...value, roundRestSeconds })}
        />
      </div>

      <StepList
        listId="warmup"
        label="Warmup"
        steps={value.warmup}
        onUpdate={(next) => onChange({ ...value, warmup: next })}
        emptyHint="No warmup steps."
      />

      <RestSecondsField
        label="Rest after warmup (sec)"
        hint="One-time — happens once, right before round 1."
        value={value.postWarmupRestSeconds}
        onChange={(postWarmupRestSeconds) => onChange({ ...value, postWarmupRestSeconds })}
      />

      <StepList
        listId="steps"
        label="Steps (repeat each round)"
        steps={value.steps}
        onUpdate={(next) => onChange({ ...value, steps: next })}
        emptyHint="Add at least one step."
      />

      <RestSecondsField
        label="Rest before cooldown (sec)"
        hint="One-time — happens once, right after the last round."
        value={value.preCooldownRestSeconds}
        onChange={(preCooldownRestSeconds) => onChange({ ...value, preCooldownRestSeconds })}
      />

      <StepList
        listId="cooldown"
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
