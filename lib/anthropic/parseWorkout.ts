import 'server-only';
import { v4 as uuid } from 'uuid';
import { AI_WORKOUT_JSON_SCHEMA, AiWorkoutSchema, type AiWorkout } from './aiWorkoutSchema';
import { callClaudeWithTool, ClaudeRateLimitError } from './toolCall';
import { AnthropicUnavailableError } from './client';
import { PARSE_WORKOUT_SYSTEM_PROMPT } from './prompts';
import { LIMITS, WorkoutSchema, type ParseWorkoutResult, type Workout, type WorkoutStep } from '@/lib/workout/schema';

function attachIds(ai: AiWorkout): Workout {
  const withIds = (steps: AiWorkout['steps'] | undefined): WorkoutStep[] =>
    (steps ?? []).map((s) => ({
      id: uuid(),
      type: s.type,
      name: s.name,
      durationSeconds: s.durationSeconds,
      reps: s.reps ?? null,
      notes: s.notes ?? null,
      announce: null,
    }));

  return {
    title: ai.title,
    rounds: ai.rounds,
    roundRestSeconds: ai.roundRestSeconds ?? null,
    postWarmupRestSeconds: ai.postWarmupRestSeconds ?? null,
    preCooldownRestSeconds: ai.preCooldownRestSeconds ?? null,
    warmup: withIds(ai.warmup),
    steps: withIds(ai.steps),
    cooldown: withIds(ai.cooldown),
    notes: ai.notes ?? null,
    tags: ai.tags ?? [],
  };
}

export async function parseWorkoutFromText(rawText: string): Promise<ParseWorkoutResult> {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'empty_input', message: 'Paste a workout description first.' };
  }
  if (trimmed.length > LIMITS.MAX_RAW_TEXT_CHARS) {
    return {
      ok: false,
      error: 'input_too_long',
      message: `That workout description is too long (max ${LIMITS.MAX_RAW_TEXT_CHARS} characters).`,
    };
  }

  let result;
  try {
    result = await callClaudeWithTool({
      systemPrompt: PARSE_WORKOUT_SYSTEM_PROMPT,
      userMessage: trimmed,
      toolName: 'record_workout',
      toolDescription: 'Records the structured interval workout parsed from the user-provided text.',
      inputSchema: AI_WORKOUT_JSON_SCHEMA,
    });
  } catch (error) {
    if (error instanceof ClaudeRateLimitError) {
      return { ok: false, error: 'rate_limited', message: 'Too many AI requests right now — try again in a minute.' };
    }
    if (error instanceof AnthropicUnavailableError) {
      return {
        ok: false,
        error: 'ai_unavailable',
        message: 'The AI workout parser is temporarily unavailable. You can still create the workout manually.',
      };
    }
    return { ok: false, error: 'ai_unavailable', message: 'The AI workout parser is temporarily unavailable.' };
  }

  if (result.toolInput === null) {
    return {
      ok: false,
      error: 'invalid_ai_output',
      message:
        result.textReply ??
        "We couldn't interpret that workout. Try rewriting the unclear section, or create it manually.",
    };
  }

  const aiParsed = AiWorkoutSchema.safeParse(result.toolInput);
  if (!aiParsed.success) {
    return {
      ok: false,
      error: 'invalid_ai_output',
      message: "We couldn't interpret that workout. Try clarifying the unclear section.",
    };
  }

  const workout = attachIds(aiParsed.data);
  const validated = WorkoutSchema.safeParse(workout);
  if (!validated.success) {
    return {
      ok: false,
      error: 'invalid_ai_output',
      message: "The parsed workout didn't look right (e.g. too many intervals or an invalid duration). Try simplifying it or create it manually.",
    };
  }

  return { ok: true, workout: validated.data };
}
