"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { getApiKeys, setApiKeys } from "@/lib/apiKeys";

// Bring-your-own-key settings: paste a Claude and/or Groq key to have the app spend your
// quota instead of the server's. Keys never leave this browser except as headers on this
// app's own API calls (see lib/apiKeys.ts), so clearing a field is a full revoke.
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState(getApiKeys);
  const [reveal, setReveal] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    setApiKeys(keys);
    onClose();
  }

  const field =
    "mt-1.5 w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 font-mono text-[13px] text-ink outline-none transition-colors placeholder:font-sans placeholder:text-ink-3 focus:border-ink-3";
  const label =
    "mt-4 block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3";
  const hint = "mt-1.5 block text-xs text-ink-3";

  return (
    <Modal
      onClose={onClose}
      labelledBy="settings-dialog-title"
      className="animate-rise w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
    >
      <form onSubmit={submit}>
        <h2 id="settings-dialog-title" className="text-base font-medium text-ink">
          API keys
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Stored only in this browser and used for your own requests. Leave a
          field blank to use the key configured on the server.
        </p>

        <label htmlFor="anthropic-key" className={label}>
          Claude API key
        </label>
        <input
          id="anthropic-key"
          type={reveal ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          value={keys.anthropic}
          onChange={(e) => setKeys({ ...keys, anthropic: e.target.value })}
          placeholder="sk-ant-…"
          className={field}
        />
        <span className={hint}>
          Powers evaluation and testing.{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-line underline-offset-2 hover:text-ink"
          >
            Get a key
          </a>
        </span>

        <label htmlFor="groq-key" className={label}>
          Groq API key
        </label>
        <input
          id="groq-key"
          type={reveal ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          value={keys.groq}
          onChange={(e) => setKeys({ ...keys, groq: e.target.value })}
          placeholder="gsk_…"
          className={field}
        />
        <span className={hint}>
          Powers mic dictation.{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-line underline-offset-2 hover:text-ink"
          >
            Get a free key
          </a>
        </span>

        <label className="mt-4 flex items-center gap-2 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={reveal}
            onChange={(e) => setReveal(e.target.checked)}
            className="size-3.5 accent-ember"
          />
          Show keys
        </label>

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
            className="rounded-full bg-ember px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-110"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
