"use client";

import { useEffect, useState } from "react";
import {
  allEntries,
  deleteEntry,
  searchEntries,
  type LibraryEntry,
} from "@/lib/library";
import { ScoreBadge } from "./Scorecard";

export function Library() {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh(q: string) {
    setLoading(true);
    setError(null);
    try {
      setEntries(q.trim() ? await searchEntries(q) : await allEntries());
    } catch {
      setError("Could not load your library. Refresh to try again.");
    } finally {
      setLoading(false);
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

  return (
    <div className="mt-4 space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your library…"
        className="w-full rounded-full border border-line bg-surface px-5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3"
      />

      {error && (
        <div className="rounded-xl border border-grade-poor/30 bg-grade-poor/10 px-4 py-3 text-sm text-grade-poor">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-20 text-center text-sm text-ink-3">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-ink-2">
            {query.trim() ? "No matching prompts." : "No saved prompts yet."}
          </p>
          {!query.trim() && (
            <p className="mt-1.5 text-sm text-ink-3">
              Prompts you save after evaluating appear here.
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {entries.map((e) => (
            <li key={e.id}>
              <div className="flex items-center gap-4 px-6 py-4">
                <button
                  onClick={() => setOpenId(openId === e.id ? null : e.id)}
                  className="min-w-0 flex-1 rounded-md text-left"
                >
                  <span className="block truncate text-sm font-medium text-ink">
                    {e.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {e.category}
                    {e.tags.length ? " · " + e.tags.join(" · ") : ""}
                  </span>
                </button>
                <ScoreBadge score={e.overall_score} />
                <span className="flex items-center gap-1">
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
    </div>
  );
}
