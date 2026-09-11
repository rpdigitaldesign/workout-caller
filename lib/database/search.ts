import type { SupabaseClient } from '@supabase/supabase-js';
import type { Workout } from '@/lib/workout/schema';
import { resolveNaturalLanguageDate, type ResolveDateOptions } from '@/lib/dates/dates';
import { findTemplatesByTitle, listAllTemplates } from './templates';
import { getMostRecentSession, listSessionsBetween } from './sessions';
import { listScheduledWorkoutsOnDate } from './scheduled';

/**
 * Resolves a free-text WorkoutRef.descriptor (e.g. "last Tuesday's
 * workout", "my Leg Day template", "yesterday's workout") against the
 * database. This is deliberately NOT delegated to Claude — Claude only
 * ever extracts the descriptor text; the app decides what it refers to,
 * so it can never invent a match that doesn't exist. Only a small,
 * targeted query set is used — never the user's full workout history.
 */

export type ResolvedReferenceKind = 'template' | 'session' | 'scheduled';

export interface ResolvedReference {
  kind: ResolvedReferenceKind;
  id: string;
  title: string;
  workout: Workout;
  scheduledDate?: string;
  startedAt?: string;
}

export type ReferenceResolution =
  | { status: 'resolved'; match: ResolvedReference }
  | { status: 'ambiguous'; choices: ResolvedReference[] }
  | { status: 'not_found' };

const MOST_RECENT_PATTERN = /\b(most recent|latest|last)( completed)? workout\b/i;

function stripWorkoutSuffix(descriptor: string): string {
  return descriptor
    .trim()
    .replace(/^(the |my )/i, '')
    .replace(/('s)?\s+workout$/i, '')
    .trim();
}

function dayBoundsUtcIso(dateStr: string): { startIso: string; endIso: string } {
  // Session timestamps are timestamptz; a day-boundary query in the user's
  // local calendar date is approximated with a generous +/- 1 day UTC
  // window, then filtered precisely below by comparing local calendar
  // dates — simpler and just as correct as timezone-converting the
  // boundaries themselves, and avoids a second timezone dependency here.
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, d! - 1));
  const end = new Date(Date.UTC(y!, m! - 1, d! + 2));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function resolveWorkoutReference(
  client: SupabaseClient,
  userId: string,
  descriptor: string,
  dateOptions: ResolveDateOptions,
): Promise<ReferenceResolution> {
  const trimmed = descriptor.trim();

  if (MOST_RECENT_PATTERN.test(trimmed)) {
    const session = await getMostRecentSession(client, userId);
    if (!session) return { status: 'not_found' };
    return {
      status: 'resolved',
      match: {
        kind: 'session',
        id: session.id,
        title: session.title,
        workout: session.workoutSnapshot,
        startedAt: session.startedAt,
      },
    };
  }

  const dateCandidate = stripWorkoutSuffix(trimmed);
  const dateResolution = resolveNaturalLanguageDate(dateCandidate, dateOptions);

  if (dateResolution.ok) {
    const { startIso, endIso } = dayBoundsUtcIso(dateResolution.result.date);
    const sessions = await listSessionsBetween(client, userId, startIso, endIso);
    const onExactDate = sessions.filter(
      (s) => formatInTimeZoneDateOnly(s.startedAt, dateOptions.timeZone) === dateResolution.result.date,
    );

    if (onExactDate.length === 1) {
      const s = onExactDate[0]!;
      return {
        status: 'resolved',
        match: { kind: 'session', id: s.id, title: s.title, workout: s.workoutSnapshot, startedAt: s.startedAt },
      };
    }
    if (onExactDate.length > 1) {
      return {
        status: 'ambiguous',
        choices: onExactDate.map((s) => ({
          kind: 'session' as const,
          id: s.id,
          title: s.title,
          workout: s.workoutSnapshot,
          startedAt: s.startedAt,
        })),
      };
    }

    // No session that day — check for a scheduled workout instead (supports future-dated references).
    const scheduled = await listScheduledWorkoutsOnDate(client, userId, dateResolution.result.date);
    if (scheduled.length === 1) {
      const s = scheduled[0]!;
      return {
        status: 'resolved',
        match: { kind: 'scheduled', id: s.id, title: s.title, workout: s.workoutSnapshot, scheduledDate: s.scheduledDate },
      };
    }
    if (scheduled.length > 1) {
      return {
        status: 'ambiguous',
        choices: scheduled.map((s) => ({
          kind: 'scheduled' as const,
          id: s.id,
          title: s.title,
          workout: s.workoutSnapshot,
          scheduledDate: s.scheduledDate,
        })),
      };
    }

    return { status: 'not_found' };
  }

  // Not a date reference — treat it as a template/title search.
  const nameQuery = stripWorkoutSuffix(trimmed).replace(/^(template|hotel gym)$/i, trimmed);
  const templates = await findTemplatesByTitle(client, userId, nameQuery || trimmed, 10);
  const candidates = templates.length > 0 ? templates : await fallbackFuzzyTemplateMatch(client, userId, trimmed);

  if (candidates.length === 1) {
    const t = candidates[0]!;
    return { status: 'resolved', match: { kind: 'template', id: t.id, title: t.workout.title, workout: t.workout } };
  }
  if (candidates.length > 1) {
    return {
      status: 'ambiguous',
      choices: candidates.map((t) => ({ kind: 'template' as const, id: t.id, title: t.workout.title, workout: t.workout })),
    };
  }

  return { status: 'not_found' };
}

async function fallbackFuzzyTemplateMatch(client: SupabaseClient, userId: string, descriptor: string) {
  const all = await listAllTemplates(client, userId);
  const words = descriptor.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return all.filter((t) => {
    const title = t.workout.title.toLowerCase();
    return words.some((w) => title.includes(w));
  });
}

/** Local calendar date (YYYY-MM-DD) that an ISO instant falls on in `timeZone`. */
function formatInTimeZoneDateOnly(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  );
}
