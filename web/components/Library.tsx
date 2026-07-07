"use client";

import { useEffect, useState } from "react";
import {
  allEntries,
  deleteEntry,
  searchEntries,
  type LibraryEntry,
} from "@/lib/library";
import { ScoreBadge } from "./Scorecard";

export function Library({ onBack }: { onBack: () => void }) {
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
      setError("Could not load your library.");
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-white">
          ← Back
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search library…"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
          Loading…
        </p>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
          {query.trim() ? "No matching prompts." : "No saved prompts yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="flex items-center gap-3 p-3">
                <ScoreBadge score={e.overall_score} />
                <button
                  onClick={() => setOpenId(openId === e.id ? null : e.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium text-slate-100">
                    {e.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {e.category}
                    {e.tags.length ? " · " + e.tags.map((t) => "#" + t).join(" ") : ""}
                  </span>
                </button>
                <button
                  onClick={() => copy(e)}
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:text-white"
                >
                  {copiedId === e.id ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => remove(e.id)}
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-rose-300 hover:border-rose-500/50"
                >
                  Delete
                </button>
              </div>
              {openId === e.id && (
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border-t border-slate-800 p-3 font-mono text-xs text-slate-300">
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
