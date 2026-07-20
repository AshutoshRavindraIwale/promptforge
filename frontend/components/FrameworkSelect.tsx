"use client";

import { useEffect, useRef, useState } from "react";
import { FRAMEWORKS, getFramework } from "@/lib/frameworks";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-3.5 shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      aria-hidden
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-ember" fill="none" aria-hidden>
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Framework picker: a compact trigger showing the current framework, opening a popover menu
 * where each row shows the framework name and what it scores. The selected row is checked.
 */
export function FrameworkSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = getFramework(value);

  // Close on outside click or Escape while the menu is open.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative px-4 pt-4">
      <div className="flex items-center gap-2">
        <span className="pl-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
          Framework
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[12px] text-ink transition-colors hover:border-ink-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selected.name}
          <Chevron open={open} />
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute left-4 top-full z-20 mt-1.5 w-[min(23rem,calc(100%-2rem))] overflow-hidden rounded-xl border border-line bg-raised shadow-xl shadow-black/40"
        >
          {FRAMEWORKS.map((f, i) => {
            const active = f.id === selected.id;
            return (
              <button
                key={f.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(f.id);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface ${
                  i > 0 ? "border-t border-line/70" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">{f.name}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">
                    {f.tagline}
                  </span>
                </span>
                {active && <Check />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
