// Prompt frameworks the evaluator can score against. Each framework defines its own set of
// dimensions (the rubric), the knowledge-base guidance fed to Claude, and which dimensions are
// "required" (a Poor there caps the overall score). The engine builds a framework-specific
// system prompt and output schema from these definitions, so adding a framework is data-only —
// no changes to engine.ts, scoring.ts, or the UI.
import * as z from "zod/v4";
import { DimensionResultSchema, EVALUATION_SCALAR_FIELDS } from "./schema";

export interface FrameworkDimension {
  /** Stable id; also the object key the model returns this dimension's judgement under. */
  key: string;
  /** Display label, e.g. "Context". */
  name: string;
  /** Short question that frames what this dimension checks, shown in the prompt header. */
  question: string;
  /** Knowledge-base guidance for the model: what "good" looks like for this dimension. */
  guidance: string;
  /** Required dimensions must hold for a strong prompt; a Poor here caps the overall score. */
  required?: boolean;
}

export interface Framework {
  id: string;
  /** Display name shown in the selector and on the scorecard. */
  name: string;
  /** One-line description shown under the selector. */
  tagline: string;
  /** One or two sentences orienting the model to the framework, injected into the prompt. */
  intro: string;
  dimensions: FrameworkDimension[];
}

// ── Framework definitions ────────────────────────────────────────────────────────────────

// The original PromptForge rubric (Anthropic prompt-engineering best practices). Kept verbatim
// so behaviour is unchanged when this — the default — framework is selected.
const ANTHROPIC: Framework = {
  id: "anthropic",
  name: "Anthropic Best Practices",
  tagline: "Clarity, guidelines, structure, examples — the default general-purpose rubric.",
  intro:
    "You evaluate the draft against Anthropic's prompt-engineering best practices, then rewrite it.",
  dimensions: [
    {
      key: "clarity",
      name: "Clarity",
      question: "Is the prompt clear and direct?",
      required: true,
      guidance: `A clear and direct prompt tells the model exactly what is wanted — the task, the
context, the format, and any constraints — with no ambiguity or room for
misinterpretation. It removes guesswork by specifying the goal, audience, tone, and
expected output structure.
Key ingredients: task (what to do), context (background or input), format (how to
structure output), constraints (length, tone, audience).
Bad example: "Write something about climate change."
Good example: "Write a 3-paragraph explainer on the economic costs of climate change
for a non-technical audience. Use a neutral, factual tone. End with one concrete
statistic."`,
    },
    {
      key: "guidelines",
      name: "Guidelines",
      question: "Does the prompt include steps or rules when needed?",
      required: true,
      guidance: `Guidelines are explicit instructions that constrain how the model should approach or
execute a task — not just what to produce, but how to produce it. They are needed
when: the task has multiple sub-tasks in a specific order, quality criteria must be
met, there is risk of output drift, or the workflow needs to be repeatable.
Bad example: "Analyze this user interview transcript."
Good example: "Analyze this user interview transcript. Follow these steps: 1. Identify
the top 3 pain points. 2. Note any implied unmet needs. 3. Flag quotable quotes. 4.
Rate overall sentiment: Positive / Neutral / Negative. 5. Output each section with a
bold header."`,
    },
    {
      key: "structure",
      name: "Structure",
      question: "Does the prompt use XML tags when appropriate?",
      guidance: `XML tags wrap different parts of a prompt (context, task, data, examples) into clearly
labeled sections. They are appropriate when the prompt has multiple distinct
components, long or complex inputs, conditional logic, or is a reusable template. For
short single-task prompts, XML is unnecessary overhead.
Good example:
<role>You are a policy analyst writing for a non-technical audience.</role>
<document>[paste document here]</document>
<task>Summarize in 3 bullet points. Focus on impact to small businesses.</task>
<constraints>Max 100 words. Avoid legal jargon.</constraints>`,
    },
    {
      key: "examples",
      name: "Examples",
      question: "Does the prompt include examples when needed?",
      guidance: `Examples act as behavioral anchors — they show the model what "correct" looks like.
Use examples when: the task has a specific style or voice hard to define abstractly,
the output format is non-standard, the task involves judgment calls (classification,
scoring, labeling), or consistency across runs matters. Do not use examples when the
task is simple and unambiguous.`,
    },
  ],
};

