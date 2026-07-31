"use client";

import { useEffect, useState } from "react";

// Bridges the gap before the first streamed dimension lands — usually a second or two, since
// the response now renders as it is written. Deliberately framework-agnostic: the old copy
// named the Anthropic rubric's dimensions ("Scoring clarity…") and lied on every other
// framework. Real per-dimension progress is the streamed scorecard itself, not this.
const STEPS = ["Reading your prompt…", "Scoring…", "Almost there…"];

function Row({ wide }: { wide?: boolean }) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between gap-4">
        <span className="skeleton h-2.5 w-20" />
        <span className="skeleton h-2.5 w-36" />
      </div>
      <span className={`skeleton mt-4 block h-2.5 ${wide ? "w-full" : "w-4/5"}`} />
      <span className="skeleton mt-2.5 block h-2.5 w-3/5" />
    </div>
  );
}

export function EvaluatingState() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      3200,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className="animate-rise mt-8 space-y-4" aria-live="polite">
      <p className="flex items-center justify-center gap-2.5 text-sm text-ink-2">
        <span className="size-2 animate-pulse rotate-45 rounded-[1px] bg-ember" />
        <span key={step} className="animate-fade">
          {STEPS[step]}
        </span>
      </p>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="divide-y divide-line">
          <Row wide />
          <Row />
          <Row wide />
          <Row />
        </div>
        <div className="border-t border-line bg-raised px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <span className="skeleton h-2.5 w-16" />
            <span className="skeleton h-2.5 w-36" />
          </div>
          <span className="skeleton mt-4 block h-2.5 w-3/4" />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-6 py-4">
          <span className="skeleton block h-2.5 w-28" />
        </div>
        <div className="space-y-2.5 px-6 py-5">
          <span className="skeleton block h-2.5 w-full" />
          <span className="skeleton block h-2.5 w-11/12" />
          <span className="skeleton block h-2.5 w-full" />
          <span className="skeleton block h-2.5 w-2/3" />
        </div>
      </section>
    </div>
  );
}
