'use client';

import { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WorkoutStep } from '@/lib/workout/schema';
import { LIMITS } from '@/lib/workout/schema';

export type StepSection = 'warmup' | 'main' | 'cooldown';

const SECTION_BORDER_CLASS: Record<StepSection, string> = {
  warmup: 'border-l-[3px] border-l-sky-400/70',
  main: 'border-l-[3px] border-l-accent/70',
  cooldown: 'border-l-[3px] border-l-violet-400/70',
};

export interface StepRowProps {
  step: WorkoutStep;
  section: StepSection;
  onChange: (next: WorkoutStep) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function StepRow({ step, section, onChange, onDelete, onDuplicate }: StepRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const amountInputRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Both null means the amount is genuinely unspecified (e.g. an AI parse
  // that couldn't tell from the source text). In that case there is no data
  // to derive a unit from, so which unit is currently being edited is local
  // UI state (`pendingUnit`) rather than something read off the step —
  // otherwise switching the selector while unspecified would be a no-op,
  // since neither field would ever become non-null to reflect the choice.
  const [pendingUnit, setPendingUnit] = useState<'reps' | 'seconds'>('seconds');
  const hasAmount = step.reps !== null || step.durationSeconds !== null;
  const unit: 'reps' | 'seconds' = hasAmount ? (step.reps !== null ? 'reps' : 'seconds') : pendingUnit;
  const amountValue = unit === 'reps' ? step.reps : step.durationSeconds;

  const handleUnitChange = (nextUnit: 'reps' | 'seconds') => {
    if (nextUnit === unit) return;
    if (!hasAmount) {
      // Nothing to carry over — just remember which unit the (still-empty)
      // input should write into, and focus it. Never invent a default.
      setPendingUnit(nextUnit);
      requestAnimationFrame(() => amountInputRef.current?.focus());
      return;
    }
    // Carry an existing concrete value across when switching units.
    if (nextUnit === 'reps') {
      onChange({ ...step, reps: step.durationSeconds, durationSeconds: null });
    } else {
      onChange({ ...step, durationSeconds: step.reps, reps: null });
    }
  };

  const handleAmountChange = (raw: string) => {
    if (raw === '') {
      onChange(unit === 'reps' ? { ...step, reps: null } : { ...step, durationSeconds: null });
      return;
    }
    const parsed = Math.max(1, Math.floor(Number(raw)) || 1);
    onChange(unit === 'reps' ? { ...step, reps: parsed } : { ...step, durationSeconds: parsed });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-1.5 rounded-xl border border-border bg-surface-raised p-2 ${SECTION_BORDER_CLASS[section]} ${isDragging ? 'z-10 opacity-50' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Reorder step: ${step.name.trim() || 'Untitled'}`}
          {...attributes}
          {...listeners}
          className="focus-ring flex h-9 w-9 shrink-0 touch-none select-none cursor-grab items-center justify-center rounded-lg text-text-muted hover:text-text active:cursor-grabbing"
        >
          ☰
        </button>
        <input
          aria-label="Step name"
          value={step.name}
          maxLength={LIMITS.STEP_NAME_MAX}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
          placeholder="Name"
          className="focus-ring min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          aria-label={`Duplicate step: ${step.name.trim() || 'Untitled'}`}
          onClick={onDuplicate}
          className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-text"
        >
          ⧉
        </button>
        <button
          type="button"
          aria-label="Delete step"
          onClick={onDelete}
          className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-danger"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <input
            ref={amountInputRef}
            aria-label={unit === 'reps' ? 'Reps' : 'Duration in seconds'}
            type="number"
            min={1}
            max={unit === 'reps' ? LIMITS.MAX_REPS : LIMITS.MAX_STEP_SECONDS}
            value={amountValue ?? ''}
            placeholder="—"
            onChange={(e) => handleAmountChange(e.target.value)}
            className="focus-ring w-20 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <select
            aria-label="Amount unit"
            value={unit}
            onChange={(e) => handleUnitChange(e.target.value as 'reps' | 'seconds')}
            className="focus-ring rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
          >
            <option value="reps">reps</option>
            <option value="seconds">sec</option>
          </select>
        </div>

        <div className="flex items-center gap-1 text-xs text-text-muted">
          <span>Rest</span>
          <input
            aria-label="Rest after this step, in seconds"
            type="number"
            min={0}
            max={LIMITS.MAX_STEP_SECONDS}
            value={step.restAfterSeconds ?? ''}
            placeholder="None"
            onChange={(e) =>
              onChange({ ...step, restAfterSeconds: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })
            }
            className="focus-ring w-16 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <span>sec</span>
        </div>
      </div>
    </div>
  );
}