// CO-STAR: a popular six-part structuring framework for well-rounded, on-brand outputs.
const COSTAR: Framework = {
  id: "costar",
  name: "CO-STAR",
  tagline: "Context, Objective, Style, Tone, Audience, Response — balanced, on-brand outputs.",
  intro:
    "You evaluate the draft using the CO-STAR framework (Context, Objective, Style, Tone, Audience, Response), then rewrite it to satisfy all six.",
  dimensions: [
    {
      key: "context",
      name: "Context",
      question: "Does the prompt supply the background the model needs?",
      required: true,
      guidance: `Context is the background information that situates the task: what's going on, relevant
facts, the input to operate on, and any prior state. Without it the model guesses.
Bad: "Write a launch email." Good: "We're a 5-person B2B analytics startup launching a
free tier of our dashboard next Tuesday to our existing waitlist of 2,000 users."`,
    },
    {
      key: "objective",
      name: "Objective",
      question: "Is the exact task and goal stated unambiguously?",
      required: true,
      guidance: `The objective is the single, explicit task the model must accomplish — the "what" and
the success criterion. It should be unambiguous and action-oriented.
Bad: "Help with the email." Good: "Write the launch email; the goal is to drive
free-tier signups, so lead with the value and end with one clear call to action."`,
    },
    {
      key: "style",
      name: "Style",
      question: "Is the writing style or format specified?",
      guidance: `Style is the manner of writing: the format, structure, and craft to emulate (e.g.
journalistic, technical, persuasive, the style of a specific author or brand).
Specify it when the shape of the output matters; omit it for trivial tasks.`,
    },
    {
      key: "tone",
      name: "Tone",
      question: "Is the emotional register / voice defined?",
      guidance: `Tone is the attitude and emotional register — formal, playful, empathetic, urgent,
authoritative. It shapes how the audience feels. Define it when voice matters to the
outcome; a mismatched tone undermines otherwise-correct content.`,
    },
    {
      key: "audience",
      name: "Audience",
      question: "Is the intended reader identified?",
      guidance: `Audience is who the output is for — their expertise, role, and expectations. Naming the
audience lets the model calibrate vocabulary, depth, and framing.
Bad: unstated. Good: "for non-technical small-business owners with no analytics
background."`,
    },
    {
      key: "response",
      name: "Response",
      question: "Is the required output format/structure specified?",
      guidance: `Response format is the concrete shape of the deliverable: length, structure, medium,
schema (e.g. "3 bullets, max 100 words", "valid JSON with keys x/y/z", "a subject line
plus body"). Specify it whenever a particular structure is expected downstream.`,
    },
  ],
};

// RTF / RISEN: a lightweight, task-and-role oriented framework. Modeled on RISEN
// (Role, Instructions, Steps, End goal, Narrowing), which subsumes RTF's Role/Task/Format.
const RTF_RISEN: Framework = {
  id: "rtf_risen",
  name: "RTF / RISEN",
  tagline: "Role, Instructions, Steps, End goal, Narrowing — lightweight and task-focused.",
  intro:
    "You evaluate the draft using the RTF/RISEN framework (Role, Instructions, Steps, End goal, Narrowing), then rewrite it to satisfy each part.",
  dimensions: [
    {
      key: "role",
      name: "Role",
      question: "Does the prompt assign the model a clear role or persona?",
      required: true,
      guidance: `Role sets the persona and expertise the model should adopt ("You are a senior tax
accountant…"). A well-chosen role primes domain knowledge, vocabulary, and standards.
Bad: no role. Good: "You are an experienced technical recruiter screening backend
engineers."`,
    },
    {
      key: "instructions",
      name: "Instructions",
      question: "Is the core task stated as a clear instruction?",
      required: true,
      guidance: `Instructions state the actual task directly and imperatively — what to do with the
input. This is the RTF "Task": one unambiguous directive, not a vague topic.
Bad: "thoughts on this resume?" Good: "Screen this resume against the job description
and decide advance / reject."`,
    },
    {
      key: "steps",
      name: "Steps",
      question: "Does the prompt break the task into ordered steps when useful?",
      guidance: `Steps decompose a multi-part task into an explicit, ordered procedure. They matter when
order or completeness affects quality; a single simple task may not need them.
Good: "1) Extract required skills. 2) Match against the resume. 3) List gaps. 4) Give a
verdict with one-line justification."`,
    },
    {
      key: "end_goal",
      name: "End goal",
      question: "Is the desired end result / format made explicit?",
      guidance: `The end goal names the concrete outcome and its format — what a successful result looks
like (a decision, a document, a structured list). This is RTF's "Format" plus intent.
Good: "Output: ADVANCE or REJECT, followed by 3 bullet reasons."`,
    },
    {
      key: "narrowing",
      name: "Narrowing",
      question: "Are scope, constraints, and boundaries set?",
      guidance: `Narrowing constrains the response: scope limits, what to include or exclude, length,
edge-case handling, and things to avoid. It keeps the output focused and prevents
drift. Good: "Judge only on backend skills; ignore formatting and typos. Keep under
120 words."`,
    },
  ],
};

