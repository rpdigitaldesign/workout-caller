import { z } from 'zod';
import { LIMITS } from '@/lib/workout/schema';

/**
 * Claude's job for a WorkoutCommand is to extract INTENT plus a text
 * DESCRIPTOR of what's referenced ("last Tuesday's workout", "my Leg Day
 * template") and a natural-language date/time string. It never returns a
 * database id and never resolves an absolute date itself — both are
 * resolved deterministically by application code (lib/database/search.ts
 * and lib/dates/dates.ts) after this shape comes back. This is what keeps
 * Claude from ever inventing history or getting timezone math wrong.
 */
const WorkoutRefSchema = z.object({
  descriptor: z.string().trim().min(1).max(200),
});
export type WorkoutRef = z.infer<typeof WorkoutRefSchema>;

const FindWorkoutCommand = z.object({
  type: z.literal('find_workout'),
  ref: WorkoutRefSchema,
});

const ModifyWorkoutCommand = z.object({
  type: z.literal('modify_workout'),
  ref: WorkoutRefSchema,
  instruction: z.string().trim().min(1).max(LIMITS.MAX_INSTRUCTION_CHARS),
});

const ScheduleWorkoutCommand = z.object({
  type: z.literal('schedule_workout'),
  ref: WorkoutRefSchema,
  naturalLanguageDate: z.string().trim().min(1).max(100),
  naturalLanguageTime: z.string().trim().max(50).nullable().default(null),
  notes: z.string().trim().max(LIMITS.NOTES_MAX).nullable().default(null),
});

const ModifyAndScheduleCommand = z.object({
  type: z.literal('modify_and_schedule'),
  ref: WorkoutRefSchema,
  instruction: z.string().trim().min(1).max(LIMITS.MAX_INSTRUCTION_CHARS),
  naturalLanguageDate: z.string().trim().min(1).max(100),
  naturalLanguageTime: z.string().trim().max(50).nullable().default(null),
});

const RescheduleCommand = z.object({
  type: z.literal('reschedule'),
  // For reschedule, the ref resolves to a ScheduledWorkout row, not a template.
  ref: WorkoutRefSchema,
  naturalLanguageDate: z.string().trim().min(1).max(100),
  naturalLanguageTime: z.string().trim().max(50).nullable().default(null),
});

export const WorkoutCommandSchema = z.discriminatedUnion('type', [
  FindWorkoutCommand,
  ModifyWorkoutCommand,
  ScheduleWorkoutCommand,
  ModifyAndScheduleCommand,
  RescheduleCommand,
]);
export type WorkoutCommand = z.infer<typeof WorkoutCommandSchema>;

export const ParseCommandResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), command: WorkoutCommandSchema }),
  z.object({
    ok: z.literal(false),
    error: z.enum(['ai_unavailable', 'invalid_ai_output', 'input_too_long', 'rate_limited', 'empty_input']),
    message: z.string(),
  }),
]);
export type ParseCommandResult = z.infer<typeof ParseCommandResultSchema>;
