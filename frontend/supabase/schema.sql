-- PromptForge database schema.
-- Paste this whole file into your Supabase project's SQL editor (Dashboard → SQL Editor →
-- New query → Run). It is idempotent — safe to run twice.
--
-- One table holds the prompt library. Every row is owned by the signed-in user who created
-- it: `user_id` defaults to auth.uid() so the app never sends it, and Row-Level Security
-- restricts every operation to the row's owner.

create table if not exists public.entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null,
  category        text not null default '',
  tags            text[] not null default '{}',
  original_prompt text not null,
  revised_prompt  text not null,
  scorecard       jsonb not null,
  overall_score   text not null,
  priority_fix    text not null,
  created_at      timestamptz not null default now(),
  -- Maintained by the trigger below; the app's search runs a single ILIKE over this.
  search_text     text
);

-- Cross-field substring search: concatenate the searchable fields once per write instead of
-- OR-ing ILIKEs across five columns per query.
create or replace function public.entries_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text :=
    coalesce(new.name, '')            || ' ' ||
    coalesce(new.category, '')        || ' ' ||
    coalesce(array_to_string(new.tags, ' '), '') || ' ' ||
    coalesce(new.original_prompt, '') || ' ' ||
    coalesce(new.revised_prompt, '');
  return new;
end;
$$;

drop trigger if exists entries_search_text on public.entries;
create trigger entries_search_text
  before insert or update on public.entries
  for each row execute function public.entries_search_text();

-- The library lists newest-first, per user.
create index if not exists entries_user_created_idx
  on public.entries (user_id, created_at desc);

-- Row-Level Security: each user sees and touches only their own rows. The anon key shipped
-- to the browser is safe because these policies are the actual access control.
alter table public.entries enable row level security;

drop policy if exists "entries_select_own" on public.entries;
create policy "entries_select_own" on public.entries
  for select using (auth.uid() = user_id);

drop policy if exists "entries_insert_own" on public.entries;
create policy "entries_insert_own" on public.entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "entries_update_own" on public.entries;
create policy "entries_update_own" on public.entries
  for update using (auth.uid() = user_id);

drop policy if exists "entries_delete_own" on public.entries;
create policy "entries_delete_own" on public.entries
  for delete using (auth.uid() = user_id);
