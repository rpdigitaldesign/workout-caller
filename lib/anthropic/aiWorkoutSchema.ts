import { z } from 'zod';
import { LIMITS } from '@/lib/workout/schema';

/**
 * The shape Claude is asked to produce for a workout — identical to
 * WorkoutSchema except it has no `id` fields (Claude never generates
 * ids; the app assigns real uuids after validating this shape) and no
 * defaults-with-refine complexity. This is intentionally a separate,
 * looser contract from the internal domain schema in
 * lib/workout/schema.ts: attachIdsAndValidate() below transforms a
 * validated AiWorkout into a fully validated domain Workout, so every
 * limit (max steps, max rounds, positive durations, etc.) is enforced
 * exactly once, in one place, regardless of which path produced the data.
 */

const AiWorkoutStepSchema = z.object({
  type: z.enum(['exercise', 'rest']),
  name: z.string().trim().min(1).max(LIMITS.STEP_NAME_MAX),
  // null when the source text truly doesn't specify a duration — never guessed.
  durationSeconds: z.number().int().positive().max(LIMITS.MAX_STEP_SECONDS).nullable().default(null),
  reps: z.number().int().positive().max(LIMITS.MAX_REPS).nullable().optional(),
  notes: z.string().trim().max(LIMITS.NOTES_MAX).nullable().optional(),
});

export const AiWorkoutSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.TITLE_MAX),
  rounds: z.number().int().positive().max(LIMITS.MAX_ROUNDS),
  roundRestSeconds: z.number().int().nonnegative().max(LIMITS.MAX_STEP_SECONDS).nullable().optional(),
  warmup: z.array(AiWorkoutStepSchema).max(LIMITS.MAX_STEPS).optional(),
  steps: z.array(AiWorkoutStepSchema).min(1).max(LIMITS.MAX_STEPS),
  cooldown: z.array(AiWorkoutStepSchema).max(LIMITS.MAX_STEPS).optional(),
  notes: z.string().trim().max(LIMITS.NOTES_MAX).nullable().optional(),
  tags: z.array(z.string().trim().max(LIMITS.TAG_MAX)).max(LIMITS.MAX_TAGS).optional(),
});
export type AiWorkout = z.infer<typeof AiWorkoutSchema>;

/** JSON Schema equivalent of AiWorkoutSchema, for Claude's tool-use forced structured output. */
export const AI_WORKOUT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    rounds: { type: 'integer', minimum: 1 },
    roundRestSeconds: { type: ['integer', 'null'] },
    warmup: { type: 'array', items: { $ref: '#/$defs/step' } },
    steps: { type: 'array', items: { $ref: '#/$defs/step' }, minItems: 1 },
    cooldown: { type: 'array', items: { $ref: '#/$defs/step' } },
    notes: { type: ['string', 'null'] },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'rounds', 'steps'],
  $defs: {
    step: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['exercise', 'rest'] },
        name: { type: 'string' },
        durationSeconds: { type: ['integer', 'null'] },
        reps: { type: ['integer', 'null'] },
        notes: { type: ['string', 'null'] },
      },
      required: ['type', 'name', 'durationSeconds'],
    },
  },
} as const;
