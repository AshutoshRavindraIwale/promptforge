"use client";

import { useState } from "react";
import { keyHeaders } from "@/lib/apiKeys";
import { getFramework } from "@/lib/frameworks";

interface Suggestion {
  framework: string;
  reason: string;
}

// The outcome of one classification, pinned to the draft it was computed for. A result whose
// draft no longer matches the textarea is stale and simply isn't rendered — no effect needed.
interface Result {
  draft: string;
  suggestion?: Suggestion;
  error?: string;
}

function Sparkle() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="currentColor" aria-hidden>
      <path d="M8 1.5l1.4 3.6a1 1 0 00.57.57L13.5 7 9.97 8.4a1 1 0 00-.57.57L8 12.5 6.6 8.97a1 1 0 00-.57-.57L2.5 7l3.53-1.4a1 1 0 00.57-.57L8 1.5z" />
      <path d="M12.75 10.5l.6 1.53 1.53.6-1.53.6-.6 1.53-.6-1.53-1.53-.6 1.53-.6.6-1.53z" />
    </svg>
  );
}

/**
 * "Which framework fits this draft?" — a button that asks a fast classifier, then shows the
 * pick as a chip with the model's one-line rationale and a one-click Apply. It never switches
 * the framework on its own; the user stays in control (and learns the frameworks over time).
 */
export function SuggestFramework({
  draft,
  value,
  onApply,
  disabled,
}: {
  draft: string;
  value: string;
  onApply: (id: string) => void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // A suggestion is about a specific draft — once the text changes, it silently disappears.
  const current = result?.draft === draft ? result : null;
  const suggestion = current?.suggestion ?? null;
  const error = current?.error ?? null;

  async function suggest() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/suggest-framework", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...keyHeaders() },
        body: JSON.stringify({ draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Suggestion failed.");
      setResult({ draft, suggestion: data as Suggestion });
    } catch (err) {
      setResult({
        draft,
        error: err instanceof Error ? err.message : "Suggestion failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  const suggested = suggestion ? getFramework(suggestion.framework) : null;
  const alreadySelected = suggested !== null && suggested.id === value;

  return (
    <div className="px-6 pt-2">
      {!suggestion && (
        <button
          type="button"
          onClick={() => void suggest()}
          disabled={disabled || loading || !draft.trim()}
          className="inline-flex items-center gap-1.5 text-xs text-ink-3 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkle />
          {loading ? "Reading your draft…" : "Suggest a framework"}
        </button>
      )}

      {error && <p className="text-xs text-grade-poor">{error}</p>}

      {suggestion && suggested && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-raised px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <span className="text-ember">
              <Sparkle />
            </span>
            {suggested.name}
          </span>
          <span className="min-w-0 flex-1 text-ink-3">{suggestion.reason}</span>
          {alreadySelected ? (
            <span className="shrink-0 text-ink-3">Selected ✓</span>
          ) : (
            <button
              type="button"
              onClick={() => {
                onApply(suggested.id);
                setResult(null);
              }}
              className="shrink-0 rounded-full border border-ember/50 px-3 py-1 font-medium text-ember transition-colors hover:bg-ember/10"
            >
              Apply
            </button>
          )}
          <button
            type="button"
            onClick={() => setResult(null)}
            aria-label="Dismiss suggestion"
            className="shrink-0 px-1 text-ink-3 transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
