// Prompt library backed by Supabase Postgres (table `public.entries`). CRUD runs from the
// browser client; Row-Level Security (auth.uid() = user_id) scopes every row to the signed-in
// user, and the `user_id` column defaults to auth.uid() so callers never pass it.
import { createClient } from "@/lib/supabase/client";
import type { Score, Scorecard } from "./schema";

export interface LibraryEntry {
  id: string;
  name: string;
  category: string;
  tags: string[];
  original_prompt: string;
  revised_prompt: string;
  scorecard: Scorecard;
  overall_score: Score;
  priority_fix: string;
  created_at: string;
}

// Columns the client reads/writes (excludes the trigger-maintained `search_text`).
const COLUMNS =
  "id, name, category, tags, original_prompt, revised_prompt, scorecard, overall_score, priority_fix, created_at";

const supabase = createClient();

export async function allEntries(): Promise<LibraryEntry[]> {
  const { data, error } = await supabase
    .from("entries")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LibraryEntry[];
}

export async function addEntry(
  entry: Omit<LibraryEntry, "id" | "created_at">,
): Promise<LibraryEntry> {
  // user_id is filled by the column default auth.uid(); the RLS insert policy enforces it.
  const { data, error } = await supabase
    .from("entries")
    .insert(entry)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as LibraryEntry;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
}

export async function searchEntries(query: string): Promise<LibraryEntry[]> {
  const q = query.trim();
  if (!q) return allEntries();
  // `search_text` (maintained by a DB trigger) concatenates name/category/tags/prompts, so a
  // single ilike reproduces the old cross-field substring search.
  const { data, error } = await supabase
    .from("entries")
    .select(COLUMNS)
    .ilike("search_text", `%${q}%`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LibraryEntry[];
}
