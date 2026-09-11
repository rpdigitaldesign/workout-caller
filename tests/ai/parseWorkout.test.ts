import { afterEach, describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { toolUseResponse, textResponse } from '../mocks/anthropicMock';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/anthropic/client', () => ({
  getAnthropicClient: () => ({ messages: { create: mockCreate } }),
  AnthropicUnavailableError: class AnthropicUnavailableError extends Error {},
}));

const { parseWorkoutFromText } = await import('@/lib/anthropic/parseWorkout');

afterEach(() => {
  mockCreate.mockReset();
});

describe('parseWorkoutFromText', () => {
  it('never calls the real Anthropic network layer (mocked client only)', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_workout', { title: 'Test', rounds: 1, steps: [{ type: 'exercise', name: 'Squats', durationSeconds: 40 }] }),
    );
    await parseWorkoutFromText('3 rounds of squats');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('parses a valid tool_use response into a valid Workout with generated step ids', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_workout', {
        title: 'Leg Day',
        rounds: 3,
        roundRestSeconds: 60,
        steps: [
          { type: 'exercise', name: 'Goblet squats', durationSeconds: 40 },
          { type: 'rest', name: 'Rest', durationSeconds: 20 },
          { type: 'exercise', name: 'Push-ups', durationSeconds: 30 },
        ],
      }),
    );
    const result = await parseWorkoutFromText('3 rounds: goblet squats 40s, rest 20s, push-ups 30s, 1 min between rounds');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workout.title).toBe('Leg Day');
      expect(result.workout.rounds).toBe(3);
      expect(result.workout.steps).toHaveLength(3);
      expect(result.workout.steps.every((s) => typeof s.id === 'string' && s.id.length > 0)).toBe(true);
    }
  });

  it('accepts a step with a missing duration as null rather than inventing one', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_workout', {
        title: 'AMRAP',
        rounds: 1,
        steps: [{ type: 'exercise', name: 'Push-ups', durationSeconds: null }],
      }),
    );
    const result = await parseWorkoutFromText('do push-ups, as many as possible');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workout.steps[0]!.durationSeconds).toBeNull();
    }
  });

  it('returns invalid_ai_output when the model declines to call the tool (unparseable input)', async () => {
    mockCreate.mockResolvedValueOnce(textResponse('That does not look like a workout.'));
    const result = await parseWorkoutFromText('what is the capital of France');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid_ai_output');
      expect(result.message).toContain('does not look like a workout');
    }
  });

  it('returns invalid_ai_output when the tool_use input does not match the expected shape', async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse('record_workout', { nonsense: true }));
    const result = await parseWorkoutFromText('3 rounds of squats');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_ai_output');
  });

  it('returns invalid_ai_output when the validated shape violates domain limits (e.g. zero rounds after transform)', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_workout', { title: 'Bad', rounds: 0, steps: [{ type: 'exercise', name: 'X', durationSeconds: 10 }] }),
    );
    const result = await parseWorkoutFromText('nonsense rounds');
    expect(result.ok).toBe(false);
  });

  it('maps a 429 from Anthropic to rate_limited', async () => {
    mockCreate.mockRejectedValueOnce(new Anthropic.APIError(429, {}, 'rate limited', new Headers()));
    const result = await parseWorkoutFromText('3 rounds of squats');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('rate_limited');
  });

  it('maps a 401 from Anthropic to ai_unavailable with a friendly message (no raw error dumped)', async () => {
    mockCreate.mockRejectedValueOnce(new Anthropic.APIError(401, {}, 'invalid api key', new Headers()));
    const result = await parseWorkoutFromText('3 rounds of squats');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('ai_unavailable');
      expect(result.message).not.toMatch(/api key/i);
    }
  });

  it('rejects empty input before ever calling Claude', async () => {
    const result = await parseWorkoutFromText('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('empty_input');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects overlong input before ever calling Claude', async () => {
    const result = await parseWorkoutFromText('x'.repeat(5000));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('input_too_long');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('sends a system prompt that instructs the model never to invent exercises', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_workout', { title: 'T', rounds: 1, steps: [{ type: 'exercise', name: 'X', durationSeconds: 10 }] }),
    );
    await parseWorkoutFromText('some workout text');
    const callArgs = mockCreate.mock.calls[0]![0];
    expect(callArgs.system).toMatch(/never invent/i);
  });
});
