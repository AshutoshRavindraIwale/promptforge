"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Shared modal shell: backdrop + centered panel, with the keyboard-accessibility the app's
// three dialogs were missing — role="dialog"/aria-modal, Escape to close, focus trapped inside
// the panel while open, and focus restored to the triggering element on close.
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  onClose,
  className,
  labelledBy,
  label,
  children,
}: {
  onClose: () => void;
  /** Styling for the panel itself (max-width, layout, surface, shadow…). */
  className?: string;
  /** id of the heading that names the dialog; prefer this over `label`. */
  labelledBy?: string;
  /** Accessible name when there is no visible heading to point at. */
  label?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    // Move focus into the dialog on open (first focusable, or the panel itself).
    const initial = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (initial ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={className}
      >
        {children}
      </div>
    </div>
  );
}
