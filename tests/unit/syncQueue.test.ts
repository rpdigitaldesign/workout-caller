import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => store.get(k)),
  set: vi.fn(async (k: string, v: unknown) => {
    store.set(k, v);
  }),
}));

const createSession = vi.fn();
const markCompleted = vi.fn();
vi.mock('@/lib/database/sessions', () => ({ createSession: (...a: unknown[]) => createSession(...a) }));
vi.mock('@/lib/database/scheduled', () => ({ markScheduledWorkoutCompleted: (...a: unknown[]) => markCompleted(...a) }));

import { completeWorkoutSession, flushPendingSessions, listPendingSessions } from '@/lib/offline/syncQueue';

const client = {} as SupabaseClient;
const input = (title: string, scheduledWorkoutId: string | null = null) =>
  ({ userId: 'u', workoutSnapshot: {}, title, startedAt: '2026-11-12T10:00:00.000Z', status: 'completed', scheduledWorkoutId }) as never;

beforeEach(() => {
  store.clear();
  createSession.mockReset();
  markCompleted.mockReset();
  createSession.mockResolvedValue({ id: 'session-1' });
});

describe('completeWorkoutSession', () => {
  it('uploads and clears the local copy when online', async () => {
    const result = await completeWorkoutSession(client, input('A'));
    expect(result.synced).toBe(true);
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(await listPendingSessions()).toHaveLength(0);
  });

  it('keeps the workout queued when the upload fails (offline)', async () => {
    createSession.mockRejectedValue(new Error('offline'));
    const result = await completeWorkoutSession(client, input('A'));
    expect(result.synced).toBe(false);
    expect(await listPendingSessions()).toHaveLength(1);
  });

  it('marks the linked scheduled workout completed', async () => {
    await completeWorkoutSession(client, input('A', 'sched-1'));
    expect(markCompleted).toHaveBeenCalledWith(client, 'sched-1', 'session-1');
  });
});

describe('flushPendingSessions', () => {
  it('uploads everything that was queued and reports what is left', async () => {
    createSession.mockRejectedValue(new Error('offline'));
    await completeWorkoutSession(client, input('A'));
    await completeWorkoutSession(client, input('B'));
    createSession.mockResolvedValue({ id: 's' });
    expect(await flushPendingSessions(client)).toEqual({ succeeded: 2, remaining: 0 });
  });

  it('never uploads the same workout twice when several syncs run at once', async () => {
    createSession.mockRejectedValue(new Error('offline'));
    await completeWorkoutSession(client, input('A'));
    createSession.mockReset();
    createSession.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10)); // a slow network
      return { id: 's' };
    });
    await Promise.all([flushPendingSessions(client), flushPendingSessions(client), flushPendingSessions(client)]);
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(await listPendingSessions()).toHaveLength(0);
  });

  it('does not duplicate a workout that finishes while a flush is already running', async () => {
    createSession.mockRejectedValue(new Error('offline'));
    await completeWorkoutSession(client, input('A'));
    createSession.mockReset();
    createSession.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { id: 's' };
    });
    await Promise.all([flushPendingSessions(client), completeWorkoutSession(client, input('B'))]);
    expect(createSession).toHaveBeenCalledTimes(2); // A once, B once
    expect(await listPendingSessions()).toHaveLength(0);
  });

  it('keeps failed workouts queued for the next try', async () => {
    createSession.mockRejectedValue(new Error('offline'));
    await completeWorkoutSession(client, input('A'));
    expect(await flushPendingSessions(client)).toEqual({ succeeded: 0, remaining: 1 });
  });
});
