import { afterEach, describe, expect, it, vi } from 'vitest';
import { toolUseResponse, textResponse } from '../mocks/anthropicMock';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/anthropic/client', () => ({
  getAnthropicClient: () => ({ messages: { create: mockCreate } }),
  AnthropicUnavailableError: class AnthropicUnavailableError extends Error {},
}));

const { parseWorkoutCommand } = await import('@/lib/anthropic/parseCommand');

afterEach(() => {
  mockCreate.mockReset();
});

describe('parseWorkoutCommand', () => {
  it('parses a find_workout command', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_command', { type: 'find_workout', ref: { descriptor: "last Tuesday's workout" } }),
    );
    const result = await parseWorkoutCommand('what did I do last Tuesday?');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command.type).toBe('find_workout');
      if (result.command.type === 'find_workout') {
        expect(result.command.ref.descriptor).toBe("last Tuesday's workout");
      }
    }
  });

  it('parses a modify_workout command', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_command', {
        type: 'modify_workout',
        ref: { descriptor: "yesterday's workout" },
        instruction: 'replace push-ups with chest presses',
      }),
    );
    const result = await parseWorkoutCommand('take yesterday\'s workout and replace push-ups with chest presses');
    expect(result.ok).toBe(true);
    if (result.ok && result.command.type === 'modify_workout') {
      expect(result.command.instruction).toContain('chest presses');
    }
  });

  it('parses a schedule_workout command with date and time left as natural-language strings (not resolved by Claude)', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_command', {
        type: 'schedule_workout',
        ref: { descriptor: 'Upper Body' },
        naturalLanguageDate: 'Monday',
        naturalLanguageTime: '7am',
      }),
    );
    const result = await parseWorkoutCommand('Schedule Upper Body for Monday at 7 AM');
    expect(result.ok).toBe(true);
    if (result.ok && result.command.type === 'schedule_workout') {
      expect(result.command.naturalLanguageDate).toBe('Monday');
      expect(result.command.naturalLanguageTime).toBe('7am');
    }
  });

  it('parses a modify_and_schedule command', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_command', {
        type: 'modify_and_schedule',
        ref: { descriptor: "Tuesday's workout" },
        instruction: 'make every rest 30 seconds',
        naturalLanguageDate: 'Saturday',
      }),
    );
    const result = await parseWorkoutCommand("Take Tuesday's workout, make every rest 30 seconds, and schedule it for Saturday");
    expect(result.ok).toBe(true);
    expect(result.ok && result.command.type).toBe('modify_and_schedule');
  });

  it('parses a reschedule command', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_command', {
        type: 'reschedule',
        ref: { descriptor: "Wednesday's workout" },
        naturalLanguageDate: 'Friday',
      }),
    );
    const result = await parseWorkoutCommand("Move Wednesday's workout to Friday");
    expect(result.ok).toBe(true);
    expect(result.ok && result.command.type).toBe('reschedule');
  });

  it('never lets Claude return a resolved database id or absolute date — only a descriptor and NL date string', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_command', { type: 'find_workout', ref: { descriptor: "last Tuesday's workout" } }),
    );
    const result = await parseWorkoutCommand('what did I do last Tuesday?');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.stringify(result.command)).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no resolved ISO date anywhere
    }
  });

  it('rejects a malformed command shape', async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse('record_command', { type: 'delete_everything' }));
    const result = await parseWorkoutCommand('delete everything');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_ai_output');
  });

  it('returns invalid_ai_output when the model declines to call the tool', async () => {
    mockCreate.mockResolvedValueOnce(textResponse("I'm not sure what you're asking."));
    const result = await parseWorkoutCommand('asdkjaslkdj');
    expect(result.ok).toBe(false);
  });

  it('rejects empty input before calling Claude', async () => {
    const result = await parseWorkoutCommand('');
    expect(result.ok).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
