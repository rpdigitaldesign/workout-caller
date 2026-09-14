/**
 * Best-effort normalizer from a possibly-legacy-shaped raw workout value
 * (as read straight from Supabase jsonb, before any validation) to the
 * current `WorkoutSchema` shape. Never throws — an unrecognized or
 * malformed shape is passed through untouched so the subsequent
 * `WorkoutSchema.safeParse()` fails cleanly through the app's existing
 * error-surfacing UX rather than crashing here.
 *
 * Legacy shapes handled:
 * - Inline `{ type: 'exercise' | 'rest', ... }` steps in warmup/steps/cooldown
 *   (the pre-refactor rest-as-a-step model): a 'rest' step's durationSeconds
 *   is folded into the PRECEDING item's restAfterSeconds in the same array,
 *   then dropped. A leading rest step with nothing preceding it in its own
 *   array is dropped outright (not attached across a section boundary,
 *   which would silently change repeat semantics).
 * - Workout-level `postWarmupRestSeconds` / `preCooldownRestSeconds`
 *   (removed fields): folded into the last warmup / last main step's
 *   restAfterSeconds respectively, then deleted. Dropped if the target
 *   list is empty (warmup can legitimately be empty; `steps` cannot).
 * - A step with both `reps` and `durationSeconds` set (never valid under
 *   the new mutual-exclusivity refine): `reps` was write-only before this
 *   refactor — it never affected engine, duration, or UI behavior — so
 *   duration wins and the stray reps value is dropped.
 * - A step with neither `reps` nor `durationSeconds` set: assigned a
 *   default 30s duration (a real, visible behavior change for that narrow
 *   case, accepted as simpler than preserving a true "no amount" state).
 *
 * This is a solo-developer, early-stage app with limited existing saved
 * data — the bar here is "doesn't crash / doesn't silently corrupt," not
 * a fully lossless migration.
 */

const DEFAULT_STEP_DURATION_SECONDS = 30;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function migrateStepList(rawList: unknown): unknown[] | undefined {
  if (!Array.isArray(rawList)) return undefined;

  const folded: Record<string, unknown>[] = [];
  for (const rawItem of rawList) {
    if (!isPlainObject(rawItem)) {
      // Not a recognizable step shape — pass through unchanged so
      // downstream Zod validation can reject it with a clear error.
      folded.push(rawItem as Record<string, unknown>);
      continue;
    }
    const item = { ...rawItem };
    const isLegacyRestStep = item.type === 'rest';
    delete item.type;

    if (isLegacyRestStep) {
      const restSeconds = typeof item.durationSeconds === 'number' ? item.durationSeconds : 0;
      const preceding = folded[folded.length - 1];
      if (isPlainObject(preceding) && restSeconds > 0) {
        const existing = typeof preceding.restAfterSeconds === 'number' ? preceding.restAfterSeconds : 0;
        preceding.restAfterSeconds = existing + restSeconds;
      }
      // Dropped either way (no preceding item to attach to, or already folded in).
      continue;
    }

    folded.push(item);
  }

  return foldReps(folded);
}

function foldReps(steps: Record<string, unknown>[]): Record<string, unknown>[] {
  for (const step of steps) {
    if (!isPlainObject(step)) continue; // malformed entry — leave as-is for Zod to reject downstream
    const hasDuration = typeof step.durationSeconds === 'number';
    const hasReps = typeof step.reps === 'number';
    if (hasDuration && hasReps) {
      delete step.reps;
    } else if (!hasDuration && !hasReps) {
      step.durationSeconds = DEFAULT_STEP_DURATION_SECONDS;
    }
  }
  return steps;
}

function looksLegacy(raw: Record<string, unknown>): boolean {
  if ('postWarmupRestSeconds' in raw || 'preCooldownRestSeconds' in raw) return true;
  for (const key of ['warmup', 'steps', 'cooldown']) {
    const list = raw[key];
    if (Array.isArray(list) && list.some((item) => isPlainObject(item) && 'type' in item)) return true;
  }
  return false;
}

export function migrateWorkout(raw: unknown): unknown {
  if (!isPlainObject(raw)) return raw;
  if (!looksLegacy(raw)) return raw;

  const result: Record<string, unknown> = { ...raw };

  const warmup = migrateStepList(result.warmup) ?? [];
  const steps = migrateStepList(result.steps) ?? [];
  const cooldown = migrateStepList(result.cooldown) ?? [];

  const postWarmupRestSeconds = result.postWarmupRestSeconds;
  const lastWarmup = warmup[warmup.length - 1];
  if (typeof postWarmupRestSeconds === 'number' && postWarmupRestSeconds > 0 && isPlainObject(lastWarmup)) {
    const existing = typeof lastWarmup.restAfterSeconds === 'number' ? lastWarmup.restAfterSeconds : 0;
    lastWarmup.restAfterSeconds = existing + postWarmupRestSeconds;
  }
  delete result.postWarmupRestSeconds;

  const preCooldownRestSeconds = result.preCooldownRestSeconds;
  const lastStep = steps[steps.length - 1];
  if (typeof preCooldownRestSeconds === 'number' && preCooldownRestSeconds > 0 && isPlainObject(lastStep)) {
    const existing = typeof lastStep.restAfterSeconds === 'number' ? lastStep.restAfterSeconds : 0;
    lastStep.restAfterSeconds = existing + preCooldownRestSeconds;
  }
  delete result.preCooldownRestSeconds;

  result.warmup = warmup;
  result.steps = steps;
  result.cooldown = cooldown;

  return result;
}
