import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCalendarItems } from '@/lib/calendar/items';
import {
  deleteScheduledWorkout,
  listScheduledWorkoutsBetween,
  listScheduledWorkoutsOnDate,
  updateScheduledWorkout,
} from '@/lib/database/scheduled';
import { blankWorkout } from '@/lib/workout/blank';
import type { ScheduledWorkout } from '@/lib/workout/schema';

/** A workout that passes validation (the blank workout has an empty title and exercise name). */
function validWorkout() {
  const w = blankWorkout();
  return { ...w, title: 'Renamed', steps: w.steps.map((st) => ({ ...st, name: 'Squats' })) };
}

function scheduled(over: Partial<ScheduledWorkout>): ScheduledWorkout {
  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    templateId: null,
    workoutSnapshot: validWorkout(),
    title: 'Upper body',
    scheduledDate: '2026-11-20',
    scheduledTime: null,
    timezone: null,
    status: 'scheduled',
    skipReason: null,
    resultingSessionId: null,
    notes: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...over,
  };
}

/** A chainable fake of the Supabase query builder that records every call made on it. */
function fakeClient(result: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const name of ['select', 'update', 'delete', 'eq', 'neq', 'gte', 'lte', 'order', 'limit', 'single']) {
    builder[name] = vi.fn((...args: unknown[]) => {
      calls.push([name, args]);
      return builder;
    });
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: result.data ?? [], error: result.error ?? null });
  const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
  return { client, calls };
}

describe('calendar items', () => {
  it('does not show legacy cancelled scheduled workouts', () => {
    const items = buildCalendarItems(
      [scheduled({ status: 'cancelled' }), scheduled({ status: 'scheduled', title: 'Kept' })],
      [],
    );
    const all = [...items.values()].flat();
    expect(all).toHaveLength(1);
    expect(all[0]!.title).toBe('Kept');
  });

  it('still shows skipped workouts (skip keeps a record)', () => {
    const items = buildCalendarItems([scheduled({ status: 'skipped' })], []);
    expect([...items.values()].flat()[0]!.status).toBe('skipped');
  });
});

describe('deleteScheduledWorkout', () => {
  it('deletes the row by id and never deletes a completed workout', async () => {
    const { client, calls } = fakeClient();
    await deleteScheduledWorkout(client, 'abc');
    expect(calls).toContainEqual(['delete', []]);
    expect(calls).toContainEqual(['eq', ['id', 'abc']]);
    expect(calls).toContainEqual(['neq', ['status', 'completed']]);
  });

  it('throws when Supabase reports an error', async () => {
    const { client } = fakeClient({ error: new Error('nope') });
    await expect(deleteScheduledWorkout(client, 'abc')).rejects.toThrow('nope');
  });
});

describe('legacy cancelled rows are hidden from list queries', () => {
  it('range query excludes status cancelled', async () => {
    const { client, calls } = fakeClient();
    await listScheduledWorkoutsBetween(client, 'u', '2026-11-01', '2026-11-30');
    expect(calls).toContainEqual(['neq', ['status', 'cancelled']]);
  });

  it('single-day query excludes status cancelled', async () => {
    const { client, calls } = fakeClient();
    await listScheduledWorkoutsOnDate(client, 'u', '2026-11-20');
    expect(calls).toContainEqual(['neq', ['status', 'cancelled']]);
  });
});

describe('updateScheduledWorkout', () => {
  it('only updates a still-scheduled row and writes only that row (never the template)', async () => {
    const row = scheduled({});
    const { client, calls } = fakeClient({
      data: {
        id: row.id,
        user_id: row.userId,
        template_id: null,
        workout_snapshot: row.workoutSnapshot,
        title: 'Renamed',
        scheduled_date: '2026-11-21',
        scheduled_time: null,
        timezone: null,
        status: 'scheduled',
        skip_reason: null,
        resulting_session_id: null,
        notes: null,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      },
    });
    const workout = validWorkout();
    await updateScheduledWorkout(client, row.id, {
      workoutSnapshot: workout,
      scheduledDate: '2026-11-21',
      scheduledTime: '07:30',
      notes: 'hotel gym',
    });
    expect((client.from as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual(['scheduled_workouts']);
    const update = calls.find(([n]) => n === 'update')!;
    expect(update[1][0]).toEqual({
      workout_snapshot: workout,
      title: 'Renamed',
      scheduled_date: '2026-11-21',
      scheduled_time: '07:30',
      notes: 'hotel gym',
    });
    expect(calls).toContainEqual(['eq', ['id', row.id]]);
    expect(calls).toContainEqual(['eq', ['status', 'scheduled']]);
  });
});
