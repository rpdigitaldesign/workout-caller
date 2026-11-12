import { describe, expect, it } from 'vitest';
import { localDateStr } from '@/lib/calendar/today';
import { computeUsage, describeLastDone, matchesQuery, sortTemplates } from '@/lib/workout/templateList';
import type { WorkoutTemplate } from '@/lib/workout/schema';

function tpl(id: string, title: string, tags: string[] = []): WorkoutTemplate {
  return {
    id,
    userId: 'u',
    workout: { title, rounds: 1, roundRestSeconds: null, warmup: [], steps: [], cooldown: [], notes: null, tags },
    source: 'manual',
    parentTemplateId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as WorkoutTemplate;
}

describe('localDateStr', () => {
  it('uses the local calendar date, not the UTC date', () => {
    // 11:30pm local on Nov 12. In any timezone west of UTC the UTC date is already Nov 13.
    expect(localDateStr(new Date(2026, 10, 12, 23, 30))).toBe('2026-11-12');
  });
  it('zero-pads month and day', () => {
    expect(localDateStr(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('computeUsage', () => {
  it('counts sessions per template and keeps the latest date', () => {
    const usage = computeUsage([
      { template_id: 'a', started_at: '2026-11-01T10:00:00.000Z' },
      { template_id: 'a', started_at: '2026-11-05T10:00:00.000Z' },
      { template_id: 'b', started_at: '2026-10-01T10:00:00.000Z' },
      { template_id: null, started_at: '2026-11-09T10:00:00.000Z' },
    ]);
    expect(usage.get('a')).toEqual({ count: 2, lastAt: '2026-11-05T10:00:00.000Z' });
    expect(usage.get('b')?.count).toBe(1);
    expect(usage.size).toBe(2);
  });
});

describe('matchesQuery', () => {
  const t = tpl('1', 'Upper Body Strength', ['gym', 'push']);
  it('matches title or tag, ignoring case and spaces at the ends', () => {
    expect(matchesQuery(t, '  upper ')).toBe(true);
    expect(matchesQuery(t, 'PUSH')).toBe(true);
    expect(matchesQuery(t, 'legs')).toBe(false);
  });
  it('matches everything for an empty query', () => {
    expect(matchesQuery(t, '')).toBe(true);
    expect(matchesQuery(t, '   ')).toBe(true);
  });
});

describe('sortTemplates', () => {
  const list = [tpl('1', 'Core'), tpl('2', 'arms'), tpl('3', 'Back'), tpl('4', 'Legs')]; // already "recently edited" order
  const usage = computeUsage([
    { template_id: '3', started_at: '2026-11-10T00:00:00.000Z' },
    { template_id: '3', started_at: '2026-11-02T00:00:00.000Z' },
    { template_id: '1', started_at: '2026-11-11T00:00:00.000Z' },
    { template_id: '4', started_at: '2026-11-01T00:00:00.000Z' },
    { template_id: '4', started_at: '2026-10-01T00:00:00.000Z' },
    { template_id: '4', started_at: '2026-09-01T00:00:00.000Z' },
  ]);
  const ids = (m: Parameters<typeof sortTemplates>[2]) => sortTemplates(list, usage, m).map((t) => t.id);

  it('keeps the incoming order for "recent"', () => expect(ids('recent')).toEqual(['1', '2', '3', '4']));
  it('sorts by name ignoring case', () => expect(ids('name')).toEqual(['2', '3', '1', '4']));
  it('sorts by last done, never-done last, ties keep incoming order', () => expect(ids('lastDone')).toEqual(['1', '3', '4', '2']));
  it('sorts by most done, never-done last', () => expect(ids('mostDone')).toEqual(['4', '3', '1', '2']));
  it('does not modify the input array', () => {
    const copy = [...list];
    sortTemplates(list, usage, 'name');
    expect(list).toEqual(copy);
  });
});

describe('describeLastDone', () => {
  const now = new Date(2026, 10, 12, 9, 0);
  it('says not done yet when there is no session', () => expect(describeLastDone(undefined, now)).toBe('Not done yet'));
  it('says today and yesterday by local calendar day', () => {
    expect(describeLastDone(new Date(2026, 10, 12, 0, 5).toISOString(), now)).toBe('Last done today');
    expect(describeLastDone(new Date(2026, 10, 11, 23, 55).toISOString(), now)).toBe('Last done yesterday');
  });
  it('counts days for the last two weeks', () => {
    expect(describeLastDone(new Date(2026, 10, 7, 12).toISOString(), now)).toBe('Last done 5 days ago');
  });
  it('switches to a date after two weeks', () => {
    expect(describeLastDone(new Date(2026, 9, 3, 12).toISOString(), now)).toMatch(/^Last done .*3/);
  });
});
