import type { SupabaseClient } from '@supabase/supabase-js';
import type { Workout, WorkoutTemplate } from '@/lib/workout/schema';
import type { WorkoutTemplateRow } from './rows';

function toDomain(row: WorkoutTemplateRow): WorkoutTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    workout: row.workout,
    source: row.source,
    parentTemplateId: row.parent_template_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateTemplateInput {
  userId: string;
  workout: Workout;
  source: 'ai' | 'manual';
  parentTemplateId?: string | null;
}

export async function createTemplate(
  client: SupabaseClient,
  input: CreateTemplateInput,
): Promise<WorkoutTemplate> {
  const { data, error } = await client
    .from('workout_templates')
    .insert({
      user_id: input.userId,
      workout: input.workout,
      source: input.source,
      parent_template_id: input.parentTemplateId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toDomain(data as WorkoutTemplateRow);
}

export async function getTemplate(client: SupabaseClient, id: string): Promise<WorkoutTemplate | null> {
  const { data, error } = await client.from('workout_templates').select().eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toDomain(data as WorkoutTemplateRow) : null;
}

/** Editing a template only ever updates this row — it must never reach into any ScheduledWorkout/WorkoutSession that already snapshotted it. */
export async function updateTemplateWorkout(
  client: SupabaseClient,
  id: string,
  workout: Workout,
): Promise<WorkoutTemplate> {
  const { data, error } = await client
    .from('workout_templates')
    .update({ workout })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return toDomain(data as WorkoutTemplateRow);
}

export async function deleteTemplate(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('workout_templates').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateTemplate(
  client: SupabaseClient,
  id: string,
  userId: string,
): Promise<WorkoutTemplate> {
  const original = await getTemplate(client, id);
  if (!original) throw new Error('Template not found');
  const copy: Workout = { ...original.workout, title: `${original.workout.title} (Copy)` };
  return createTemplate(client, { userId, workout: copy, source: original.source });
}

/** For "Create Modified Version" — always creates a new template, never overwrites the source. */
export async function createModifiedVersion(
  client: SupabaseClient,
  parentTemplateId: string,
  userId: string,
  modifiedWorkout: Workout,
): Promise<WorkoutTemplate> {
  return createTemplate(client, { userId, workout: modifiedWorkout, source: 'ai', parentTemplateId });
}

export interface RecentTemplatesOptions {
  limit?: number;
}

export async function listRecentTemplates(
  client: SupabaseClient,
  userId: string,
  options: RecentTemplatesOptions = {},
): Promise<WorkoutTemplate[]> {
  const { data, error } = await client
    .from('workout_templates')
    .select()
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(options.limit ?? 5);
  if (error) throw error;
  return (data as WorkoutTemplateRow[]).map(toDomain);
}

export async function listAllTemplates(client: SupabaseClient, userId: string): Promise<WorkoutTemplate[]> {
  const { data, error } = await client
    .from('workout_templates')
    .select()
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as WorkoutTemplateRow[]).map(toDomain);
}

export async function findTemplatesByTitle(
  client: SupabaseClient,
  userId: string,
  titleQuery: string,
  limit = 10,
): Promise<WorkoutTemplate[]> {
  const { data, error } = await client
    .from('workout_templates')
    .select()
    .eq('user_id', userId)
    .ilike('title', `%${titleQuery}%`)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as WorkoutTemplateRow[]).map(toDomain);
}
