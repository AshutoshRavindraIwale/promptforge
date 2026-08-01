"use client";

import { useMemo, useState } from "react";
import type { LibraryEntry } from "@/lib/library";
import { extractPlaceholders, fillTemplate } from "@/lib/template";
import { Modal } from "./Modal";

/**
 * Fill a saved prompt's [PLACEHOLDER] fields and copy the finished prompt.
 * Unfilled fields stay visible in the preview, tinted ember.
 */
export function UseTemplateDialog({
  entry,
  onClose,
}: {
  entry: LibraryEntry;
  onClose: () => void;
}) {
  const placeholders = useMemo(
    () => extractPlaceholders(entry.revised_prompt),
    [entry.revised_prompt],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const filled = fillTemplate(entry.revised_prompt, values);
  const remaining = extractPlaceholders(filled).length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(filled);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; ignore
    }
  }

  // Preview with unfilled placeholders highlighted so gaps are obvious.
  const previewParts = filled.split(/(\[[A-Z][A-Z0-9 _-]*\])/g);

  const field =
    "mt-1.5 w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3";
  const label =
    "mt-4 block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3";

  return (
    <Modal
      onClose={onClose}
      labelledBy="use-template-title"
      className="animate-rise flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-surface shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
    >
        <div className="border-b border-line px-6 py-4">
          <h2 id="use-template-title" className="text-base font-medium text-ink">
            {entry.name}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Fill in the fields — the prompt updates live.
          </p>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="overflow-y-auto border-b border-line px-6 pb-6 pt-1 sm:border-b-0 sm:border-r">
            {placeholders.map((name) => (
              <label key={name} className="block">
                <span className={label}>{name.toLowerCase()}</span>
                <input
                  value={values[name] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [name]: e.target.value }))
                  }
                  placeholder={`[${name}]`}
                  className={field}
                />
              </label>
            ))}
          </div>

          <pre className="overflow-y-auto whitespace-pre-wrap break-words px-6 py-5 font-mono text-xs leading-[1.8] text-ink-2">
            {previewParts.map((part, i) =>
              /^\[[A-Z][A-Z0-9 _-]*\]$/.test(part) ? (
                <span key={i} className="text-ember">
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </pre>
        </div>

        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <span className="text-xs text-ink-3">
            {remaining === 0
              ? "All fields filled."
              : `${remaining} field${remaining === 1 ? "" : "s"} left`}
          </span>
          <span className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-4 py-2 text-[13px] text-ink-3 transition-colors hover:text-ink"
            >
              Close
            </button>
            <button
              onClick={copy}
              className="rounded-full bg-ember px-5 py-2 text-[13px] font-medium text-bg transition hover:brightness-110"
            >
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </span>
        </div>
    </Modal>
  );
}
