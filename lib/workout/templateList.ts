import type { WorkoutTemplate } from './schema';
import { localDateStr } from '@/lib/calendar/today';

export interface TemplateUsage {
  count: number;
  /** ISO timestamp of the most recent session using the template. */
  lastAt: string;
}

export type TemplateSort = 'recent' | 'name' | 'lastDone' | 'mostDone';

export const TEMPLATE_SORT_LABELS: Record<TemplateSort, string> = {
  recent: 'Recently edited',
  name: 'Name (A to Z)',
  lastDone: 'Last done',
  mostDone: 'Most done',
};

/** Builds per-template usage from session rows (any order). Rows without a template are ignored. */
export function computeUsage(rows: Array<{ template_id: string | null; started_at: string }>): Map<string, TemplateUsage> {
  const usage = new Map<string, TemplateUsage>();
  for (const row of rows) {
    if (!row.template_id) continue;
    const existing = usage.get(row.template_id);
    if (!existing) {
      usage.set(row.template_id, { count: 1, lastAt: row.started_at });
    } else {
      existing.count += 1;
      if (row.started_at > existing.lastAt) existing.lastAt = row.started_at;
    }
  }
  return usage;
}

/** Case-insensitive match on the title or any tag; an empty query matches everything. */
export function matchesQuery(template: WorkoutTemplate, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    template.workout.title.toLowerCase().includes(q) || template.workout.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

/**
 * Orders templates. Input order (most recently edited first) is the tie-breaker for every
 * mode, and templates never done sort after ones that have been done.
 */
export function sortTemplates(
  templates: WorkoutTemplate[],
  usage: Map<string, TemplateUsage>,
  mode: TemplateSort,
): WorkoutTemplate[] {
  const indexed = templates.map((t, i) => ({ t, i }));
  const cmp = (a: { t: WorkoutTemplate; i: number }, b: { t: WorkoutTemplate; i: number }): number => {
    switch (mode) {
      case 'name':
        return a.t.workout.title.localeCompare(b.t.workout.title, undefined, { sensitivity: 'base' });
      case 'lastDone': {
        const la = usage.get(a.t.id)?.lastAt ?? '';
        const lb = usage.get(b.t.id)?.lastAt ?? '';
        return la === lb ? 0 : la < lb ? 1 : -1;
      }
      case 'mostDone':
        return (usage.get(b.t.id)?.count ?? 0) - (usage.get(a.t.id)?.count ?? 0);
      case 'recent':
        return 0;
    }
  };
  return indexed.sort((a, b) => cmp(a, b) || a.i - b.i).map((x) => x.t);
}

/** "Last done today / yesterday / 5 days ago / Oct 3", or "Not done yet". Day differences use local calendar dates. */
export function describeLastDone(lastAtIso: string | undefined, now: Date = new Date()): string {
  if (!lastAtIso) return 'Not done yet';
  const last = new Date(lastAtIso);
  const lastDay = localDateStr(last);
  const today = localDateStr(now);
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round(
    (Date.parse(today + 'T00:00:00Z') - Date.parse(lastDay + 'T00:00:00Z')) / dayMs,
  );
  if (days <= 0) return 'Last done today';
  if (days === 1) return 'Last done yesterday';
  if (days < 14) return `Last done ${days} days ago`;
  return `Last done ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(days > 300 ? { year: 'numeric' } : {}) })}`;
}
