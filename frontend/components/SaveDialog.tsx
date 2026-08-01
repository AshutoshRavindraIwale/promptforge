"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";

export interface SavePayload {
  name: string;
  category: string;
  tags: string[];
}

export function SaveDialog({
  defaultName = "",
  defaultCategory,
  defaultTags,
  onSave,
  onClose,
}: {
  defaultName?: string;
  defaultCategory: string;
  defaultTags: string[];
  onSave: (payload: SavePayload) => void | Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState(defaultCategory);
  const [tags, setTags] = useState(defaultTags.join(", "));
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim() || "Untitled prompt",
        category: category.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
    } finally {
      setSaving(false);
    }
  }

  const field =
    "mt-1.5 w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3";
  const label =
    "mt-4 block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3";

  return (
    <Modal
      onClose={onClose}
      labelledBy="save-dialog-title"
      className="animate-rise w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
    >
      <form onSubmit={submit}>
        <h2 id="save-dialog-title" className="text-base font-medium text-ink">
          Save to library
        </h2>

        <label className={label}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Climate explainer"
          className={field}
        />

        <label className={label}>Category</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={field}
        />

        <label className={label}>Tags, comma-separated</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className={field}
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
            disabled={saving}
            className="rounded-full bg-ember px-5 py-2 text-[13px] font-medium text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
