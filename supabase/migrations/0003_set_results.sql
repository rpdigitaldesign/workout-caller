-- Per-set weights recorded during a workout.
-- Additive only: one new nullable column; existing rows and policies are untouched
-- (the existing owner-only RLS policy on workout_sessions already covers it).
-- Shape (validated by the app, like workout_snapshot): a JSON array of
--   { "stepId": text, "name": text, "origin": "warmup"|"main"|"cooldown",
--     "round": int|null, "weightLb": number }
alter table workout_sessions
  add column if not exists set_results jsonb;
