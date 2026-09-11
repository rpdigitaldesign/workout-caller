import type { SupabaseClient } from '@supabase/supabase-js';
import type { Workout, WorkoutSession } from '@/lib/workout/schema';
import type { WorkoutSessionRow } from './rows';

function toDomain(row: WorkoutSessionRow): WorkoutSession {
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    scheduledWorkoutId: row.scheduled_workout_id,
    workoutSnapshot: row.workout_snapshot,
    title: row.title,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    actualDurationSeconds: row.actual_duration_seconds,
    completedIntervals: row.completed_intervals,
    totalIntervals: row.total_intervals,
    stoppedAtStepId: row.stopped_at_step_id,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export interface CreateSessionInput {
  userId: string;
  templateId?: string | null;
  scheduledWorkoutId?: string | null;
  workoutSnapshot: Workout;
  title: string;
  startedAt: string;
  completedAt?: string | null;
  status: 'completed' | 'partial' | 'abandoned';
  actualDurationSeconds?: number | null;
  completedIntervals?: number | null;
  totalIntervals?: number | null;
  stoppedAtStepId?: string | null;
  notes?: string | null;
}

export async function createSession(client: SupabaseClient, input: CreateSessionInput): Promise<WorkoutSession> {
  const { data, error } = await client
    .from('workout_sessions')
    .insert({
      user_id: input.userId,
      template_id: input.templateId ?? null,
      scheduled_workout_id: input.scheduledWorkoutId ?? null,
      workout_snapshot: input.workoutSnapshot,
      title: input.title,
      started_at: input.startedAt,
      completed_at: input.completedAt ?? null,
      status: input.status,
      actual_duration_seconds: input.actualDurationSeconds ?? null,
      completed_intervals: input.completedIntervals ?? null,
      total_intervals: input.totalIntervals ?? null,
      stopped_at_step_id: input.stoppedAtStepId ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toDomain(data as WorkoutSessionRow);
}

export async function getSession(client: SupabaseClient, id: string): Promise<WorkoutSession | null> {
  const { data, error } = await client.from('workout_sessions').select().eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toDomain(data as WorkoutSessionRow) : null;
}

export interface ListSessionsOptions {
  limit?: number;
  cursor?: string; // an ISO startedAt to page before
}

export async function listRecentSessions(
  client: SupabaseClient,
  userId: string,
  options: ListSessionsOptions = {},
): Promise<WorkoutSession[]> {
  let query = client
    .from('workout_sessions')
    .select()
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(options.limit ?? 20);
  if (options.cursor) {
    query = query.lt('started_at', options.cursor);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data as WorkoutSessionRow[]).map(toDomain);
}

export async function getMostRecentSession(client: SupabaseClient, userId: string): Promise<WorkoutSession | null> {
  const sessions = await listRecentSessions(client, userId, { limit: 1 });
  return sessions[0] ?? null;
}

export async function listSessionsBetween(
  client: SupabaseClient,
  userId: string,
  startIso: string,
  endIso: string,
): Promise<WorkoutSession[]> {
  const { data, error } = await client
    .from('workout_sessions')
    .select()
    .eq('user_id', userId)
    .gte('started_at', startIso)
    .lte('started_at', endIso)
    .order('started_at', { ascending: true });
  if (error) throw error;
  return (data as WorkoutSessionRow[]).map(toDomain);
}

export async function listSessionsByTemplate(
  client: SupabaseClient,
  userId: string,
  templateId: string,
): Promise<WorkoutSession[]> {
  const { data, error } = await client
    .from('workout_sessions')
    .select()
    .eq('user_id', userId)
    .eq('template_id', templateId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data as WorkoutSessionRow[]).map(toDomain);
}
