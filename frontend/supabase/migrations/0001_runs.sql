-- Evaluation run history. Every /api/evaluate result is recorded here from the
-- browser client; "Refine again" links iterations into a chain via parent_run_id,
-- and root_run_id groups a whole chain (equals id for the first run in a chain).
--
-- Apply once: paste into the Supabase SQL editor (Dashboard → SQL) and run.

create table public.runs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  root_run_id uuid not null,
  parent_run_id uuid references public.runs (id) on delete set null,
  draft text not null,
  revised_prompt text not null,
  scorecard jsonb not null,
  overall_score text not null,
  priority_fix text not null,
  created_at timestamptz not null default now()
);

alter table public.runs enable row level security;

create policy "runs_select_own" on public.runs
  for select using (auth.uid() = user_id);
create policy "runs_insert_own" on public.runs
  for insert with check (auth.uid() = user_id);
create policy "runs_delete_own" on public.runs
  for delete using (auth.uid() = user_id);

create index runs_user_recent_idx on public.runs (user_id, created_at desc);
create index runs_chain_idx on public.runs (root_run_id, created_at);
