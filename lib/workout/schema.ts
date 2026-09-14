import { z } from 'zod';

/**
 * Central validation limits. Referenced by the AI system prompts, the manual
 * editor's input constraints, and these schemas, so there's exactly one
 * place that defines "reasonable" for a workout.
 */
export const LIMITS = {
  STEP_NAME_MAX: 80,
  NOTES_MAX: 300,
  TITLE_MAX: 120,
  TAG_MAX: 30,
  MAX_TAGS: 10,
  MAX_STEPS: 200,
  MAX_ROUNDS: 50,
  MAX_STEP_SECONDS: 3600, // 1 hour per step — sanity cap
  MAX_REPS: 10000,
  MAX_TOTAL_DURATION_SECONDS: 6 * 60 * 60, // 6 hours — sanity cap on a whole workout
  MAX_RAW_TEXT_CHARS: 4000, // input cap for /api/parse-workout
  MAX_INSTRUCTION_CHARS: 500, // input cap for /api/modify-workout instructions
  MAX_COMMAND_TEXT_CHARS: 500, // input cap for /api/parse-command
} as const;

/**
 * An exercise has exactly one "amount" — reps OR duration, never both
 * (enforced by the refine below; both null remains valid, meaning the
 * amount is genuinely unspecified — the AI parser must emit that rather
 * than invent a number, and the timer engine treats a null-duration step
 * as "manual advance": it never auto-completes, the user taps Next).
 *
 * `restAfterSeconds` is the rest between this step and the next one in
 * the SAME list (warmup/steps/cooldown). It also does double duty for the
 * two one-time transition rests that used to be separate fields: the
 * LAST warmup step's `restAfterSeconds` is the one-time rest before round
 * 1, and the LAST main-section step's `restAfterSeconds` — evaluated only
 * during the final round — is the one-time rest before cooldown. See
 * `buildSegments()` in engine.ts for the exact rule (in particular, why a
 * non-final round ignores this field on the round's last step in favor of
 * `roundRestSeconds`, and why the workout's true final step always
 * suppresses it regardless of its stored value).
 */
export const WorkoutStepSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(LIMITS.STEP_NAME_MAX),
    durationSeconds: z.number().int().positive().max(LIMITS.MAX_STEP_SECONDS).nullable(),
    reps: z.number().int().positive().max(LIMITS.MAX_REPS).nullable().default(null),
    restAfterSeconds: z.number().int().nonnegative().max(LIMITS.MAX_STEP_SECONDS).nullable().default(null),
    notes: z.string().trim().max(LIMITS.NOTES_MAX).nullable().default(null),
    announce: z.string().trim().max(LIMITS.STEP_NAME_MAX).nullable().default(null),
  })
  .refine((step) => !(step.durationSeconds !== null && step.reps !== null), {
    message: 'A step cannot have both a duration and a rep count — choose one.',
    path: ['reps'],
  });
export type WorkoutStep = z.infer<typeof WorkoutStepSchema>;

/**
 * A single ordered list of steps that repeats `rounds` times, with
 * `roundRestSeconds` inserted between repeats (never after the last one).
 * This mirrors how the user actually describes workouts ("3 rounds of
 * squats/rest/push-ups/rest") rather than a more general but unused
 * nested-rounds structure. `roundRestSeconds` is the one genuinely
 * distinct rest concept left at the workout level — every other rest
 * (between exercises, after warmup, before cooldown) lives on the step
 * itself via `restAfterSeconds` (see WorkoutStepSchema above).
 */
