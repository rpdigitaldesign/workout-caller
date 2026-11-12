import type { SupabaseClient } from '@supabase/supabase-js';

const TABLES = ['workout_templates', 'scheduled_workouts', 'workout_sessions'] as const;
const PAGE = 1000; // the API returns at most 1000 rows per request

export interface DataExport {
  app: 'workout-caller';
  exportedAt: string;
  tables: Record<(typeof TABLES)[number], unknown[]>;
}

async function fetchAll(client: SupabaseClient, table: string, userId: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from(table)
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/**
 * A readable copy of everything the signed-in person has stored, as the raw database rows
 * (not re-validated, so one odd row can never block a backup). Runs as the person, so it
 * can only ever read their own data.
 */
export async function buildDataExport(client: SupabaseClient, userId: string, now: Date = new Date()): Promise<DataExport> {
  const [templates, scheduled, sessions] = await Promise.all(TABLES.map((t) => fetchAll(client, t, userId)));
  return {
    app: 'workout-caller',
    exportedAt: now.toISOString(),
    tables: { workout_templates: templates!, scheduled_workouts: scheduled!, workout_sessions: sessions! },
  };
}

export function exportFileName(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `workout-caller-backup-${y}-${m}-${d}.json`;
}

/** Hands the export to the browser as a file download. */
export function downloadJson(data: DataExport, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
