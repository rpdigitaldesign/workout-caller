import { describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { migrateWorkout } from '@/lib/workout/migrate';
import { WorkoutSchema } from '@/lib/workout/schema';

function newShapeWorkout() {
  return {
    title: 'Already New',
    rounds: 2,
    roundRestSeconds: 30,
    warmup: [],
    steps: [{ id: uuid(), name: 'Squats', durationSeconds: 40, reps: null, restAfterSeconds: 20, notes: null, announce: null }],
    cooldown: [],
    notes: null,
    tags: [],
  };
}

describe('migrateWorkout', () => {
  it('returns new-shape input unchanged (idempotent)', () => {
    const input = newShapeWorkout();
    expect(migrateWorkout(input)).toEqual(input);
  });

  it('folds an inline legacy rest step into the preceding item\'s restAfterSeconds and removes it', () => {
    const input = {
      title: 'Legacy',
      rounds: 1,
      steps: [
        { id: uuid(), type: 'exercise', name: 'Squats', durationSeconds: 40, reps: null, notes: null, announce: null },
        { id: uuid(), type: 'rest', name: 'Rest', durationSeconds: 20, reps: null, notes: null, announce: null },
        { id: uuid(), type: 'exercise', name: 'Push-ups', durationSeconds: 30, reps: null, notes: null, announce: null },
      ],
    };
    const migrated = migrateWorkout(input) as { steps: Array<Record<string, unknown>> };
    expect(migrated.steps).toHaveLength(2);
    expect(migrated.steps[0]!.name).toBe('Squats');
    expect(migrated.steps[0]!.restAfterSeconds).toBe(20);
    expect(migrated.steps[1]!.name).toBe('Push-ups');
    expect(migrated.steps.some((s) => 'type' in s)).toBe(false);
  });

  it('drops a leading legacy rest step with nothing preceding it, without crashing', () => {
    const input = {
      title: 'Legacy',
      rounds: 1,
      steps: [
        { id: uuid(), type: 'rest', name: 'Rest', durationSeconds: 20, reps: null, notes: null, announce: null },
        { id: uuid(), type: 'exercise', name: 'Squats', durationSeconds: 40, reps: null, notes: null, announce: null },
      ],
    };
    const migrated = migrateWorkout(input) as { steps: Array<Record<string, unknown>> };
    expect(migrated.steps).toHaveLength(1);
    expect(migrated.steps[0]!.name).toBe('Squats');
  });

  it('folds postWarmupRestSeconds into the last warmup item\'s restAfterSeconds', () => {
    const input = {
      title: 'Legacy',
      rounds: 1,
      postWarmupRestSeconds: 60,
      warmup: [
        { id: uuid(), type: 'exercise', name: 'Jog', durationSeconds: 60, reps: null, notes: null, announce: null },
      ],
      steps: [{ id: uuid(), type: 'exercise', name: 'Squats', durationSeconds: 40, reps: null, notes: null, announce: null }],
    };
    const migrated = migrateWorkout(input) as { warmup: Array<Record<string, unknown>>; postWarmupRestSeconds?: unknown };
    expect(migrated.warmup[0]!.restAfterSeconds).toBe(60);
    expect(migrated).not.toHaveProperty('postWarmupRestSeconds');
  });

  it('drops postWarmupRestSeconds cleanly when warmup is empty', () => {
    const input = {
      title: 'Legacy',
      rounds: 1,
      postWarmupRestSeconds: 60,
      warmup: [],
      steps: [{ id: uuid(), type: 'exercise', name: 'Squats', durationSeconds: 40, reps: null, notes: null, announce: null }],
    };
    const migrated = migrateWorkout(input) as { warmup: unknown[] };
    expect(migrated.warmup).toEqual([]);
    expect(WorkoutSchema.safeParse(migrated).success).toBe(true);
  });

  it('folds preCooldownRestSeconds into the last steps item\'s restAfterSeconds', () => {
    const input = {
      title: 'Legacy',
      rounds: 2,
      preCooldownRestSeconds: 30,
      steps: [{ id: uuid(), type: 'exercise', name: 'Squats', durationSeconds: 40, reps: null, notes: null, announce: null }],
      cooldown: [{ id: uuid(), type: 'exercise', name: 'Stretch', durationSeconds: 20, reps: null, notes: null, announce: null }],
    };
    const migrated = migrateWorkout(input) as { steps: Array<Record<string, unknown>>; preCooldownRestSeconds?: unknown };
    expect(migrated.steps[0]!.restAfterSeconds).toBe(30);
    expect(migrated).not.toHaveProperty('preCooldownRestSeconds');
  });

  it('a step with both reps and durationSeconds set becomes duration-only (reps dropped)', () => {
    const input = {
      title: 'Legacy',
      rounds: 1,
      postWarmupRestSeconds: 0, // trigger legacy detection
      steps: [{ id: uuid(), type: 'exercise', name: 'Squats', durationSeconds: 40, reps: 15, notes: null, announce: null }],
    };
    const migrated = migrateWorkout(input) as { steps: Array<Record<string, unknown>> };
    expect(migrated.steps[0]!.durationSeconds).toBe(40);
    expect(migrated.steps[0]!.reps).toBeUndefined();
  });

  it('a step with neither reps nor durationSeconds set gets a default duration', () => {
    const input = {
      title: 'Legacy',
      rounds: 1,
      preCooldownRestSeconds: 0,
      steps: [{ id: uuid(), type: 'exercise', name: 'Squats', durationSeconds: null, reps: null, notes: null, announce: null }],
    };
    const migrated = migrateWorkout(input) as { steps: Array<Record<string, unknown>> };
    expect(migrated.steps[0]!.durationSeconds).toBe(30);
  });

  it('every legacy fixture migrates to a shape that passes WorkoutSchema.safeParse', () => {
    const fixtures = [
      {
        title: 'Full Legacy',
        rounds: 3,
        roundRestSeconds: 45,
        postWarmupRestSeconds: 60,
        preCooldownRestSeconds: 30,
        warmup: [{ id: uuid(), type: 'exercise', name: 'Jog', durationSeconds: 60, reps: null, notes: null, announce: null }],
        steps: [
          { id: uuid(), type: 'exercise', name: 'Squats', durationSeconds: 40, reps: null, notes: null, announce: null },
          { id: uuid(), type: 'rest', name: 'Rest', durationSeconds: 20, reps: null, notes: null, announce: null },
          { id: uuid(), type: 'exercise', name: 'Push-ups', durationSeconds: null, reps: 15, notes: null, announce: null },
        ],
        cooldown: [{ id: uuid(), type: 'exercise', name: 'Stretch', durationSeconds: 20, reps: null, notes: null, announce: null }],
        notes: null,
        tags: [],
      },
    ];
    for (const fixture of fixtures) {
      const migrated = migrateWorkout(fixture);
      expect(WorkoutSchema.safeParse(migrated).success).toBe(true);
    }
  });

  it('does not throw on malformed or garbage input', () => {
    expect(() => migrateWorkout(null)).not.toThrow();
    expect(() => migrateWorkout(undefined)).not.toThrow();
    expect(() => migrateWorkout('not an object')).not.toThrow();
    expect(() => migrateWorkout(42)).not.toThrow();
    expect(() => migrateWorkout({ steps: [null, 'garbage', 42] })).not.toThrow();
    expect(() =>
      migrateWorkout({ postWarmupRestSeconds: 10, warmup: [null, 'garbage'], steps: [{ type: 'rest' }, null] }),
    ).not.toThrow();
  });
});
