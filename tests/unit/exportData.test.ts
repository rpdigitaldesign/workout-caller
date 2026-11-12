import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildDataExport, exportFileName } from '@/lib/export/exportData';

/** Fake client: each table has N rows; honours .range() like the real API (max 1000 per page). */
function fakeClient(counts: Record<string, number>, failOn?: string) {
  const requested: Array<{ table: string; userId: unknown; range: [number, number] }> = [];
  const client = {
    from: (table: string) => {
      let userId: unknown;
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = (_c: string, v: unknown) => ((userId = v), b);
      b.order = () => b;
      b.range = async (from: number, to: number) => {
        requested.push({ table, userId, range: [from, to] });
        if (table === failOn) return { data: null, error: new Error('boom') };
        const total = counts[table] ?? 0;
        const rows = Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => ({ id: `${table}-${from + i}` }));
        return { data: rows, error: null };
      };
      return b;
    },
  } as unknown as SupabaseClient;
  return { client, requested };
}

describe('buildDataExport', () => {
  it('collects all three tables for the signed-in user only', async () => {
    const { client, requested } = fakeClient({ workout_templates: 2, scheduled_workouts: 3, workout_sessions: 4 });
    const out = await buildDataExport(client, 'user-1', new Date('2026-11-12T12:00:00.000Z'));
    expect(out.app).toBe('workout-caller');
    expect(out.exportedAt).toBe('2026-11-12T12:00:00.000Z');
    expect(out.tables.workout_templates).toHaveLength(2);
    expect(out.tables.scheduled_workouts).toHaveLength(3);
    expect(out.tables.workout_sessions).toHaveLength(4);
    expect(requested.every((r) => r.userId === 'user-1')).toBe(true);
  });

  it('pages through tables larger than one request, without losing or repeating rows', async () => {
    const { client } = fakeClient({ workout_sessions: 2300 });
    const out = await buildDataExport(client, 'u');
    const ids = (out.tables.workout_sessions as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toHaveLength(2300);
    expect(new Set(ids).size).toBe(2300);
  });

  it('handles an exact multiple of the page size', async () => {
    const { client } = fakeClient({ workout_sessions: 1000 });
    const out = await buildDataExport(client, 'u');
    expect(out.tables.workout_sessions).toHaveLength(1000);
  });

  it('fails loudly instead of producing a partial backup', async () => {
    const { client } = fakeClient({ workout_templates: 1 }, 'workout_sessions');
    await expect(buildDataExport(client, 'u')).rejects.toThrow('boom');
  });
});

describe('exportFileName', () => {
  it('uses the local date', () => {
    expect(exportFileName(new Date(2026, 10, 5, 23, 59))).toBe('workout-caller-backup-2026-11-05.json');
  });
});
