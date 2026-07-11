// Typed contract for an evaluation, mirroring promptforge/schema.py (Python CLI).
// Uses `zod/v4` so the schema is the exact module @anthropic-ai/sdk's zodOutputFormat
// expects. `overall_score` is computed server-side (scoring.ts), never from the model.
import * as z from "zod/v4";

export const SCORES = ["Poor", "Needs Work", "Good", "Excellent"] as const;
export const ScoreSchema = z.enum(SCORES);
export type Score = (typeof SCORES)[number];

export const DimensionSchema = z.object({
  score: ScoreSchema.describe("Poor / Needs Work / Good / Excellent"),
  assessment: z.string().describe("1-2 sentences explaining the score"),
  advice: z.string().describe("one specific, actionable improvement"),
});

export const ScorecardSchema = z.object({
  clarity: DimensionSchema,
  guidelines: DimensionSchema,
  structure: DimensionSchema,
  examples: DimensionSchema,
});

export const EvaluationSchema = z.object({
  prompt_evaluated: z.string().describe("the user's original prompt, verbatim"),
  scorecard: ScorecardSchema,
  priority_fix: z.string().describe("the single most impactful change to make first"),
  revised_prompt: z.string().describe("the full rewritten prompt, ready to use"),
  suggested_title: z
    .string()
    .describe("a short 3-6 word descriptive title naming what the prompt does"),
  suggested_category: z.string().describe("a single short category for filing"),
  suggested_tags: z.array(z.string()).describe("2-5 short lowercase tags for search"),
});

export type Dimension = z.infer<typeof DimensionSchema>;
export type Scorecard = z.infer<typeof ScorecardSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;

export type EvaluationResult = {
  evaluation: Evaluation;
  overall_score: Score;
};
