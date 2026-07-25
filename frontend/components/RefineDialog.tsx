"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";

export function RefineDialog({
  onRefine,
  onClose,
}: {
  onRefine: (focus: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [focus, setFocus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onRefine(focus.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      labelledBy="refine-dialog-title"
      className="animate-rise w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
    >
      <form onSubmit={submit}>
        <h2 id="refine-dialog-title" className="text-base font-medium text-ink">
          Refine again
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-2">
          Anything specific to double-check or tighten up this pass? Leave blank to
          just refine.
        </p>

        <textarea
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="e.g. make sure the tone stays formal, verify edge cases are covered…"
          rows={3}
          autoFocus
          className="mt-4 w-full resize-none rounded-xl border border-line bg-raised px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3"
        />

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-[13px] text-ink-3 transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-ember px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Refining…" : "Refine"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