export const WorkoutSchema = z
  .object({
    title: z.string().trim().min(1).max(LIMITS.TITLE_MAX),
    rounds: z.number().int().positive().max(LIMITS.MAX_ROUNDS).default(1),
    roundRestSeconds: z.number().int().nonnegative().max(LIMITS.MAX_STEP_SECONDS).nullable().default(null),
    warmup: z.array(WorkoutStepSchema).max(LIMITS.MAX_STEPS).default([]),
    steps: z.array(WorkoutStepSchema).min(1).max(LIMITS.MAX_STEPS),
    cooldown: z.array(WorkoutStepSchema).max(LIMITS.MAX_STEPS).default([]),
    notes: z.string().trim().max(LIMITS.NOTES_MAX).nullable().default(null),
    tags: z.array(z.string().trim().max(LIMITS.TAG_MAX)).max(LIMITS.MAX_TAGS).default([]),
    // Reserved for future versions (weights/reps tracking, exercise metadata).
    // Not read or written by any V1 feature — present only so a later
    // version can add data here without a schema migration.
    targetMuscleGroups: z.array(z.string().max(40)).optional(),
    equipment: z.array(z.string().max(40)).optional(),
  })
  .refine(
    (workout) => {
      const totalSteps =
        workout.warmup.length + workout.cooldown.length + workout.steps.length * workout.rounds;
      return totalSteps <= LIMITS.MAX_STEPS * LIMITS.MAX_ROUNDS;
    },
    { message: 'Workout has an unreasonable number of total intervals.' },
  );
export type Workout = z.infer<typeof WorkoutSchema>;

export const WorkoutTemplateSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  workout: WorkoutSchema,
  source: z.enum(['ai', 'manual']),
  parentTemplateId: z.uuid().nullable().default(null),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type WorkoutTemplate = z.infer<typeof WorkoutTemplateSchema>;

export const ScheduledStatusEnum = z.enum(['scheduled', 'completed', 'skipped', 'cancelled']);
export type ScheduledStatus = z.infer<typeof ScheduledStatusEnum>;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export const ScheduledWorkoutSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  templateId: z.uuid().nullable().default(null),
  // Immutable copy taken at schedule time. If the source template changes
  // later, this snapshot does NOT change.
  workoutSnapshot: WorkoutSchema,
  title: z.string().trim().min(1).max(LIMITS.TITLE_MAX),
  // Plain calendar date (YYYY-MM-DD), not a timestamp — prevents any
  // timezone conversion from shifting the date by a day.
  scheduledDate: z.string().regex(DATE_ONLY_RE, 'Expected YYYY-MM-DD'),
  scheduledTime: z.string().regex(TIME_ONLY_RE, 'Expected HH:MM or HH:MM:SS').nullable().default(null),
  timezone: z.string().nullable().default(null),
  status: ScheduledStatusEnum,
  skipReason: z.string().trim().max(LIMITS.NOTES_MAX).nullable().default(null),
  resultingSessionId: z.uuid().nullable().default(null),
  notes: z.string().trim().max(LIMITS.NOTES_MAX).nullable().default(null),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ScheduledWorkout = z.infer<typeof ScheduledWorkoutSchema>;

export const SessionStatusEnum = z.enum(['completed', 'partial', 'abandoned']);
export type SessionStatus = z.infer<typeof SessionStatusEnum>;

export const WorkoutSessionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  templateId: z.uuid().nullable().default(null),
  scheduledWorkoutId: z.uuid().nullable().default(null),
  // Immutable copy of exactly what was performed. Never changes even if
  // the template or scheduled workout it came from changes or is deleted.
  workoutSnapshot: WorkoutSchema,
  title: z.string().trim().min(1).max(LIMITS.TITLE_MAX),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable().default(null),
  status: SessionStatusEnum,
  actualDurationSeconds: z.number().int().nonnegative().nullable().default(null),
  completedIntervals: z.number().int().nonnegative().nullable().default(null),
  totalIntervals: z.number().int().nonnegative().nullable().default(null),
  stoppedAtStepId: z.uuid().nullable().default(null),
  notes: z.string().trim().max(LIMITS.NOTES_MAX).nullable().default(null),
  createdAt: z.iso.datetime(),
});
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;

/** Result from /api/parse-workout — either a valid Workout, or a validation problem to show the user rather than a guessed workout. */
export const ParseWorkoutResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), workout: WorkoutSchema }),
  z.object({
    ok: z.literal(false),
    error: z.enum(['ai_unavailable', 'invalid_ai_output', 'input_too_long', 'rate_limited', 'empty_input']),
    message: z.string(),
  }),
]);
export type ParseWorkoutResult = z.infer<typeof ParseWorkoutResultSchema>;

export const ModifyWorkoutResultSchema = ParseWorkoutResultSchema;
export type ModifyWorkoutResult = z.infer<typeof ModifyWorkoutResultSchema>;
