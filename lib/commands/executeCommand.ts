import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModifyWorkoutResult, Workout } from '@/lib/workout/schema';
import type { WorkoutCommand } from '@/types/command';
import { resolveWorkoutReference, type ResolvedReference } from '@/lib/database/search';
import { resolveNaturalLanguageDate, type ResolveDateOptions } from '@/lib/dates/dates';
import { scheduleWorkout, rescheduleWorkout, getScheduledWorkout } from '@/lib/database/scheduled';
import { createTemplate } from '@/lib/database/templates';

/**
 * This module runs client-side (it's imported by components/home/CommandInput.tsx),
 * so the AI modification step goes through the /api/modify-workout HTTP route —
 * exactly like every other AI call in the app — rather than importing the
 * server-only lib/anthropic/modifyWorkout module directly.
 */
async function callModifyWorkoutApi(workout: Workout, instruction: string): Promise<ModifyWorkoutResult> {
  const response = await fetch('/api/modify-workout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workout, instruction }),
  });
  return (await response.json()) as ModifyWorkoutResult;
}

/**
 * THIS FILE IS THE SINGLE ENFORCEMENT POINT for "Claude never manipulates
 * the database directly." Claude (via /api/parse-command and
 * /api/modify-workout) only ever produces intent + candidate content;
 * every database write for a natural-language command happens here, and
 * only after `resolveCommandPreview` has produced a preview and the user
 * has explicitly confirmed it via `commitCommandAction`.
 */

export type CommandPreview =
  | { kind: 'found'; reference: ResolvedReference }
  | { kind: 'ambiguous'; choices: ResolvedReference[] }
  | { kind: 'not_found' }
  | { kind: 'date_unresolved'; reason: string }
  | { kind: 'modify_ready'; reference: ResolvedReference; modified: Workout }
  | { kind: 'schedule_ready'; reference: ResolvedReference; date: string; time: string | null }
  | {
      kind: 'modify_and_schedule_ready';
      reference: ResolvedReference;
      modified: Workout;
      date: string;
      time: string | null;
    }
  | { kind: 'reschedule_ready'; scheduledWorkoutId: string; title: string; fromDate: string; date: string; time: string | null }
  | { kind: 'ai_error'; message: string };

export async function resolveCommandPreview(
  client: SupabaseClient,
  userId: string,
  command: WorkoutCommand,
  dateOptions: ResolveDateOptions,
): Promise<CommandPreview> {
  const found = await lookupReference(client, userId, command.ref.descriptor, dateOptions);
  if (found.kind !== 'found') return found;
  return buildPreviewForReference(command, found.reference, dateOptions);
}

/**
 * Continues resolution once a specific reference is already known — used
 * both for the normal single-match path and for the disambiguation flow
 * (the user picked one of several choices the app showed them).
 */
export async function buildPreviewForReference(
  command: WorkoutCommand,
  reference: ResolvedReference,
  dateOptions: ResolveDateOptions,
): Promise<CommandPreview> {
  if (command.type === 'find_workout') {
    return { kind: 'found', reference };
  }

  if (command.type === 'modify_workout') {
    const modResult = await callModifyWorkoutApi(reference.workout, command.instruction);
    if (!modResult.ok) return { kind: 'ai_error', message: modResult.message };
    return { kind: 'modify_ready', reference, modified: modResult.workout };
  }

  if (command.type === 'schedule_workout') {
    const dateResolution = resolveDateAndTime(command.naturalLanguageDate, command.naturalLanguageTime, dateOptions);
    if (!dateResolution.ok) return { kind: 'date_unresolved', reason: dateResolution.reason };
    return { kind: 'schedule_ready', reference, date: dateResolution.result.date, time: dateResolution.result.time };
  }

  if (command.type === 'modify_and_schedule') {
    const dateResolution = resolveDateAndTime(command.naturalLanguageDate, command.naturalLanguageTime, dateOptions);
    if (!dateResolution.ok) return { kind: 'date_unresolved', reason: dateResolution.reason };
    const modResult = await callModifyWorkoutApi(reference.workout, command.instruction);
    if (!modResult.ok) return { kind: 'ai_error', message: modResult.message };
    return {
      kind: 'modify_and_schedule_ready',
      reference,
      modified: modResult.workout,
      date: dateResolution.result.date,
      time: dateResolution.result.time,
    };
  }

  // reschedule — the reference must resolve to an already-scheduled workout, not a template/session.
  if (reference.kind !== 'scheduled') return { kind: 'not_found' };
  const dateResolution = resolveDateAndTime(command.naturalLanguageDate, command.naturalLanguageTime, dateOptions);
  if (!dateResolution.ok) return { kind: 'date_unresolved', reason: dateResolution.reason };
  return {
    kind: 'reschedule_ready',
    scheduledWorkoutId: reference.id,
    title: reference.title,
    fromDate: reference.scheduledDate ?? '',
    date: dateResolution.result.date,
    time: dateResolution.result.time,
  };
}

function resolveDateAndTime(naturalLanguageDate: string, naturalLanguageTime: string | null, dateOptions: ResolveDateOptions) {
  const combined = naturalLanguageTime ? `${naturalLanguageDate} ${naturalLanguageTime}` : naturalLanguageDate;
  return resolveNaturalLanguageDate(combined, dateOptions);
}

async function lookupReference(
  client: SupabaseClient,
  userId: string,
  descriptor: string,
  dateOptions: ResolveDateOptions,
): Promise<CommandPreview> {
  const resolution = await resolveWorkoutReference(client, userId, descriptor, dateOptions);
  if (resolution.status === 'resolved') return { kind: 'found', reference: resolution.match };
  if (resolution.status === 'ambiguous') return { kind: 'ambiguous', choices: resolution.choices };
  return { kind: 'not_found' };
}

/** Executes exactly one already-previewed, user-confirmed action. Never called without a prior explicit confirmation in the UI. */
export async function commitCommandAction(
  client: SupabaseClient,
  userId: string,
  preview: CommandPreview,
): Promise<{ ok: true } | { ok: false; message: string }> {
  switch (preview.kind) {
    case 'modify_ready': {
      await createTemplate(client, {
        userId,
        workout: preview.modified,
        source: 'ai',
        parentTemplateId: preview.reference.kind === 'template' ? preview.reference.id : null,
      });
      return { ok: true };
    }
    case 'schedule_ready': {
      await scheduleWorkout(client, {
        userId,
        templateId: preview.reference.kind === 'template' ? preview.reference.id : null,
        workoutSnapshot: preview.reference.workout,
        title: preview.reference.title,
        scheduledDate: preview.date,
        scheduledTime: preview.time,
      });
      return { ok: true };
    }
    case 'modify_and_schedule_ready': {
      await scheduleWorkout(client, {
        userId,
        templateId: null,
        workoutSnapshot: preview.modified,
        title: preview.modified.title,
        scheduledDate: preview.date,
        scheduledTime: preview.time,
      });
      return { ok: true };
    }
    case 'reschedule_ready': {
      await rescheduleWorkout(client, preview.scheduledWorkoutId, preview.date, preview.time);
      return { ok: true };
    }
    default:
      return { ok: false, message: 'Nothing to confirm for this request.' };
  }
}

export async function getScheduledWorkoutTitle(client: SupabaseClient, id: string): Promise<string | null> {
  const row = await getScheduledWorkout(client, id);
  return row?.title ?? null;
}
