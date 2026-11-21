import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Segment } from '@/lib/workout/engine';
import { WorkoutEngine } from '@/lib/workout/engine';
import { WorkoutSessionSchema, type SetResult } from '@/lib/workout/schema';
import {
  adjustWeight,
  buildLastWeightsByName,
  clampWeight,
  formatWeight,
  formatWeights,
  groupSetResults,
  parseSetResults,
  parseWeightInput,
  segmentSetKey,
  setKey,
  suggestWeight,
  toSetResult,
} from '@/lib/workout/setResults';
import { createSession } from '@/lib/database/sessions';

const seg = (over: Partial<Segment> = {}): Segment => ({
  key: 'k', origin: 'main', kind: 'exercise', name: 'Goblet Squat', durationSeconds: null, reps: 10, announce: null,
  stepId: 'step-1', roundNumber: 1, ...over,
});
const res = (over: Partial<SetResult> = {}): SetResult => ({
  stepId: 'step-1', name: 'Goblet Squat', origin: 'main', round: 1, weightLb: 25, ...over,
});

describe('set identity', () => {
  it('is the same for the same step, round and section, and different otherwise', () => {
    expect(segmentSetKey(seg())).toBe(setKey(res()));
    expect(segmentSetKey(seg({ roundNumber: 2 }))).not.toBe(segmentSetKey(seg()));
    expect(segmentSetKey(seg({ origin: 'warmup', roundNumber: null }))).not.toBe(segmentSetKey(seg()));
  });
  it('rest segments have no set', () => {
    expect(segmentSetKey(seg({ kind: 'rest', stepId: null }))).toBeNull();
    expect(toSetResult(seg({ kind: 'rest', stepId: null }), 20)).toBeNull();
  });
  it('captures the exercise name, section and round', () => {
    expect(toSetResult(seg({ roundNumber: 3 }), 30)).toEqual(res({ round: 3, weightLb: 30 }));
  });
});

describe('weights', () => {
  it('clamps to 0..2000 and rounds to the nearest half pound', () => {
    expect(clampWeight(-5)).toBe(0);
    expect(clampWeight(99999)).toBe(2000);
    expect(clampWeight(27.3)).toBe(27.5);
    expect(clampWeight(Number.NaN)).toBe(0);
  });
  it('steps by 5 from the current value, or from a base when nothing is set', () => {
    expect(adjustWeight(25, 5)).toBe(30);
    expect(adjustWeight(25, -5)).toBe(20);
    expect(adjustWeight(2, -5)).toBe(0);
    expect(adjustWeight(null, 5)).toBe(5);
    expect(adjustWeight(null, 5, 20)).toBe(25);
  });
  it('parses typed text, accepting a decimal comma and rejecting junk', () => {
    expect(parseWeightInput('27.5')).toBe(27.5);
    expect(parseWeightInput(' 30 ')).toBe(30);
    expect(parseWeightInput('27,5')).toBe(27.5);
    expect(parseWeightInput('')).toBeNull();
    expect(parseWeightInput('abc')).toBeNull();
    expect(parseWeightInput('-5')).toBeNull();
    expect(parseWeightInput('5 lb')).toBeNull();
  });
  it('formats pounds', () => {
    expect(formatWeight(25)).toBe('25 lb');
    expect(formatWeight(27.5)).toBe('27.5 lb');
    expect(formatWeights([25])).toBe('25 lb');
    expect(formatWeights([25, 25, 25])).toBe('3 × 25 lb');
    expect(formatWeights([25, 25, 30])).toBe('25, 25, 30 lb');
    expect(formatWeights([])).toBe('');
  });
});

