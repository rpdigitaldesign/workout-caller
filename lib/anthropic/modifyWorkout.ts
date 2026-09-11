import 'server-only';
import { v4 as uuid } from 'uuid';
import { AI_WORKOUT_JSON_SCHEMA, AiWorkoutSchema, type AiWorkout } from './aiWorkoutSchema';
import { callClaudeWithTool, ClaudeRateLimitError } from './toolCall';
import { AnthropicUnavailableError } from './client';
import { MODIFY_WORKOUT_SYSTEM_PROMPT } from './prompts';
import { LIMITS, WorkoutSchema, type ModifyWorkoutResult, type Workout, type WorkoutStep } from '@/lib/workout/schema';

/**
 * Re-attaches ids for the modified workout, preferring to keep an
 * original step's id when its name is unchanged (best-effort, positional)
 * so the diff UI can show "unchanged" rather than "removed + added" for
 * steps the instruction didn't touch. This is a display nicety, not a
 * correctness requirement — the modify prompt already instructs Claude to
 * return everything else unchanged.
 */
function attachIds(ai: AiWorkout, original: Workout): Workout {
  const withIds = (steps: AiWorkout['steps'] | undefined, originalSteps: WorkoutStep[]): WorkoutStep[] =>
    (steps ?? []).map((s, index) => {
      const originalAtSamePosition = originalSteps[index];
      const keepId = originalAtSamePosition && originalAtSamePosition.name === s.name ? originalAtSamePosition.id : uuid();
      return {
        id: keepId,
        type: s.type,
        name: s.name,
        durationSeconds: s.durationSeconds,
        reps: s.reps ?? null,
        notes: s.notes ?? null,
        announce: null,
      };
    });

  return {
    title: ai.title,
    rounds: ai.rounds,
    roundRestSeconds: ai.roundRestSeconds ?? null,
    warmup: withIds(ai.warmup, original.warmup),
    steps: withIds(ai.steps, original.steps),
    cooldown: withIds(ai.cooldown, original.cooldown),
    notes: ai.notes ?? null,
    tags: ai.tags ?? original.tags,
  };
}

export async function modifyWorkoutWithInstruction(
  originalWorkout: Workout,
  instruction: string,
): Promise<ModifyWorkoutResult> {
  const trimmedInstruction = instruction.trim();
  if (trimmedInstruction.length === 0) {
    return { ok: false, error: 'empty_input', message: 'Describe the change you want first.' };
  }
  if (trimmedInstruction.length > LIMITS.MAX_INSTRUCTION_CHARS) {
    return {
      ok: false,
      error: 'input_too_long',
      message: `That instruction is too long (max ${LIMITS.MAX_INSTRUCTION_CHARS} characters).`,
    };
  }

  // Only the one resolved workout + instruction are sent — never the user's history or other templates.
  const userMessage = JSON.stringify({ workout: originalWorkout, instruction: trimmedInstruction });

  let result;
  try {
    result = await callClaudeWithTool({
      systemPrompt: MODIFY_WORKOUT_SYSTEM_PROMPT,
      userMessage,
      toolName: 'record_workout',
      toolDescription: 'Records the complete modified workout.',
      inputSchema: AI_WORKOUT_JSON_SCHEMA,
    });
  } catch (error) {
    if (error instanceof ClaudeRateLimitError) {
      return { ok: false, error: 'rate_limited', message: 'Too many AI requests right now — try again in a minute.' };
    }
    if (error instanceof AnthropicUnavailableError) {
      return { ok: false, error: 'ai_unavailable', message: 'The AI modifier is temporarily unavailable.' };
    }
    return { ok: false, error: 'ai_unavailable', message: 'The AI modifier is temporarily unavailable.' };
  }

  if (result.toolInput === null) {
    return {
      ok: false,
      error: 'invalid_ai_output',
      message: result.textReply ?? "We couldn't apply that modification. Try being more specific.",
    };
  }

  const aiParsed = AiWorkoutSchema.safeParse(result.toolInput);
  if (!aiParsed.success) {
    return { ok: false, error: 'invalid_ai_output', message: "We couldn't apply that modification cleanly." };
  }

  const workout = attachIds(aiParsed.data, originalWorkout);
  const validated = WorkoutSchema.safeParse(workout);
  if (!validated.success) {
    return {
      ok: false,
      error: 'invalid_ai_output',
      message: "The modified workout didn't look right. Try a smaller change or edit it manually.",
    };
  }

  return { ok: true, workout: validated.data };
}
