'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { WEIGHT_STEP_LB, adjustWeight, formatWeight, parseWeightInput } from '@/lib/workout/setResults';

export interface WeightLoggerProps {
  /** e.g. "Squats · set 2" */
  label: string;
  /** The weight recorded for this set so far, or null. */
  logged: number | null;
  /** Last time's / the previous set's weight, offered one tap away; null if there is none. */
  suggestion: number | null;
  /** Called with the weight to record, or null to remove the entry. */
  onLog: (weightLb: number | null) => void;
}

/**
 * Records the weight used for one set, in pounds, in one or two taps.
 * - No history for this exercise: just a quiet "+ Log weight" link (so bodyweight and
 *   cardio exercises are not nagged).
 * - A suggestion exists: the field is pre-filled and a single "Log" tap records it.
 * - +/- change the weight by 5 lb and record immediately; the number can also be typed
 *   (e.g. 27.5), recorded when the field loses focus or Enter is pressed.
 * Create it with `key` set to the set's identity so each set starts fresh.
 */
export function WeightLogger({ label, logged, suggestion, onLog }: WeightLoggerProps) {
  const [open, setOpen] = useState(logged !== null || suggestion !== null);
  const [text, setText] = useState(() => {
    const start = logged ?? suggestion;
    return start === null ? '' : String(start);
  });
  const [touched, setTouched] = useState(false);

  const typed = parseWeightInput(text);
  const shown = typed ?? logged ?? suggestion;
  const needsLogTap = typed !== null && typed !== logged;

  const commit = (value: number | null) => {
    setText(value === null ? '' : String(value));
    setTouched(false);
    onLog(value);
  };

  const commitTyped = () => {
    if (!touched) return;
    if (typed === null) {
      if (logged !== null) commit(null);
      return;
    }
    if (typed !== logged) commit(typed);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring min-h-11 px-3 text-sm text-text-muted underline short:min-h-9"
      >
        + Log weight
      </button>
    );
  }

  return (
    <div className="w-full">
      <p className="truncate text-sm text-text-muted short:hidden">{label}</p>
      <div className="mt-1 flex items-center gap-2 short:mt-0">
        <button
          type="button"
          aria-label={`Lower weight by ${WEIGHT_STEP_LB} pounds`}
          onClick={() => commit(adjustWeight(shown, -WEIGHT_STEP_LB))}
          className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-raised text-2xl leading-none short:min-h-9 short:min-w-9"
        >
          −
        </button>
        <label className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-border bg-bg px-2 short:min-h-9">
          <input
            inputMode="decimal"
            aria-label={`Weight in pounds for ${label}`}
            value={text}
            placeholder="0"
            onChange={(e) => {
              setText(e.target.value);
              setTouched(true);
            }}
            onBlur={commitTyped}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="w-20 bg-transparent text-center text-2xl font-bold tabular-nums outline-none"
          />
          <span className="text-sm text-text-muted">lb</span>
        </label>
        <button
          type="button"
          aria-label={`Raise weight by ${WEIGHT_STEP_LB} pounds`}
          onClick={() => commit(adjustWeight(shown, WEIGHT_STEP_LB))}
          className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-raised text-2xl leading-none short:min-h-9 short:min-w-9"
        >
          +
        </button>
        {needsLogTap || (logged === null && shown !== null) ? (
          <Button size="md" onClick={() => shown !== null && commit(shown)} className="short:min-h-9 short:py-1">
            Log
          </Button>
        ) : logged !== null ? (
          <span className="min-w-[4.5rem] text-center text-sm font-semibold text-accent" aria-live="polite">
            ✓ {formatWeight(logged)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