describe('reading stored results', () => {
  it('keeps valid entries and drops bad ones instead of failing', () => {
    const out = parseSetResults([res(), { nope: true }, res({ weightLb: -3 }), 'x', res({ round: 2 })]);
    expect(out).toHaveLength(2);
  });
  it('treats missing or non-array values as no results', () => {
    expect(parseSetResults(null)).toEqual([]);
    expect(parseSetResults(undefined)).toEqual([]);
    expect(parseSetResults({})).toEqual([]);
  });
  it('a session saved before weights existed still loads, with no results', () => {
    const parsed = WorkoutSessionSchema.safeParse({
      id: crypto.randomUUID(), userId: crypto.randomUUID(),
      workoutSnapshot: { title: 'T', rounds: 1, roundRestSeconds: null, warmup: [], cooldown: [], notes: null, tags: [],
        steps: [{ id: crypto.randomUUID(), name: 'A', durationSeconds: 30, reps: null, restAfterSeconds: null, notes: null, announce: null }] },
      title: 'T', startedAt: '2026-11-01T10:00:00.000Z', status: 'completed', createdAt: '2026-11-01T10:00:00.000Z',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.setResults).toEqual([]);
  });
});

describe('suggestions', () => {
  const last = new Map([['goblet squat', 20]]);
  it("uses the earlier round's weight for the same exercise first", () => {
    expect(suggestWeight(seg({ roundNumber: 2 }), [res({ weightLb: 30 })], last)).toBe(30);
  });
  it("uses the most recent logged set when several exist", () => {
    expect(suggestWeight(seg({ roundNumber: 3 }), [res({ weightLb: 25 }), res({ round: 2, weightLb: 30 })], last)).toBe(30);
  });
  it("falls back to last time's weight, matched by name ignoring case", () => {
    expect(suggestWeight(seg({ name: 'GOBLET squat' }), [], last)).toBe(20);
  });
  it('does not reuse another exercise’s weight', () => {
    expect(suggestWeight(seg({ stepId: 'other', name: 'Curl' }), [res({ weightLb: 30 })], last)).toBeNull();
  });
  it('has no suggestion for rests', () => {
    expect(suggestWeight(seg({ kind: 'rest', stepId: null }), [res()], last)).toBeNull();
  });
});

describe('last-time weights', () => {
  it('takes the final set of the most recent session containing each exercise', () => {
    const rows = [
      { set_results: [res({ weightLb: 25 }), res({ round: 2, weightLb: 30 }), res({ name: 'Curl', stepId: 's2', weightLb: 15 })] },
      { set_results: [res({ weightLb: 10 }), res({ name: 'Press', stepId: 's3', weightLb: 40 })] }, // older
    ];
    const m = buildLastWeightsByName(rows);
    expect(m.get('goblet squat')).toBe(30);
    expect(m.get('curl')).toBe(15);
    expect(m.get('press')).toBe(40);
  });
});

describe('history grouping', () => {
  it('groups by exercise in order of first appearance', () => {
    const g = groupSetResults([res({ weightLb: 25 }), res({ name: 'Curl', stepId: 's2', weightLb: 15 }), res({ round: 2, weightLb: 30 })]);
    expect(g).toEqual([{ name: 'Goblet Squat', weights: [25, 30] }, { name: 'Curl', weights: [15] }]);
  });
});

describe('engine previousSegment', () => {
  it('during a rest, is the exercise that was just finished', () => {
    const step = (name: string, rest: number | null) => ({ id: crypto.randomUUID(), name, durationSeconds: 30, reps: null, restAfterSeconds: rest, notes: null, announce: null });
    const engine = new WorkoutEngine(
      { title: 'W', rounds: 1, roundRestSeconds: null, warmup: [], steps: [step('Squats', 20), step('Plank', null)], cooldown: [], notes: null, tags: [] },
      { getReadySeconds: 0 },
    );
    const T0 = 1_700_000_000_000;
    expect(engine.start(T0).previousSegment).toBeNull();
    const rest = engine.tick(T0 + 31_000);
    expect(rest.state).toBe('rest');
    expect(rest.previousSegment?.name).toBe('Squats');
    expect(rest.previousSegment?.kind).toBe('exercise');
  });
});

describe('saving a session', () => {
  function fakeInsertClient() {
    const inserted: Array<Record<string, unknown>> = [];
    const row = (extra: Record<string, unknown>) => ({
      id: crypto.randomUUID(), user_id: crypto.randomUUID(), template_id: null, scheduled_workout_id: null,
      workout_snapshot: { title: 'T', rounds: 1, roundRestSeconds: null, warmup: [], cooldown: [], notes: null, tags: [],
        steps: [{ id: crypto.randomUUID(), name: 'A', durationSeconds: 30, reps: null, restAfterSeconds: null, notes: null, announce: null }] },
      title: 'T', started_at: '2026-11-01T10:00:00.000Z', completed_at: null, status: 'completed',
      actual_duration_seconds: null, completed_intervals: null, total_intervals: null, stopped_at_step_id: null,
      notes: null, created_at: '2026-11-01T10:00:00.000Z', ...extra,
    });
    const b: Record<string, unknown> = {};
    b.insert = vi.fn((v: Record<string, unknown>) => { inserted.push(v); return b; });
    b.select = () => b;
    b.single = async () => ({ data: row(inserted.at(-1)?.set_results ? { set_results: inserted.at(-1)!.set_results } : {}), error: null });
    return { client: { from: () => b } as unknown as SupabaseClient, inserted };
  }
  const base = { userId: crypto.randomUUID(), workoutSnapshot: { title: 'T' } as never, title: 'T', startedAt: '2026-11-01T10:00:00.000Z', status: 'completed' as const };

  it('stores the weights when there are some', async () => {
    const { client, inserted } = fakeInsertClient();
    const s = await createSession(client, { ...base, setResults: [res()] });
    expect(inserted[0]!.set_results).toEqual([res()]);
    expect(s.setResults).toEqual([res()]);
  });
  it('sends no set_results column at all when nothing was logged (so it works before the column exists)', async () => {
    const { client, inserted } = fakeInsertClient();
    await createSession(client, { ...base, setResults: [] });
    await createSession(client, base);
    expect('set_results' in inserted[0]!).toBe(false);
    expect('set_results' in inserted[1]!).toBe(false);
  });
});
