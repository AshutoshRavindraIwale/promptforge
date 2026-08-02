"use client";

import { useState } from "react";
import type { Dimension, EvaluationResult, Score } from "@/lib/schema";

const GRADES: Score[] = ["Poor", "Needs Work", "Good", "Excellent"];

const TONE: Record<Score, string> = {
  Poor: "var(--color-grade-poor)",
  "Needs Work": "var(--color-grade-fair)",
  Good: "var(--color-grade-good)",
  Excellent: "var(--color-grade-excellent)",
};

/** Four-segment meter: filled to the grade's level, tinted by grade. */
export function GradeMeter({ score }: { score: Score }) {
  const level = GRADES.indexOf(score) + 1;
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {GRADES.map((_, i) => (
        <span
          key={i}
          className="h-[3px] w-5 rounded-full transition-colors"
          style={{
            background: i < level ? TONE[score] : "rgba(255,255,255,0.09)",
          }}
        />
      ))}
    </span>
  );
}

export function ScoreBadge({ score }: { score: Score }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span
        className="size-1.5 rounded-full"
        style={{ background: TONE[score] }}
      />
      {score}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
      {children}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * One dimension, collapsed to a single line — name, meter, grade. The row itself is the
 * disclosure: clicking it reveals the assessment and fix. The verdict answers "how good is
 * it?" at a glance; this keeps "why?" one click away instead of seven paragraphs tall.
 */
function DimensionRow({
  name,
  dim,
  open,
  onToggle,
}: {
  name: string;
  dim: Dimension;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-raised/60"
      >
        <Label>{name}</Label>
        <span className="flex items-center gap-3">
          <GradeMeter score={dim.score} />
          <span className="w-24 text-right text-[13px] text-ink">
            {dim.score}
          </span>
          <Chevron open={open} />
        </span>
      </button>
      {open && (
        <div className="animate-fade px-6 pb-5">
          <p className="text-sm leading-relaxed text-ink-2">{dim.assessment}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
            <span className="text-ink-2">Fix</span> — {dim.advice}
          </p>
        </div>
      )}
    </div>
  );
}

// Legacy runs (pre-frameworks) stored the scorecard as a fixed {clarity,…} object rather than
// an ordered list. Normalize both shapes so the card renders either.
const LEGACY_NAMES: Record<string, string> = {
  clarity: "Clarity",
  guidelines: "Guidelines",
  structure: "Structure",
  examples: "Examples",
};

function toDimensionList(scorecard: unknown): Dimension[] {
  if (Array.isArray(scorecard)) return scorecard as Dimension[];
  if (scorecard && typeof scorecard === "object") {
    return Object.entries(scorecard as Record<string, Omit<Dimension, "key" | "name">>).map(
      ([key, dim]) => ({ key, name: LEGACY_NAMES[key] ?? key, ...dim }),
    );
  }
  return [];
}

/**
 * What the card needs to render. Widened from `EvaluationResult` so the same component can
 * show a half-streamed evaluation: while the model is still writing, dimension rows arrive one
 * at a time and `overall_score` (computed server-side once every dimension is in) isn't known
 * yet, so the Overall footer is simply withheld until it is.
 */
type ScorecardView = {
  evaluation: {
    scorecard: EvaluationResult["evaluation"]["scorecard"];
    priority_fix?: string;
    framework?: { id: string; name: string };
  };
  overall_score?: Score;
};

export function Scorecard({ result }: { result: ScorecardView }) {
  const dims: Dimension[] = toDimensionList(result.evaluation.scorecard);
  const frameworkName = result.evaluation.framework?.name;
  const overall = result.overall_score;

  // Which dimensions are expanded. Survives streaming re-renders, so a row a user opens
  // while the model is still writing stays open as later rows arrive.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const allOpen = dims.length > 0 && dims.every((d) => openKeys.has(d.key));

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Verdict first: the reader's question is "how bad is it?", so the overall grade and
          priority fix lead the card instead of trailing 4-7 dimension rows. The overall score
          streams in last (computed server-side once every dimension is in), so until it lands
          this header doubles as the streaming progress indicator — and its fill-in is the
          visible finish line. */}
      <div className="border-b border-line bg-raised px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <Label>{frameworkName ?? "Evaluation"}</Label>
          {overall ? (
            <GradeMeter score={overall} />
          ) : (
            <span className="skeleton h-[3px] w-[92px]" aria-hidden />
          )}
        </div>
        {overall ? (
          <p className="mt-2 flex items-center gap-2.5 text-[20px] font-medium tracking-[-0.01em] text-ink">
            <span
              className="size-2 rounded-full"
              style={{ background: TONE[overall] }}
              aria-hidden
            />
            {overall}
          </p>
        ) : (
          <p className="mt-2 text-[20px] font-medium tracking-[-0.01em] text-ink-3">
            Scoring…
          </p>
        )}
        {overall && result.evaluation.priority_fix && (
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            <span className="text-ink">Priority fix</span> —{" "}
            {result.evaluation.priority_fix}
          </p>
        )}
      </div>
      <div className="divide-y divide-line">
        {dims.map((dim) => (
          <DimensionRow
            key={dim.key}
            name={dim.name}
            dim={dim}
            open={openKeys.has(dim.key)}
            onToggle={() => toggle(dim.key)}
          />
        ))}
      </div>
      {dims.length > 1 && (
        <div className="border-t border-line px-6 py-2.5 text-right">
          <button
            type="button"
            onClick={() =>
              setOpenKeys(allOpen ? new Set() : new Set(dims.map((d) => d.key)))
            }
            className="text-xs text-ink-3 transition-colors hover:text-ink"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}
    </section>
  );
}
