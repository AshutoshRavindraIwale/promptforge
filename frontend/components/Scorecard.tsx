import type {
  Dimension,
  EvaluationResult,
  Score,
  Scorecard as ScorecardType,
} from "@/lib/schema";

const BADGE: Record<Score, string> = {
  Poor: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  "Needs Work": "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  Good: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  Excellent: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};

export function ScoreBadge({ score, size = "sm" }: { score: Score; size?: "sm" | "lg" }) {
  const sizing = size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${sizing} ${BADGE[score]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {score}
    </span>
  );
}

function DimensionCard({
  index,
  name,
  dim,
}: {
  index: number;
  name: string;
  dim: Dimension;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-widest text-slate-400">
          {index}. {name.toUpperCase()}
        </h3>
        <ScoreBadge score={dim.score} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{dim.assessment}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        <span className="font-medium text-violet-300">Fix:</span> {dim.advice}
      </p>
    </div>
  );
}

export function Scorecard({ result }: { result: EvaluationResult }) {
  const sc: ScorecardType = result.evaluation.scorecard;
  const dims: [string, Dimension][] = [
    ["Clarity", sc.clarity],
    ["Guidelines", sc.guidelines],
    ["Structure", sc.structure],
    ["Examples", sc.examples],
  ];
  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {dims.map(([name, dim], i) => (
          <DimensionCard key={name} index={i + 1} name={name} dim={dim} />
        ))}
      </div>
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold tracking-widest text-slate-400">
            OVERALL
          </span>
          <ScoreBadge score={result.overall_score} size="lg" />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-200">
          <span className="font-medium text-violet-300">Priority fix:</span>{" "}
          {result.evaluation.priority_fix}
        </p>
      </div>
    </section>
  );
}
