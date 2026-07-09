"use client";

import { useState } from "react";

export function RevisedPrompt({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; ignore
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-6 py-3.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
          Revised prompt
        </span>
        <button
          onClick={copy}
          className="rounded-full px-3 py-1 text-xs text-ink-2 transition-colors hover:bg-raised hover:text-ink"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words px-6 py-5 font-mono text-[13px] leading-[1.7] text-ink">
        {text}
      </pre>
    </div>
  );
}