// CRISPE: a persona-driven framework that also asks for alternatives/experimentation.
const CRISPE: Framework = {
  id: "crispe",
  name: "CRISPE",
  tagline: "Capacity, Insight, Statement, Personality, Experiment — persona-driven prompting.",
  intro:
    "You evaluate the draft using the CRISPE framework (Capacity/Role, Insight, Statement, Personality, Experiment), then rewrite it to satisfy each part.",
  dimensions: [
    {
      key: "capacity_role",
      name: "Capacity & Role",
      question: "Does the prompt define the model's role and expertise?",
      required: true,
      guidance: `Capacity & Role is the expert capacity the model should act in — its profession, seniority,
and domain ("Act as a senior UX researcher"). It anchors the depth and standards of the
response. Bad: unstated. Good: "Act as a seasoned startup CFO."`,
    },
    {
      key: "insight",
      name: "Insight",
      question: "Does the prompt provide the background/context to reason from?",
      guidance: `Insight is the context and background the model needs: the situation, constraints, and
relevant facts that inform a good answer. It's the "why" and "given what" behind the
request. Good: "We have 9 months of runway and are deciding whether to raise now."`,
    },
    {
      key: "statement",
      name: "Statement",
      question: "Is there a clear statement of exactly what to do?",
      required: true,
      guidance: `The Statement is the explicit request — the single clear instruction of what you want the
model to do. It should be specific and unambiguous.
Bad: "advice on fundraising?" Good: "Recommend whether to raise a bridge round now or
cut burn, and justify it."`,
    },
    {
      key: "personality",
      name: "Personality",
      question: "Is the desired style, tone, or voice specified?",
      guidance: `Personality is the style, tone, and manner of the response — the voice to adopt (concise
and blunt, warm and encouraging, formal). Define it when voice affects usefulness.
Good: "Be direct and numbers-first; skip pleasantries."`,
    },
    {
      key: "experiment",
      name: "Experiment",
      question: "Does the prompt invite multiple options or alternatives?",
      guidance: `Experiment asks the model to offer several approaches, variations, or perspectives rather
than a single answer — useful when exploring a decision space. Use it when alternatives
add value; skip it when one precise answer is wanted.
Good: "Give two contrasting recommendations with the trade-offs of each."`,
    },
  ],
};

// Chain-of-Thought: reasoning-first framework for tasks that need explicit thinking.
const COT: Framework = {
  id: "cot",
  name: "Chain-of-Thought",
  tagline: "Task framing, decomposition, reasoning, worked examples — for hard reasoning tasks.",
  intro:
    "You evaluate the draft as a reasoning (chain-of-thought) prompt: does it elicit explicit, step-by-step thinking before the answer? Then rewrite it to do so.",
  dimensions: [
    {
      key: "task_framing",
      name: "Task framing",
      question: "Is the reasoning task and its inputs clearly framed?",
      required: true,
      guidance: `Task framing states the problem to reason about and supplies the inputs/constraints, so
the model knows exactly what it is solving. Bad: "Is this a good investment?" Good:
"Given the financials below, decide whether the unit economics are sustainable at
current CAC."`,
    },
    {
      key: "decomposition",
      name: "Decomposition",
      question: "Does the prompt ask the model to break the problem into steps?",
      required: true,
      guidance: `Decomposition instructs the model to break the problem into sub-steps and work through
them in order rather than jumping to an answer. This is the core of chain-of-thought.
Good: "Work through it step by step: first compute X, then Y, then conclude."`,
    },
    {
      key: "reasoning_guidance",
      name: "Reasoning guidance",
      question: "Does it tell the model to show its reasoning before answering?",
      guidance: `Reasoning guidance directs the model to make its thinking explicit and to reason before
committing to a final answer — e.g. "think through the trade-offs before deciding", or
reasoning inside <thinking> tags. It reduces jumped-to, unjustified conclusions.`,
    },
    {
      key: "worked_examples",
      name: "Worked examples",
      question: "Are step-by-step worked examples provided where they'd help?",
      guidance: `Worked examples demonstrate the desired reasoning pattern on a sample input (few-shot
chain-of-thought). They anchor how thorough and in what shape the reasoning should be.
Provide them for unusual or high-stakes reasoning; skip for simple, standard tasks.`,
    },
    {
      key: "output_format",
      name: "Output format",
      question: "Is the final answer's format separated from the reasoning?",
      guidance: `Output format specifies how the final answer is delivered and, importantly, keeps it
distinct from the reasoning (e.g. "reason first, then give the answer on a line starting
with 'Answer:'"). This makes the conclusion easy to extract.`,
    },
  ],
};

