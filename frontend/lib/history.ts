// Evaluation run history backed by Supabase Postgres (table `public.runs`, see
// supabase/migrations/0001_runs.sql). Same access pattern as lib/library.ts: CRUD from the
// browser client, RLS scopes rows to the signed-in user, user_id defaults to auth.uid().
//
// The id is generated client-side so a chain-starting run can set root_run_id = its own id
// in the same insert; refinements inherit the parent's root_run_id.
import { createClient } from "@/lib/supabase/client";
import type { EvaluationResult, Score, Scorecard } from "./schema";

export interface RunRecord {
  id: string;
  root_run_id: string;
  parent_run_id: string | null;
  /** Model-generated title; null on rows recorded before migration 0002. */
  title: string | null;
  draft: string;
  revised_prompt: string;
  scorecard: Scorecard;
  overall_score: Score;
  priority_fix: string;
  created_at: string;
}

const COLUMNS =
  "id, root_run_id, parent_run_id, title, draft, revised_prompt, scorecard, overall_score, priority_fix, created_at";

// Pre-0002 column list (no title), used to fall back when the column doesn't exist yet.
const LEGACY_COLUMNS =
  "id, root_run_id, parent_run_id, draft, revised_prompt, scorecard, overall_score, priority_fix, created_at";

const supabase = createClient();

/**
 * True when the error means `public.runs` doesn't exist yet, so the UI can point
 * at the migration. PostgREST reports it as PGRST205 (missing from schema cache);
 * 42P01 is the raw Postgres code, kept in case the request bypasses the cache.
 */
export function isMissingRunsTable(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "PGRST205" || code === "42P01";
}

export async function recordRun(
  draft: string,
  result: EvaluationResult,
  parent: RunRecord | null,
): Promise<RunRecord> {
  const id = crypto.randomUUID();
  const row = {
    id,
    root_run_id: parent ? parent.root_run_id : id,
    parent_run_id: parent?.id ?? null,
    title: result.evaluation.suggested_title,
    draft,
    revised_prompt: result.evaluation.revised_prompt,
    scorecard: result.evaluation.scorecard,
    overall_score: result.overall_score,
    priority_fix: result.evaluation.priority_fix,
  };
  const first = await supabase.from("runs").insert(row).select(COLUMNS).single();
  let data: unknown = first.data;
  let error = first.error;
  if (error?.code === "PGRST204") {
    // runs.title doesn't exist yet (migration 0002 not applied) — still record the run.
    const { title, ...withoutTitle } = row;
    void title;
    const retry = await supabase
      .from("runs")
      .insert(withoutTitle)
      .select(LEGACY_COLUMNS)
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  const rec = data as RunRecord;
  return { ...rec, title: rec.title ?? null };
}

export async function recentRuns(limit = 200): Promise<RunRecord[]> {
  const first = await supabase
    .from("runs")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  let data: unknown[] | null = first.data;
  let error = first.error;
  if (error?.code === "42703") {
    // runs.title doesn't exist yet (migration 0002 not applied).
    const retry = await supabase
      .from("runs")
      .select(LEGACY_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return (data ?? []).map((r) => {
    const rec = r as RunRecord;
    return { ...rec, title: rec.title ?? null };
  });
}

export async function deleteChain(rootRunId: string): Promise<void> {
  const { error } = await supabase.from("runs").delete().eq("root_run_id", rootRunId);
  if (error) throw error;
}

/**
 * Group runs (newest-first, as returned by recentRuns) into refine chains.
 * Chains are ordered by most recent activity; runs within a chain oldest-first,
 * so index + 1 is the version number.
 */
export function groupIntoChains(runs: RunRecord[]): RunRecord[][] {
  const byRoot = new Map<string, RunRecord[]>();
  for (const run of runs) {
    const chain = byRoot.get(run.root_run_id);
    if (chain) chain.push(run);
    else byRoot.set(run.root_run_id, [run]);
  }
  return [...byRoot.values()].map((chain) => chain.reverse());
}
