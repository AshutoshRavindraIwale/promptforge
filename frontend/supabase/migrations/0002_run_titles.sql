-- Model-generated title for each run (EvaluationSchema.suggested_title). Nullable:
-- rows recorded before this migration fall back to a client-side heuristic title.
--
-- Apply once: paste into the Supabase SQL editor (Dashboard → SQL) and run.

alter table public.runs add column title text;
