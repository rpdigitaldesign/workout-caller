-- Row Level Security. This app is single-user today, but every table is
-- scoped to auth.uid() from day one — it costs nothing extra now and
-- means a second user could never accidentally see the first user's data
-- if this were ever extended later.

alter table workout_templates enable row level security;
alter table scheduled_workouts enable row level security;
alter table workout_sessions enable row level security;

create policy "templates_owner_all" on workout_templates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "scheduled_owner_all" on scheduled_workouts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sessions_owner_all" on workout_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
