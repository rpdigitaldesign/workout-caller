'use client';

import type { WorkoutStep } from '@/lib/workout/schema';
import { LIMITS } from '@/lib/workout/schema';

export interface StepRowProps {
  step: WorkoutStep;
  onChange: (next: WorkoutStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function StepRow({ step, onChange, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: StepRowProps) {
  const isManual = step.durationSeconds === null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-raised p-3 sm:flex-row sm:items-center">
      <div className="flex gap-1">
        <button
          type="button"
          aria-label="Move up"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text disabled:opacity-30"
        >
          ↓
        </button>
      </div>

      <select
        aria-label="Step type"
        value={step.type}
        onChange={(e) => onChange({ ...step, type: e.target.value as WorkoutStep['type'] })}
        className="focus-ring rounded-lg border border-border bg-bg px-2 py-2 text-sm"
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
        className="focus-ring flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
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
            className="focus-ring w-20 rounded-lg border border-border bg-bg px-2 py-2 text-sm"
          />
        )}
        {!isManual && <span className="text-xs text-text-muted">sec</span>}
      </div>

      <button
        type="button"
        aria-label="Delete step"
        onClick={onDelete}
        className="focus-ring rounded-lg px-3 py-2 text-sm text-danger hover:opacity-80"
      >
        Delete
      </button>
    </div>
  );
}
