"use client";

import { useMemo } from "react";
import { diffWords } from "@/lib/diff";

/** Inline before/after diff: removals struck through in red, additions tinted green. */
export function DiffView({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => diffWords(before, after), [before, after]);
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-6 py-4 font-mono text-xs leading-[1.8] text-ink-2">
      {parts.map((p, i) =>
        p.kind === "same" ? (
          <span key={i}>{p.text}</span>
        ) : (
          <span
            key={i}
            className={`rounded-[2px] ${p.kind === "removed" ? "line-through opacity-70" : ""}`}
            style={{
              color:
                p.kind === "added"
                  ? "var(--color-grade-excellent)"
                  : "var(--color-grade-poor)",
              background: `color-mix(in srgb, ${
                p.kind === "added"
                  ? "var(--color-grade-excellent)"
                  : "var(--color-grade-poor)"
              } 12%, transparent)`,
            }}
          >
            {p.text}
          </span>
        ),
      )}
    </pre>
  );
}
