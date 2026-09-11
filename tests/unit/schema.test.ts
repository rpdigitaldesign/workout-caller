import { describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { WorkoutSchema, WorkoutStepSchema, LIMITS } from '@/lib/workout/schema';
import { WorkoutCommandSchema } from '@/types/command';

function validStep(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: uuid(),
    type: 'exercise',
    name: 'Squats',
    durationSeconds: 40,
    ...overrides,
  };
}

function validWorkout(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: 'Leg Day',
    rounds: 3,
    roundRestSeconds: 30,
    steps: [validStep()],
    ...overrides,
  };
}

describe('WorkoutStepSchema', () => {
  it('accepts a well-formed step', () => {
    expect(WorkoutStepSchema.safeParse(validStep()).success).toBe(true);
  });

  it('rejects a negative duration', () => {
    expect(WorkoutStepSchema.safeParse(validStep({ durationSeconds: -5 })).success).toBe(false);
  });

  it('rejects a zero duration', () => {
    expect(WorkoutStepSchema.safeParse(validStep({ durationSeconds: 0 })).success).toBe(false);
  });

  it('accepts a null duration (manual-advance step)', () => {
    expect(WorkoutStepSchema.safeParse(validStep({ durationSeconds: null })).success).toBe(true);
  });

  it('rejects a name over the max length', () => {
    const tooLong = 'x'.repeat(LIMITS.STEP_NAME_MAX + 1);
    expect(WorkoutStepSchema.safeParse(validStep({ name: tooLong })).success).toBe(false);
  });
});

describe('WorkoutSchema', () => {
  it('accepts a well-formed workout', () => {
    expect(WorkoutSchema.safeParse(validWorkout()).success).toBe(true);
  });

  it('rejects zero rounds', () => {
    expect(WorkoutSchema.safeParse(validWorkout({ rounds: 0 })).success).toBe(false);
  });

  it('rejects an unreasonable number of rounds', () => {
    expect(WorkoutSchema.safeParse(validWorkout({ rounds: LIMITS.MAX_ROUNDS + 1 })).success).toBe(false);
  });

  it('rejects a workout with no steps', () => {
    expect(WorkoutSchema.safeParse(validWorkout({ steps: [] })).success).toBe(false);
  });

  it('rejects more steps than the configured maximum', () => {
    const steps = Array.from({ length: LIMITS.MAX_STEPS + 1 }, () => validStep());
    expect(WorkoutSchema.safeParse(validWorkout({ steps })).success).toBe(false);
  });

  it('rejects a malformed workout missing required fields', () => {
    expect(WorkoutSchema.safeParse({ title: 'Missing steps' }).success).toBe(false);
  });

  it('defaults warmup, cooldown, and tags to empty arrays', () => {
    const parsed = WorkoutSchema.parse(validWorkout());
    expect(parsed.warmup).toEqual([]);
    expect(parsed.cooldown).toEqual([]);
    expect(parsed.tags).toEqual([]);
  });
});

describe('WorkoutCommandSchema', () => {
  const base = { ref: { descriptor: "last Tuesday's workout" } };

  it('parses each of the five command variants', () => {
    expect(WorkoutCommandSchema.safeParse({ type: 'find_workout', ...base }).success).toBe(true);
    expect(
      WorkoutCommandSchema.safeParse({ type: 'modify_workout', ...base, instruction: 'swap push-ups for chest press' })
        .success,
    ).toBe(true);
    expect(
      WorkoutCommandSchema.safeParse({
        type: 'schedule_workout',
        ...base,
        naturalLanguageDate: 'Saturday',
        naturalLanguageTime: '9am',
        notes: null,
      }).success,
    ).toBe(true);
    expect(
      WorkoutCommandSchema.safeParse({
        type: 'modify_and_schedule',
        ...base,
        instruction: 'make rests 30 seconds',
        naturalLanguageDate: 'Saturday',
        naturalLanguageTime: null,
      }).success,
    ).toBe(true);
    expect(
      WorkoutCommandSchema.safeParse({
        type: 'reschedule',
        ...base,
        naturalLanguageDate: 'Friday',
        naturalLanguageTime: null,
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown command type', () => {
    expect(WorkoutCommandSchema.safeParse({ type: 'delete_everything', ...base }).success).toBe(false);
  });

  it('rejects an overlong instruction', () => {
    const instruction = 'x'.repeat(LIMITS.MAX_INSTRUCTION_CHARS + 1);
    expect(
      WorkoutCommandSchema.safeParse({ type: 'modify_workout', ...base, instruction }).success,
    ).toBe(false);
  });
});
