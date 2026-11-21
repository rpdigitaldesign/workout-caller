import type { Segment } from './engine';
import { MAX_SET_WEIGHT_LB, SetResultSchema, type SetResult } from './schema';

/** Pounds added or removed by one tap of the + / - buttons. */
export const WEIGHT_STEP_LB = 5;

export function setKey(r: { origin: string; stepId: string; round: number | null }): string {
  return `${r.origin}:${r.stepId}:${r.round ?? 0}`;
}

/** The identity of the set a segment represents, or null for a rest segment. */
export function segmentSetKey(segment: Segment): string | null {
  if (segment.kind !== 'exercise' || segment.stepId === null) return null;
  return setKey({ origin: segment.origin, stepId: segment.stepId, round: segment.roundNumber });
}

export function toSetResult(segment: Segment, weightLb: number): SetResult | null {
  if (segment.kind !== 'exercise' || segment.stepId === null) return null;
  return { stepId: segment.stepId, name: segment.name, origin: segment.origin, round: segment.roundNumber, weightLb };
}

/** Reads stored `set_results` leniently: bad entries are dropped so one can never break a history page. */
export function parseSetResults(value: unknown): SetResult[] {
  if (!Array.isArray(value)) return [];
  const out: SetResult[] = [];
  for (const item of value) {
    const parsed = SetResultSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Rounds to the nearest half pound and keeps the value inside 0..MAX. */
export function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_SET_WEIGHT_LB, Math.max(0, Math.round(value * 2) / 2));
}

/** Weight after tapping + (delta > 0) or - (delta < 0) from `current`; `base` is used when nothing is set yet. */
export function adjustWeight(current: number | null, delta: number, base = 0): number {
  return clampWeight((current ?? base) + delta);
}

/** Text typed into the weight box -> a weight, or null when empty/invalid. */
export function parseWeightInput(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '' || !/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? clampWeight(n) : null;
}

export function formatWeight(lb: number): string {
  return `${Number.isInteger(lb) ? lb : lb.toFixed(1)} lb`;
}

/**
 * Newest-first session rows -> the weight used LAST TIME for each exercise (matched by
 * name, ignoring case): the final set of the most recent session that included it.
 */
export function buildLastWeightsByName(rows: Array<{ set_results: unknown }>): Map<string, number> {
  const last = new Map<string, number>();
  for (const row of rows) {
    const latestInRow = new Map<string, number>();
    for (const r of parseSetResults(row.set_results)) latestInRow.set(r.name.toLowerCase(), r.weightLb);
    for (const [name, weight] of latestInRow) if (!last.has(name)) last.set(name, weight);
  }
  return last;
}

/**
 * What to pre-fill for a set: the most recent weight logged for the same exercise earlier in
 * this workout (e.g. the previous round), otherwise last time's weight; null if neither exists.
 * `logged` is in the order the sets were logged.
 */
export function suggestWeight(
  segment: Segment,
  logged: SetResult[],
  lastByName: Map<string, number>,
): number | null {
  if (segment.kind !== 'exercise' || segment.stepId === null) return null;
  for (let i = logged.length - 1; i >= 0; i--) {
    const r = logged[i]!;
    if (r.stepId === segment.stepId && r.origin === segment.origin) return r.weightLb;
  }
  return lastByName.get(segment.name.toLowerCase()) ?? null;
}

/** Groups results by exercise (in order of first appearance) for display. */
export function groupSetResults(results: SetResult[]): Array<{ name: string; weights: number[] }> {
  const groups = new Map<string, { name: string; weights: number[] }>();
  for (const r of results) {
    const key = r.name.toLowerCase();
    const g = groups.get(key) ?? { name: r.name, weights: [] };
    g.weights.push(r.weightLb);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** "25 lb", "3 × 25 lb", or "25, 25, 30 lb". */
export function formatWeights(weights: number[]): string {
  if (weights.length === 0) return '';
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (weights.length === 1) return `${fmt(weights[0]!)} lb`;
  if (weights.every((w) => w === weights[0])) return `${weights.length} × ${fmt(weights[0]!)} lb`;
  return `${weights.map(fmt).join(', ')} lb`;
}
