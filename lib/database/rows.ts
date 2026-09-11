import type { Workout } from '@/lib/workout/schema';

/**
 * Raw Postgres row shapes (snake_case, as returned by supabase-js) for
 * each table. Kept separate from the domain types in lib/workout/schema.ts
 * — the mapper functions in each database/*.ts module are the only place
 * that translates between the two.
 */

export interface WorkoutTemplateRow {
  id: string;
  user_id: string;
  workout: Workout;
  source: 'ai' | 'manual';
  parent_template_id: string | null;
  title: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ScheduledWorkoutRow {
  id: string;
  user_id: string;
  template_id: string | null;
  workout_snapshot: Workout;
  title: string;
  scheduled_date: string;
  scheduled_time: string | null;
  timezone: string | null;
  status: 'scheduled' | 'completed' | 'skipped' | 'cancelled';
  skip_reason: string | null;
  resulting_session_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSessionRow {
  id: string;
  user_id: string;
  template_id: string | null;
  scheduled_workout_id: string | null;
  workout_snapshot: Workout;
  title: string;
  started_at: string;
  completed_at: string | null;
  status: 'completed' | 'partial' | 'abandoned';
  actual_duration_seconds: number | null;
  completed_intervals: number | null;
  total_intervals: number | null;
  stopped_at_step_id: string | null;
  notes: string | null;
  created_at: string;
}
