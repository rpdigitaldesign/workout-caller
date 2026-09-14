import type { SupabaseClient } from '@supabase/supabase-js';
import { WorkoutSchema, type ScheduledWorkout, type Workout } from '@/lib/workout/schema';
import { migrateWorkout } from '@/lib/workout/migrate';
import type { ScheduledWorkoutRow } from './rows';

function toDomain(row: ScheduledWorkoutRow): ScheduledWorkout {
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    workoutSnapshot: WorkoutSchema.parse(migrateWorkout(row.workout_snapshot)),
    title: row.title,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    timezone: row.timezone,
    status: row.status,
    skipReason: row.skip_reason,
    resultingSessionId: row.resulting_session_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateScheduledWorkoutInput {
  userId: string;
  templateId?: string | null;
  workoutSnapshot: Workout;
  title: string;
  scheduledDate: string;
  scheduledTime?: string | null;
  timezone?: string | null;
  notes?: string | null;
}

/** Always snapshots the workout at schedule time — never re-reads the template later. */
export async function scheduleWorkout(
  client: SupabaseClient,
  input: CreateScheduledWorkoutInput,
): Promise<ScheduledWorkout> {
  const { data, error } = await client
    .from('scheduled_workouts')
    .insert({
      user_id: input.userId,
      template_id: input.templateId ?? null,
      workout_snapshot: input.workoutSnapshot,
      title: input.title,
      scheduled_date: input.scheduledDate,
      scheduled_time: input.scheduledTime ?? null,
      timezone: input.timezone ?? null,
      notes: input.notes ?? null,
      status: 'scheduled',
    })
    .select()
    .single();
  if (error) throw error;
  return toDomain(data as ScheduledWorkoutRow);
}

export async function getScheduledWorkout(client: SupabaseClient, id: string): Promise<ScheduledWorkout | null> {
  const { data, error } = await client.from('scheduled_workouts').select().eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toDomain(data as ScheduledWorkoutRow) : null;
}

/** Reschedule changes only date/time — never the workout content. */
export async function rescheduleWorkout(
  client: SupabaseClient,
  id: string,
  scheduledDate: string,
  scheduledTime: string | null,
): Promise<ScheduledWorkout> {
  const { data, error } = await client
    .from('scheduled_workouts')
    .update({ scheduled_date: scheduledDate, scheduled_time: scheduledTime })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return toDomain(data as ScheduledWorkoutRow);
}

/** Skip never deletes the row — an optional, non-required reason may be recorded. */
export async function skipScheduledWorkout(
  client: SupabaseClient,
  id: string,
  reason?: string | null,
): Promise<ScheduledWorkout> {
  const { data, error } = await client
    .from('scheduled_workouts')
    .update({ status: 'skipped', skip_reason: reason ?? null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return toDomain(data as ScheduledWorkoutRow);
}

export async function cancelScheduledWorkout(client: SupabaseClient, id: string): Promise<ScheduledWorkout> {
  const { data, error } = await client
    .from('scheduled_workouts')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return toDomain(data as ScheduledWorkoutRow);
}

/** Links a ScheduledWorkout to the WorkoutSession it produced and marks it completed — both records are preserved. */
export async function markScheduledWorkoutCompleted(
  client: SupabaseClient,
  id: string,
  sessionId: string,
): Promise<ScheduledWorkout> {
  const { data, error } = await client
    .from('scheduled_workouts')
    .update({ status: 'completed', resulting_session_id: sessionId })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return toDomain(data as ScheduledWorkoutRow);
}

export async function listScheduledWorkoutsBetween(
  client: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<ScheduledWorkout[]> {
  const { data, error } = await client
    .from('scheduled_workouts')
    .select()
    .eq('user_id', userId)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_date', { ascending: true });
  if (error) throw error;
  return (data as ScheduledWorkoutRow[]).map(toDomain);
}

export interface UpcomingOptions {
  limit?: number;
  fromDate: string; // YYYY-MM-DD, inclusive
}

export async function listUpcomingScheduledWorkouts(
  client: SupabaseClient,
  userId: string,
  options: UpcomingOptions,
): Promise<ScheduledWorkout[]> {
  const { data, error } = await client
    .from('scheduled_workouts')
    .select()
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .gte('scheduled_date', options.fromDate)
    .order('scheduled_date', { ascending: true })
    .limit(options.limit ?? 5);
  if (error) throw error;
  return (data as ScheduledWorkoutRow[]).map(toDomain);
}

export async function listScheduledWorkoutsOnDate(
  client: SupabaseClient,
  userId: string,
  date: string,
): Promise<ScheduledWorkout[]> {
  const { data, error } = await client
    .from('scheduled_workouts')
    .select()
    .eq('user_id', userId)
    .eq('scheduled_date', date)
    .order('scheduled_time', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data as ScheduledWorkoutRow[]).map(toDomain);
}
