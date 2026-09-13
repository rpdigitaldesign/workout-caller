'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WorkoutStep } from '@/lib/workout/schema';
import { LIMITS } from '@/lib/workout/schema';

export interface StepRowProps {
  step: WorkoutStep;
  onChange: (next: WorkoutStep) => void;
  onDelete: () => void;
}

export function StepRow({ step, onChange, onDelete }: StepRowProps) {
  const isManual = step.durationSeconds === null;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-1.5 rounded-xl border border-border bg-surface-raised p-2.5 ${isDragging ? 'z-10 opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={`Reorder step: ${step.name.trim() || 'Untitled'}`}
          {...attributes}
          {...listeners}
          className="focus-ring flex h-9 w-9 touch-none select-none cursor-grab items-center justify-center rounded-lg text-text-muted hover:text-text active:cursor-grabbing"
        >
          ☰
        </button>
        <button
          type="button"
          aria-label="Delete step"
          onClick={onDelete}
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-danger"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
        <select
          aria-label="Step type"
          value={step.type}
          onChange={(e) => onChange({ ...step, type: e.target.value as WorkoutStep['type'] })}
          className="focus-ring rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
        >
          <option value="exercise">Exercise</option>
          <option value="rest">Rest</option>
        </select>

        <input
          aria-label="Step name"
          value={step.name}
          maxLength={LIMITS.STEP_NAME_MAX}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
          placeholder="Name"
          className="focus-ring flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm"
        />

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={isManual}
              onChange={(e) => onChange({ ...step, durationSeconds: e.target.checked ? null : 30 })}
            />
            No timer
          </label>
          {!isManual && (
            <input
              aria-label="Duration in seconds"
              type="number"
              min={1}
              max={LIMITS.MAX_STEP_SECONDS}
              value={step.durationSeconds ?? ''}
              onChange={(e) => onChange({ ...step, durationSeconds: Math.max(1, Number(e.target.value) || 1) })}
              className="focus-ring w-20 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
            />
          )}
          {!isManual && <span className="text-xs text-text-muted">sec</span>}
        </div>
      </div>
    </div>
  );
}
