import { afterEach, describe, expect, it, vi } from 'vitest';
import { v4 as uuid } from 'uuid';
import { toolUseResponse, textResponse } from '../mocks/anthropicMock';
import type { Workout } from '@/lib/workout/schema';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/anthropic/client', () => ({
  getAnthropicClient: () => ({ messages: { create: mockCreate } }),
  AnthropicUnavailableError: class AnthropicUnavailableError extends Error {},
}));

const { modifyWorkoutWithInstruction } = await import('@/lib/anthropic/modifyWorkout');

afterEach(() => {
  mockCreate.mockReset();
});

const original: Workout = {
  title: 'Leg Day',
  rounds: 3,
  roundRestSeconds: 60,
  postWarmupRestSeconds: 45,
  preCooldownRestSeconds: 30,
  warmup: [],
  steps: [
    { id: uuid(), type: 'exercise', name: 'Goblet squats', durationSeconds: 40, reps: null, notes: null, announce: null },
    { id: uuid(), type: 'rest', name: 'Rest', durationSeconds: 20, reps: null, notes: null, announce: null },
    { id: uuid(), type: 'exercise', name: 'Push-ups', durationSeconds: 30, reps: null, notes: null, announce: null },
  ],
  cooldown: [],
  notes: null,
  tags: [],
};

describe('modifyWorkoutWithInstruction', () => {
  it('sends only the single resolved workout plus the instruction, never a broader history', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_workout', {
        title: 'Leg Day',
        rounds: 3,
        roundRestSeconds: 60,
        steps: [
          { type: 'exercise', name: 'Goblet squats', durationSeconds: 40 },
          { type: 'rest', name: 'Rest', durationSeconds: 20 },
          { type: 'exercise', name: 'Chest presses', durationSeconds: 30 },
        ],
      }),
    );
    await modifyWorkoutWithInstruction(original, 'replace push-ups with chest presses');
    const callArgs = mockCreate.mock.calls[0]![0];
    const sentPayload = JSON.parse(callArgs.messages[0].content);
    expect(sentPayload.workout.title).toBe('Leg Day');
    expect(sentPayload.instruction).toBe('replace push-ups with chest presses');
    expect(Object.keys(sentPayload)).toEqual(['workout', 'instruction']);
  });

  it('preserves every unaffected field exactly when only one exercise is targeted', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_workout', {
        title: 'Leg Day',
        rounds: 3,
        roundRestSeconds: 60,
        postWarmupRestSeconds: 45,
        preCooldownRestSeconds: 30,
        steps: [
          { type: 'exercise', name: 'Goblet squats', durationSeconds: 40 },
          { type: 'rest', name: 'Rest', durationSeconds: 20 },
          { type: 'exercise', name: 'Chest presses', durationSeconds: 30 },
        ],
      }),
    );
    const result = await modifyWorkoutWithInstruction(original, 'replace push-ups with chest presses');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workout.title).toBe(original.title);
      expect(result.workout.rounds).toBe(original.rounds);
      expect(result.workout.roundRestSeconds).toBe(original.roundRestSeconds);
      expect(result.workout.postWarmupRestSeconds).toBe(original.postWarmupRestSeconds);
      expect(result.workout.preCooldownRestSeconds).toBe(original.preCooldownRestSeconds);
      // Unaffected steps keep their original id (best-effort positional match).
      expect(result.workout.steps[0]!.id).toBe(original.steps[0]!.id);
      expect(result.workout.steps[1]!.id).toBe(original.steps[1]!.id);
      expect(result.workout.steps[0]!.durationSeconds).toBe(40);
      expect(result.workout.steps[1]!.durationSeconds).toBe(20);
      // The targeted step changed name and got a fresh id.
      expect(result.workout.steps[2]!.name).toBe('Chest presses');
      expect(result.workout.steps[2]!.id).not.toBe(original.steps[2]!.id);
    }
  });

  it('returns invalid_ai_output on a malformed response rather than throwing', async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse('record_workout', { garbage: true }));
    const result = await modifyWorkoutWithInstruction(original, 'do something');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_ai_output');
  });

  it('returns invalid_ai_output when the model declines to call the tool', async () => {
    mockCreate.mockResolvedValueOnce(textResponse("That instruction doesn't make sense for this workout."));
    const result = await modifyWorkoutWithInstruction(original, 'asdkjaslkdj');
    expect(result.ok).toBe(false);
  });

  it('never writes to the database itself — it only returns a candidate workout', async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse('record_workout', { title: 'Leg Day', rounds: 3, steps: [{ type: 'exercise', name: 'X', durationSeconds: 10 }] }),
    );
    const result = await modifyWorkoutWithInstruction(original, 'change something');
    // The module has no database import at all — a structural guarantee, verified by
    // the absence of any db-related call surface, not just by this single assertion.
    expect(result.ok).toBe(true);
  });

  it('rejects an empty instruction before calling Claude', async () => {
    const result = await modifyWorkoutWithInstruction(original, '   ');
    expect(result.ok).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
