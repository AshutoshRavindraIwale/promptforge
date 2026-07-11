"use client";

import { useEffect, useState } from "react";
import {
  deleteChain,
  groupIntoChains,
  isMissingRunsTable,
  recentRuns,
  type RunRecord,
} from "@/lib/history";
import { SCORES, type Score } from "@/lib/schema";
import { ScoreBadge } from "./Scorecard";
import { DiffView } from "./DiffView";

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Score movement vs the previous version in the chain. */
function DeltaChip({ prev, curr }: { prev: Score; curr: Score }) {
  const d = SCORES.indexOf(curr) - SCORES.indexOf(prev);
  if (d === 0) return <span className="text-xs text-ink-3">·</span>;
  return (
    <span
      className="text-xs font-medium"
      style={{
        color:
          d > 0 ? "var(--color-grade-excellent)" : "var(--color-grade-poor)",
      }}
    >
      {d > 0 ? `▲${d}` : `▼${-d}`}
    </span>
  );
}

// First line of actual prose: XML-ish tags and markdown markers are stripped so a
// structured prompt titles as "You are a senior product manager…", not "<role>".
function chainTitle(text: string): string {
  for (const raw of text.split("\n")) {
    const line = raw
      .replace(/<[^>]*>/g, " ")
      .replace(/^[#>\-*\s]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (line.length >= 8) return line;
  }
  return text.trim().replace(/\s+/g, " ").slice(0, 80) || "Untitled prompt";
}

function Chain({
  runs,
  onContinue,
  onDelete,
}: {
  runs: RunRecord[];
  onContinue: (run: RunRecord) => void;
  onDelete: (rootRunId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [openVersion, setOpenVersion] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const latest = runs[runs.length - 1];

  async function copy(run: RunRecord) {
    try {
      await navigator.clipboard.writeText(run.revised_prompt);
      setCopiedId(run.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <li>
      <div className="flex items-center gap-4 px-6 py-4">
        <button
          onClick={() => setOpen(!open)}
          className="min-w-0 flex-1 rounded-md text-left"
        >
          <span className="block truncate text-sm font-medium text-ink">
            {latest.title ?? chainTitle(runs[0].draft)}
          </span>
          <span className="mt-0.5 block text-xs text-ink-3">
            {runs.length === 1 ? "1 version" : `${runs.length} versions`}
            {" · "}
            {timeAgo(latest.created_at)}
          </span>
        </button>
        <ScoreBadge score={latest.overall_score} />
        <button
          onClick={() => onDelete(runs[0].root_run_id)}
          className="rounded-full px-2.5 py-1 text-xs text-ink-3 transition-colors hover:bg-raised hover:text-grade-poor"
        >
          Delete
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-bg/40">
          <ul className="divide-y divide-line/60">
            {runs.map((run, i) => (
              <li key={run.id}>
                <div className="flex items-center gap-3 px-6 py-3">
                  <button
                    onClick={() =>
                      setOpenVersion(openVersion === run.id ? null : run.id)
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
                  >
                    <span className="w-7 text-xs font-medium text-ink-3">
                      v{i + 1}
                    </span>
                    <ScoreBadge score={run.overall_score} />
                    {i > 0 && (
                      <DeltaChip
                        prev={runs[i - 1].overall_score}
                        curr={run.overall_score}
                      />
                    )}
                    <span className="ml-auto text-xs text-ink-3">
                      {timeAgo(run.created_at)}
                    </span>
                  </button>
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => copy(run)}
                      className="rounded-full px-2.5 py-1 text-xs text-ink-3 transition-colors hover:bg-raised hover:text-ink"
                    >
                      {copiedId === run.id ? "Copied" : "Copy"}
                    </button>
                    <button
                      onClick={() => onContinue(run)}
                      className="rounded-full px-2.5 py-1 text-xs text-ink-3 transition-colors hover:bg-raised hover:text-ink"
                    >
                      Refine
                    </button>
                  </span>
                </div>
                {openVersion === run.id && (
                  <div className="border-t border-line/60">
                    <p className="px-6 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
                      Changes in this version
                    </p>
                    <DiffView before={run.draft} after={run.revised_prompt} />
                    <p className="border-t border-line/60 px-6 py-3 text-xs leading-relaxed text-ink-3">
                      <span className="text-ink-2">Priority fix</span> —{" "}
                      {run.priority_fix}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export function History({
  onContinue,
}: {
  onContinue: (run: RunRecord) => void;
}) {
  const [chains, setChains] = useState<RunRecord[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const chains = groupIntoChains(await recentRuns());
      setChains(chains);
      setError(null);
    } catch (e) {
      setError(
        isMissingRunsTable(e)
          ? "Run history isn't set up yet. Run supabase/migrations/0001_runs.sql in your Supabase SQL editor, then evaluations will be recorded here automatically."
          : "Could not load your history. Refresh to try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Deferred a tick (same idiom as Library.tsx) so the effect body itself
  // never calls setState synchronously.
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, []);

  async function remove(rootRunId: string) {
    try {
      await deleteChain(rootRunId);
      await refresh();
    } catch {
      setError("Could not delete that run.");
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {error && (
        <div className="rounded-xl border border-grade-poor/30 bg-grade-poor/10 px-4 py-3 text-sm text-grade-poor">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-20 text-center text-sm text-ink-3">Loading…</p>
      ) : chains.length === 0 ? (
        !error && (
          <div className="py-20 text-center">
            <p className="text-sm text-ink-2">No evaluations yet.</p>
            <p className="mt-1.5 text-sm text-ink-3">
              Every prompt you evaluate is recorded here — refine chains show
              how each version scored.
            </p>
          </div>
        )
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {chains.map((runs) => (
            <Chain
              key={runs[0].root_run_id}
              runs={runs}
              onContinue={onContinue}
              onDelete={remove}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
