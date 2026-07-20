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

function DimensionRow({ name, dim }: { name: string; dim: Dimension }) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between gap-4">
        <Label>{name}</Label>
        <span className="flex items-center gap-3">
          <GradeMeter score={dim.score} />
          <span className="w-24 text-right text-[13px] text-ink">
            {dim.score}
          </span>
        </span>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-ink-2">
        {dim.assessment}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
        <span className="text-ink-2">Fix</span> — {dim.advice}
      </p>
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

export function Scorecard({ result }: { result: EvaluationResult }) {
  const dims: Dimension[] = toDimensionList(result.evaluation.scorecard);
  const frameworkName = result.evaluation.framework?.name;
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      {frameworkName && (
        <div className="border-b border-line px-6 py-3">
          <Label>{frameworkName}</Label>
        </div>
      )}
      <div className="divide-y divide-line">
        {dims.map((dim) => (
          <DimensionRow key={dim.key} name={dim.name} dim={dim} />
        ))}
      </div>
      <div className="border-t border-line bg-raised px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <Label>Overall</Label>
          <span className="flex items-center gap-3">
            <GradeMeter score={result.overall_score} />
            <span className="w-24 text-right text-[13px] font-medium text-ink">
              {result.overall_score}
            </span>
          </span>
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-2">
          <span className="text-ink">Priority fix</span> —{" "}
          {result.evaluation.priority_fix}
        </p>
      </div>
    </section>
  );
}
