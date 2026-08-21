"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  allEntries,
  deleteEntry,
  searchEntries,
  type LibraryEntry,
} from "@/lib/library";
import { extractPlaceholders } from "@/lib/template";
import { inferFramework } from "@/lib/frameworks";
import { ScoreBadge } from "./Scorecard";
import { UseTemplateDialog } from "./UseTemplateDialog";

/** Compact relative timestamp: minutes/hours/days for the recent past, then a plain date. */
function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function Library() {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  // Category filter, layered client-side on top of search. The chip row is built from the
  // last unfiltered fetch so chips don't vanish while a search narrows the list.
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [useEntry, setUseEntry] = useState<LibraryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Search is debounced, so requests overlap: a slow fetch for an earlier query can resolve
  // after a faster one for what the user has since typed. Each call takes a ticket, and only
  // the newest one is allowed to render — otherwise the stale response wins and the list stops
  // matching the search box until the next keystroke.
  const latestRequest = useRef(0);

  // Which entries have fillable [PLACEHOLDER] fields, computed once per entry list rather than
  // re-scanning every prompt's full text on every render (search typing, opening a row, …).
  const hasPlaceholders = useMemo(
    () =>
      new Set(
        entries
          .filter((e) => extractPlaceholders(e.revised_prompt).length > 0)
          .map((e) => e.id),
      ),
    [entries],
  );

  async function refresh(q: string) {
    const request = ++latestRequest.current;
    const superseded = () => request !== latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const rows = q.trim() ? await searchEntries(q) : await allEntries();
      if (superseded()) return;
      setEntries(rows);
      if (!q.trim()) {
        setCategories(
          [...new Set(rows.map((e) => e.category.trim()).filter(Boolean))].sort(
            (a, b) => a.localeCompare(b),
          ),
        );
      }
    } catch {
      if (superseded()) return;
      setError("Could not load your library. Refresh to try again.");
    } finally {
      // Leave the spinner up for the request that is still current.
      if (!superseded()) setLoading(false);
    }
  }

  // Debounce search so we don't hit the network on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => void refresh(query), query.trim() ? 250 : 0);
    return () => clearTimeout(t);
  }, [query]);

  async function copy(entry: LibraryEntry) {
    try {
      await navigator.clipboard.writeText(entry.revised_prompt);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  }

  async function remove(id: string) {
    try {
      await deleteEntry(id);
      if (openId === id) setOpenId(null);
      await refresh(query);
    } catch {
      setError("Could not delete that prompt.");
    }
  }

  const visible = category
    ? entries.filter((e) => e.category.trim() === category)
    : entries;

  return (
    <div className="mt-4 space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your library…"
        className="w-full rounded-full border border-line bg-surface px-5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3"
      />

      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {[null, ...categories].map((c) => (
            <button
              key={c ?? "all"}
              onClick={() => setCategory(c)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${
                category === c
                  ? "border-ink-3 bg-raised text-ink"
                  : "border-line text-ink-2 hover:border-ink-3 hover:text-ink"
              }`}
            >
              {c ?? "All"}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-grade-poor/30 bg-grade-poor/10 px-4 py-3 text-sm text-grade-poor">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-20 text-center text-sm text-ink-3">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-ink-2">
            {query.trim() || category
              ? "No matching prompts."
              : "No saved prompts yet."}
          </p>
          {!query.trim() && !category && (
            <p className="mt-1.5 text-sm text-ink-3">
              Prompts you save after evaluating appear here.
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {visible.map((e) => (
            <li key={e.id}>
              <div className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
                <button
                  onClick={() => setOpenId(openId === e.id ? null : e.id)}
                  className="min-w-0 flex-1 rounded-md text-left"
                >
                  <span className="block truncate text-sm font-medium text-ink">
                    {e.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {[
                      e.category,
                      inferFramework(e.scorecard)?.name,
                      ...e.tags,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
                {/* Nearly every save grades Needs Work (people save after one pass), so a
                    badge on every row is noise. Reserve it for the wins. */}
                {(e.overall_score === "Good" ||
                  e.overall_score === "Excellent") && (
                  <ScoreBadge score={e.overall_score} />
                )}
                <span className="hidden whitespace-nowrap text-xs text-ink-3 sm:block">
                  {timeAgo(e.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  {hasPlaceholders.has(e.id) && (
                    <button
                      onClick={() => setUseEntry(e)}
                      className="rounded-full px-2.5 py-1 text-xs text-ember transition-colors hover:bg-raised"
                    >
                      Use
                    </button>
                  )}
                  <button
                    onClick={() => copy(e)}
                    className="rounded-full px-2.5 py-1 text-xs text-ink-3 transition-colors hover:bg-raised hover:text-ink"
                  >
                    {copiedId === e.id ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => remove(e.id)}
                    className="rounded-full px-2.5 py-1 text-xs text-ink-3 transition-colors hover:bg-raised hover:text-grade-poor"
                  >
                    Delete
                  </button>
                </span>
              </div>
              {openId === e.id && (
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border-t border-line bg-bg/40 px-6 py-4 font-mono text-xs leading-[1.7] text-ink-2">
                  {e.revised_prompt}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}

      {useEntry && (
        <UseTemplateDialog entry={useEntry} onClose={() => setUseEntry(null)} />
      )}
    </div>
  );
}
