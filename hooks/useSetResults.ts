'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Segment } from '@/lib/workout/engine';
import type { SetResult } from '@/lib/workout/schema';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { listRecentSetResultRows } from '@/lib/database/sessions';
import { buildLastWeightsByName, segmentSetKey, setKey, suggestWeight, toSetResult } from '@/lib/workout/setResults';

/**
 * Weights recorded during one workout run, plus "last time" suggestions fetched once
 * when the run starts. Suggestions are a nice-to-have: if they can't load (offline, or
 * signed out) the logger simply has nothing pre-filled.
 */
export function useSetResults(userId: string | null, initial: SetResult[] = []) {
  const [results, setResults] = useState<SetResult[]>(initial);
  const [lastByName, setLastByName] = useState<Map<string, number>>(() => new Map());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listRecentSetResultRows(createSupabaseBrowserClient(), userId)
      .then((rows) => {
        if (!cancelled) setLastByName(buildLastWeightsByName(rows));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Records (or, with null, removes) the weight for the set a segment represents. */
  const log = useCallback((segment: Segment, weightLb: number | null) => {
    const entry = weightLb === null ? null : toSetResult(segment, weightLb);
    const key = segmentSetKey(segment);
    if (key === null) return;
    setResults((prev) => {
      const without = prev.filter((r) => setKey(r) !== key);
      return entry ? [...without, entry] : without;
    });
  }, []);

  const entryFor = useCallback(
    (segment: Segment) => {
      const key = segmentSetKey(segment);
      const logged = key === null ? null : (results.find((r) => setKey(r) === key)?.weightLb ?? null);
      return { logged, suggestion: suggestWeight(segment, results, lastByName) };
    },
    [results, lastByName],
  );

  return useMemo(() => ({ results, log, entryFor, setResults }), [results, log, entryFor]);
}
