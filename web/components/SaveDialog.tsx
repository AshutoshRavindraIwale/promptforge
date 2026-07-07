"use client";

import { useState, type FormEvent } from "react";

export interface SavePayload {
  name: string;
  category: string;
  tags: string[];
}

export function SaveDialog({
  defaultCategory,
  defaultTags,
  onSave,
  onClose,
}: {
  defaultCategory: string;
  defaultTags: string[];
  onSave: (payload: SavePayload) => void | Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
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
    "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500";
  const label = "mt-4 block text-xs font-medium text-slate-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-white">Save prompt</h2>

        <label className={label}>Name</label>
        <input
          autoFocus
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

        <label className={label}>Tags (comma-separated)</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className={field} />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