export const FRAMEWORKS: Framework[] = [ANTHROPIC, COSTAR, RTF_RISEN, CRISPE, COT];

export const DEFAULT_FRAMEWORK_ID = ANTHROPIC.id;

/** Look up a framework by id, falling back to the default for unknown/absent ids. */
export function getFramework(id?: string | null): Framework {
  return FRAMEWORKS.find((f) => f.id === id) ?? ANTHROPIC;
}

/** Keys of the framework's required dimensions (a Poor there caps the overall score). */
export function requiredKeys(framework: Framework): string[] {
  return framework.dimensions.filter((d) => d.required).map((d) => d.key);
}

// ── Prompt + schema builders ─────────────────────────────────────────────────────────────

/** Build the framework-specific system prompt: knowledge base + scoring rules. */
export function buildSystemPrompt(framework: Framework): string {
  const required = framework.dimensions.filter((d) => d.required).map((d) => d.name);
  const conditional = framework.dimensions.filter((d) => !d.required).map((d) => d.name);

  const knowledgeBase = framework.dimensions
    .map(
      (d, i) =>
        `DIMENSION ${i + 1} — ${d.name.toUpperCase()} (${d.question})\n${d.guidance}`,
    )
    .join("\n\n");

  const requiredLine = required.length
    ? `The required dimensions (${required.join(", ")}) must be satisfied for a strong prompt.`
    : "";
  const conditionalLine = conditional.length
    ? `The remaining dimensions (${conditional.join(", ")}) are CONDITIONAL — they apply only
when the task calls for them. If a conditional dimension is genuinely not needed for
this task and is correctly absent, score it Good or Excellent — do not penalize a prompt
for omitting what it doesn't need.`
    : "";

  return `You are PromptForge, an expert prompt engineer. ${framework.intro} You score the draft
across ${framework.dimensions.length} dimensions of the ${framework.name} framework, then rewrite it
into a sharper, ready-to-use prompt.

<knowledge_base>

${knowledgeBase}

</knowledge_base>

<scoring_rules>
Score each dimension on this 4-point scale: Poor, Needs Work, Good, Excellent.

${requiredLine}
${conditionalLine}

Reward fit, not length. A simple, unambiguous prompt that correctly omits what it doesn't
need should still score well.

For each dimension, provide:
- score: one of Poor / Needs Work / Good / Excellent
- assessment: 1-2 sentences explaining why you gave that score
- advice: one specific, actionable improvement

Then provide:
- prompt_evaluated: repeat the user's original prompt verbatim.
- priority_fix: the single most impactful change the user should make first (1-2 sentences).
- revised_prompt: the full rewritten prompt that incorporates every improvement, ready to use
  as-is, satisfying the ${framework.name} framework. Do NOT pad it — omit anything the task
  genuinely doesn't need. Output the rewritten prompt only; do not describe the changes inside it.
- suggested_title: a short descriptive title (3-6 words) naming what the prompt does.
- suggested_category: a single short category for filing this prompt (e.g. Coding, Writing,
  Research, Analysis, Ops).
- suggested_tags: 2-5 short lowercase tags useful for later search.
</scoring_rules>

The prompt to evaluate is provided in the next (user) message.`;
}

/**
 * Build the framework-specific output schema: the shared scalar fields plus a `scorecard`
 * object whose keys are exactly this framework's dimension keys. The model is forced to judge
 * every dimension and nothing else.
 */
export function buildEvaluationSchema(framework: Framework) {
  const scorecardShape: Record<string, typeof DimensionResultSchema> = {};
  for (const d of framework.dimensions) scorecardShape[d.key] = DimensionResultSchema;
  return z.object({
    ...EVALUATION_SCALAR_FIELDS,
    scorecard: z.object(scorecardShape),
  });
}
