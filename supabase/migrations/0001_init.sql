-- Workout Caller — initial schema.
-- Three tables, each scoped to a single Supabase Auth user via `user_id`.
-- Workout content lives entirely in a `jsonb` snapshot column, validated
-- by the application (Zod) on every read and write — Postgres only
-- guarantees "is valid JSON", not "matches the WorkoutSchema shape".

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function jsonb_tags_to_text_array(data jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array_agg(value),
    '{}'::text[]
  )
  from jsonb_array_elements_text(
    coalesce(data -> 'tags', '[]'::jsonb)
  ) as t(value);
$$;

-- ---------------------------------------------------------------------
-- workout_templates: reusable workouts. Editing a template never alters
-- any ScheduledWorkout or WorkoutSession that already snapshotted it.
-- ---------------------------------------------------------------------
create table workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout jsonb not null,
  source text not null check (source in ('ai', 'manual')),
  parent_template_id uuid references workout_templates(id) on delete set null,

  title text generated always as (workout ->> 'title') stored,

  tags text[] generated always as (
    jsonb_tags_to_text_array(workout)
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workout_templates_set_updated_at
  before update on workout_templates
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- scheduled_workouts: a workout planned for a future (or past) date.
-- `scheduled_date` is a plain DATE — never a timestamptz — so it can
-- never shift by a day when read back in a different timezone.
-- `workout_snapshot` is captured at schedule time and never re-reads the
-- template afterward.
-- ---------------------------------------------------------------------
create table scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references workout_templates(id) on delete set null,
  workout_snapshot jsonb not null,
  title text not null,
  scheduled_date date not null,
  scheduled_time time,
  timezone text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'skipped', 'cancelled')),
  skip_reason text,
  resulting_session_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger scheduled_workouts_set_updated_at
  before update on scheduled_workouts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- workout_sessions: historical truth — what was actually performed.
-- Immutable once written except for fields the completion/partial flow
-- itself sets. Never reads back through template_id/scheduled_workout_id
-- to derive its content — workout_snapshot is authoritative.
-- ---------------------------------------------------------------------
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references workout_templates(id) on delete set null,
  scheduled_workout_id uuid references scheduled_workouts(id) on delete set null,
  workout_snapshot jsonb not null,
  title text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null check (status in ('completed', 'partial', 'abandoned')),
  actual_duration_seconds integer check (actual_duration_seconds >= 0),
  completed_intervals integer check (completed_intervals >= 0),
  total_intervals integer check (total_intervals >= 0),
  stopped_at_step_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

alter table scheduled_workouts
  add constraint scheduled_workouts_resulting_session_fkey
  foreign key (resulting_session_id) references workout_sessions(id) on delete set null;

-- ---------------------------------------------------------------------
-- Indexes for the app's known query patterns — never load full history
-- for a calendar month view, an "upcoming" list, or a "most recent" list.
-- ---------------------------------------------------------------------
create index idx_templates_user_updated on workout_templates(user_id, updated_at desc); -- Recent Workouts
create index idx_templates_user_title on workout_templates(user_id, title);              -- find by title
create index idx_templates_tags on workout_templates using gin(tags);                    -- tag filter

create index idx_scheduled_user_date on scheduled_workouts(user_id, scheduled_date);      -- month range / by-date
create index idx_scheduled_upcoming on scheduled_workouts(user_id, scheduled_date)
  where status = 'scheduled';                                                            -- Coming Up / incomplete-scheduled
create index idx_scheduled_user_status on scheduled_workouts(user_id, status, scheduled_date);

create index idx_sessions_user_started on workout_sessions(user_id, started_at desc);     -- History / most recent
create index idx_sessions_user_template on workout_sessions(user_id, template_id);
