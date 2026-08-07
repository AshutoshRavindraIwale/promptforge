"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// First-run feature tour: spotlights one element per step (via its data-tour attribute) and
// pins an explainer card next to it. Homegrown rather than a tour library on purpose — the
// libraries are heavy, inject styles that fight the CSP, and this needs exactly four stops.
//
// Mechanics: a fixed backdrop dims the page and swallows clicks (click = next); the spotlight
// is a fixed div whose giant box-shadow does the dimming *around* the target, so the target
// itself stays at full brightness; the card measures itself and flips above the target when
// there's no room below.

export interface TourStep {
  /** Matches the element carrying data-tour="<target>". */
  target: string;
  title: string;
  body: string;
}

const SPOT_PAD = 8; // breathing room between the target and the spotlight edge
const CARD_GAP = 12; // gap between the spotlight and the card
const CARD_W = 300;
const EDGE = 12; // minimum distance from the viewport edge

export function Tour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [spot, setSpot] = useState<DOMRect | null>(null);
  const [card, setCard] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const step = steps[i];
  const last = i === steps.length - 1;

  const advance = useCallback(() => {
    if (i < steps.length - 1) setI(i + 1);
    else onClose();
  }, [i, steps.length, onClose]);

  // Locate the current step's target. A missing target (responsive-hidden, different view)
  // skips forward rather than stranding the tour on a spotlight around nothing.
  const measure = useCallback(() => {
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      setSpot(null);
      return false;
    }
    el.scrollIntoView({ block: "nearest" });
    setSpot(el.getBoundingClientRect());
    return true;
  }, [step.target]);

  // The initial measure runs in a rAF callback (nothing paints until the rect lands, since
  // the component returns null without one); resize/scroll re-measures are event-driven.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (!measure()) advance();
      else nextRef.current?.focus();
    });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, advance]);

  // Place the card once its real height is known: below the spotlight when it fits,
  // above otherwise, clamped inside the viewport either way.
  useLayoutEffect(() => {
    if (!spot || !cardRef.current) return;
    const h = cardRef.current.offsetHeight;
    const below = spot.bottom + SPOT_PAD + CARD_GAP;
    const top =
      below + h + EDGE <= window.innerHeight
        ? below
        : Math.max(EDGE, spot.top - SPOT_PAD - CARD_GAP - h);
    const left = Math.min(
      Math.max(EDGE, spot.left),
      window.innerWidth - CARD_W - EDGE,
    );
    setCard({ top, left });
  }, [spot, i]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "Enter") advance();
      else if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [advance, onClose, i]);

  if (!spot) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Feature tour">
      {/* Click-catcher: keeps the page inert while the tour runs; a click moves it along. */}
      <div className="absolute inset-0" onClick={advance} />

      {/* Spotlight — the box-shadow is the backdrop, so the target keeps full brightness. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-2xl border border-ember/60 transition-all duration-300 motion-reduce:transition-none"
        style={{
          top: spot.top - SPOT_PAD,
          left: spot.left - SPOT_PAD,
          width: spot.width + SPOT_PAD * 2,
          height: spot.height + SPOT_PAD * 2,
          boxShadow: "0 0 0 9999px rgba(12, 11, 9, 0.72)",
        }}
      />

      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="fixed rounded-2xl border border-line bg-surface p-4 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
        style={{
          width: CARD_W,
          top: card?.top ?? -9999,
          left: card?.left ?? -9999,
          visibility: card ? "visible" : "hidden",
        }}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ember">
          {i + 1} of {steps.length}
        </p>
        <h2 className="mt-1.5 text-sm font-medium text-ink">{step.title}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="rounded-full px-2 py-1.5 text-xs text-ink-3 transition-colors hover:text-ink"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                onClick={() => setI(i - 1)}
                className="rounded-full border border-line px-3.5 py-1.5 text-xs text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
              >
                Back
              </button>
            )}
            <button
              ref={nextRef}
              onClick={advance}
              className="rounded-full bg-ember px-4 py-1.5 text-xs font-medium text-bg transition hover:brightness-110"
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
