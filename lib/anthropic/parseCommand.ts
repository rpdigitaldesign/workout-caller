import 'server-only';
import { callClaudeWithTool, ClaudeRateLimitError } from './toolCall';
import { AnthropicUnavailableError } from './client';
import { PARSE_COMMAND_SYSTEM_PROMPT } from './prompts';
import { LIMITS } from '@/lib/workout/schema';
import { WorkoutCommandSchema, type ParseCommandResult } from '@/types/command';

const COMMAND_JSON_SCHEMA = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['find_workout', 'modify_workout', 'schedule_workout', 'modify_and_schedule', 'reschedule'],
    },
    ref: {
      type: 'object',
      properties: { descriptor: { type: 'string' } },
      required: ['descriptor'],
    },
    instruction: { type: 'string' },
    naturalLanguageDate: { type: 'string' },
    naturalLanguageTime: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
  required: ['type', 'ref'],
} as const;

export async function parseWorkoutCommand(text: string): Promise<ParseCommandResult> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'empty_input', message: 'Type a command first.' };
  }
  if (trimmed.length > LIMITS.MAX_COMMAND_TEXT_CHARS) {
    return {
      ok: false,
      error: 'input_too_long',
      message: `That's too long for a single command (max ${LIMITS.MAX_COMMAND_TEXT_CHARS} characters).`,
    };
  }

  let result;
  try {
    result = await callClaudeWithTool({
      systemPrompt: PARSE_COMMAND_SYSTEM_PROMPT,
      userMessage: trimmed,
      toolName: 'record_command',
      toolDescription: 'Records the structured workout command extracted from the user request.',
      inputSchema: COMMAND_JSON_SCHEMA,
    });
  } catch (error) {
    if (error instanceof ClaudeRateLimitError) {
      return { ok: false, error: 'rate_limited', message: 'Too many AI requests right now — try again in a minute.' };
    }
    if (error instanceof AnthropicUnavailableError) {
      return { ok: false, error: 'ai_unavailable', message: 'Command interpretation is temporarily unavailable.' };
    }
    return { ok: false, error: 'ai_unavailable', message: 'Command interpretation is temporarily unavailable.' };
  }

  if (result.toolInput === null) {
    return {
      ok: false,
      error: 'invalid_ai_output',
      message: result.textReply ?? "We couldn't understand that request.",
    };
  }

  const parsed = WorkoutCommandSchema.safeParse(result.toolInput);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_ai_output', message: "We couldn't understand that request clearly enough to act on it." };
  }

  return { ok: true, command: parsed.data };
}
