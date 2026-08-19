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
  /**
   * Medium the refined prompt targets. Absent means "text" (a chat LLM), so the existing
   * frameworks need no annotation. Video and image frameworks hide the text-only affordances —
   * notably Test, which runs the prompt through a text model and would just describe a
   * hypothetical clip or picture. Agent frameworks target agent artifacts (system prompts, task
   * briefs, tool docs); the suggest classifier uses this to hint at their purpose.
   */
  kind?: "text" | "video" | "image" | "agent";
  /**
   * How the refined prompt is meant to be executed. Absent means it is a normal user-turn chat
   * prompt (current behavior everywhere). "system" means it is a system prompt — Test must send
   * it as the system role with a sample user message, never as a bare user turn. "none" means it
   * is not directly runnable (a tool description lives in a schema, not a chat box), so Test and
   * the provider handoff are hidden.
   */
  runsAs?: "system" | "none";
  /**
   * Category examples offered to the model for `suggested_category`. Absent falls back to the
   * text-prompt list, so a video prompt isn't filed under "Coding" or "Research".
   */
  categories?: string[];
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

// ── Healthcare ───────────────────────────────────────────────────────────────────────────
//
// Health prompts carry a cost the other rubrics don't have to price in: a fluent, confident,
// wrong answer about a dose or a symptom can do real harm. So the safety dimensions here are
// REQUIRED — a draft that names no audience, sets no boundaries, or grounds nothing in a source
// cannot score well however clear its prose is. The rubric is meant to work as a guardrail, not
// just a grade.
//
// One framework covers both clinician-facing and patient-facing work rather than two. The two
// audiences pull in opposite directions (terminology precision vs. plain language), but that
// tension belongs inside the per-dimension guidance — and declaring which one you are writing
// for is itself the first thing a good health prompt does.

const HEALTHCARE: Framework = {
  id: "healthcare",
  name: "Healthcare",
  tagline:
    "Audience, safety boundaries, evidence grounding — for clinical and patient-facing prompts.",
  intro:
    "You evaluate the draft as a healthcare prompt — clinical documentation, patient communication, or health education — then rewrite it. Hold the rewrite to a clinical-safety bar: it must name its audience, state what the model may not do, and ground its claims in a source. What such a prompt produces is always a draft for a qualified human to review, never a final clinical answer; where a reader could mistake it for one, the rewrite should say so.",
  categories: [
    "Clinical Documentation",
    "Patient Education",
    "Care Coordination",
    "Medical Research",
    "Health Admin",
  ],
  dimensions: [
    {
      key: "clinical_task",
      name: "Task & Audience",
      question: "Is the deliverable named, and is it clear who reads it?",
      required: true,
      guidance: `A health prompt has to say what it produces and who receives it — a clinician, a patient,
a caregiver, or an administrator. Audience is the highest-leverage element here because it
silently sets everything downstream: terminology, reading level, how much hedging is
appropriate, what can be assumed as known. "Explain hypertension" is three different
documents depending on who asked. Name the artifact too — a SOAP note, a discharge summary,
a pre-op instruction sheet, a letter to a referring physician.
Bad example: "Explain type 2 diabetes management."
Good example: "Write a one-page handout for a newly diagnosed type 2 diabetes patient with
no medical background: what the diagnosis means, the lifestyle changes with the strongest
evidence behind them, and when to call the clinic."`,
    },
    {
      key: "safety_boundaries",
      name: "Safety Boundaries",
      question: "Does it state what the model must not do, and where to route instead?",
      required: true,
      guidance: `Boundaries state what the model must NOT do and what happens at the edge of its
competence: no diagnosis, no dosing or medication changes, no standing in for the treating
clinician's judgement. Pair every prohibition with the action that replaces it — where the
reader goes instead — or the model just refuses unhelpfully. Red-flag handling belongs here
too: the symptoms that mean stop reading and seek urgent care. A fluent, confident, wrong
answer is the failure this dimension exists to prevent, and "be careful, this is medical"
prevents nothing.
Bad example: "Be accurate and careful since this is health related."
Good example: "Do not diagnose or recommend specific doses. Describe treatment categories
in general terms and send the reader to their prescriber for anything specific. If the
symptoms described include chest pain, one-sided weakness, or trouble breathing, open by
telling them to seek emergency care now."`,
    },
    {
      key: "evidence_grounding",
      name: "Evidence & Grounding",
      question: "Is it clear where facts may come from, and what to do at the limit?",
      required: true,
      guidance: `Grounding tells the model which sources it may draw on — only the chart or documents
supplied, a named guideline or formulary, or clearly-labelled general knowledge — and what
to do when it runs out: flag the uncertainty, say "not in the record", ask rather than fill
the gap. Fabricated doses, invented interactions, and confidently misremembered guideline
thresholds are the concrete harms, and they arrive reading exactly as fluently as the
correct ones. An ungrounded health prompt is an invitation to produce them.
Bad example: "Summarize the latest evidence on statin therapy."
Good example: "Base the summary only on the three trial abstracts below. Where they
disagree, say so rather than reconciling them. If a question cannot be answered from these
sources, write 'not addressed in the provided evidence' — do not answer it from general
knowledge."`,
    },
    {
      key: "phi_handling",
      name: "Privacy & PHI",
      question: "Is the handling of patient identifiers specified?",
      guidance: `Where real patient data is in play, the prompt should say how identifiers are handled:
that the input is de-identified, that the output must not echo names, dates of birth, or
record numbers, and what to do if identifiers turn up anyway. CONDITIONAL — a general
explainer or a literature summary touches no patient data, and its silence here is correct.
Good example: "The note below is de-identified. Refer to the subject as 'the patient'
throughout. If any name, date of birth, address, or MRN appears in the input, leave it out
of your output rather than reproducing it."`,
    },
    {
      key: "clinical_context",
      name: "Clinical Context",
      question: "Is the population, setting, and relevant history supplied?",
      guidance: `Clinical context is the situation the output has to fit: population and age band,
relevant comorbidities and current medications, the care setting (emergency department,
primary care, inpatient, telehealth, community pharmacy), and where in the care pathway
this sits. The same question has different right answers for a paediatric patient and a
frail 80-year-old on six medications. CONDITIONAL — health education aimed at no particular
patient needs none of it.
Good example: "Context: community pharmacy consultation. Patient is 78, taking warfarin and
metformin, with moderate renal impairment. Flag anything that interacts with those."`,
    },
    {
      key: "clinical_format",
      name: "Output & Structure",
      question: "Is the shape of the output — and its reading level — specified?",
      guidance: `Structure is what makes clinical output usable by whoever receives it: an established
format where one exists (SOAP, SBAR, problem list, discharge summary), section headings,
length, and — for anything patient-facing — an explicit reading level. Clinicians and
patients both parse by shape, so an unstructured wall of prose gets skimmed and misread.
CONDITIONAL where the deliverable is genuinely a short free-text answer.
Good example: "Output as SBAR under those four headings. Keep Situation and Background to
three sentences each. Plain language at roughly an 8th-grade reading level, no
abbreviations."`,
    },
  ],
};

// ── Agent artifacts ──────────────────────────────────────────────────────────────────────
//
// Agent prompts are a different craft from chat prompts: the reader is a model that will act
// autonomously, so the rubrics reward operational precision — explicit boundaries, trigger
// conditions, stop conditions, checkable done-criteria — over tone and framing. Three artifact
// types, three frameworks: the standing instructions that define an agent, the one-shot brief
// that kicks off a task, and the tool documentation a model routes on.

// Standing instructions that define an agent (a Claude Project, a support bot, an MCP host).
const AGENT_SYSTEM: Framework = {
  id: "agent_system",
  name: "Agent System Prompt",
  tagline:
    "Role, tools, guardrails, stop conditions — the standing instructions that define an agent.",
  intro:
    "You evaluate the draft as an agent system prompt — the persistent instructions that define an autonomous or tool-using assistant — then rewrite it. The rewrite must read as standing instructions addressed to the agent, not as a one-off request.",
  kind: "agent",
  runsAs: "system",
  categories: ["Coding Agent", "Support Agent", "Research Agent", "Ops Agent", "Assistant"],
  dimensions: [
    {
      key: "agent_role",
      name: "Role & Scope",
      question: "Does the prompt define who the agent is and what it owns?",
      required: true,
      guidance: `The role names the agent's identity, its domain, the environment it operates in, and —
just as important — what is explicitly out of scope. An agent without a scope boundary
will accept any task it is handed and drift into work it was never meant to do. State
the job in operational terms: what requests it handles, on whose behalf, with what
resources.
Bad example: "You are a helpful assistant."
Good example: "You are the returns agent for Acme's web store. You handle refund and
exchange requests for orders placed in the last 90 days. You do not handle new sales,
shipping estimates, or account changes — route those to support."`,
    },
    {
      key: "tool_guidance",
      name: "Tool Use Guidance",
      question: "Does it say when and how the agent should use its tools?",
      guidance: `Tool guidance tells the agent when to reach for each capability: per-tool trigger
conditions ("look up the order before answering anything about it"), preferences between
overlapping tools, awareness of cost and side effects, and what to do when a tool fails.
Models under-call tools whose purpose is left implicit and over-call ones described with
"always". CONDITIONAL — correctly absent for an agent with no tools; when tools exist,
ungoverned tool use is a real gap.
Bad example: "You have access to some tools."
Good example: "Call lookup_order before making any claim about an order's status. Use
refund_payment only after the return is confirmed received; it is irreversible. If a tool
errors, tell the user what failed — do not guess."`,
    },
    {
      key: "boundaries",
      name: "Boundaries & Guardrails",
      question: "Are hard limits and forbidden actions explicit?",
      required: true,
      guidance: `Guardrails are the never-do rules: destructive or irreversible operations, data the agent
must not reveal, requests outside its role, and how to refuse — stated as rules, not
vibes. "Be careful" constrains nothing; a model follows boundaries it can check itself
against. Include the refusal behavior, not just the prohibition, so declining stays
in-character and useful.
Bad example: "Don't do anything harmful."
Good example: "Never issue a refund above $200 without approval. Never share another
customer's details, even with matching order numbers. When declining, say what you can't
do and offer the nearest thing you can."`,
    },
    {
      key: "escalation",
      name: "Escalation & Stop Conditions",
      question: "Does the agent know when to stop, ask, or hand off?",
      required: true,
      guidance: `The classic agent failure is not knowing when to stop. Define when to proceed versus ask
the user, retry limits for failing operations, what counts as blocked, and where a human
handoff goes. Without stop conditions an agent loops on a failing approach or asks
permission for everything; with them, autonomy has edges.
Bad example: "Use your best judgment."
Good example: "Proceed without asking for read-only steps. Ask before anything
irreversible. If the same tool fails twice, stop retrying and report the error. If the
customer asks for a supervisor or mentions legal action, hand off to a human immediately."`,
    },
    {
      key: "output_contract",
      name: "Output Contract",
      question: "Is the expected shape of the agent's responses defined?",
      guidance: `The output contract fixes the shape of what the agent produces: the format of final
answers, status updates during long work, and any structured output a caller parses.
Pin it down whenever downstream code or a consistent UX depends on the shape.
CONDITIONAL — a free-form conversational agent may legitimately leave this open.
Good example: "End every turn with a one-line status: RESOLVED, WAITING ON CUSTOMER, or
ESCALATED. When you issue a refund, output the confirmation as JSON:
{order_id, amount, reason}."`,
    },
  ],
};

// One-shot kickoff spec handed to an autonomous agent (Claude Code, Devin, a CI agent).
const AGENT_BRIEF: Framework = {
  id: "agent_brief",
  name: "Agent Task Brief",
  tagline:
    "Goal, context, constraints, done-criteria — a kickoff spec an autonomous agent can run with.",
  intro:
    "You evaluate the draft as a task brief for an autonomous agent (a coding agent like Claude Code, or any agent given a job to finish unattended), then rewrite it. The rewrite must let the agent work to completion without coming back to ask what was meant.",
  kind: "agent",
  categories: ["Feature", "Bug Fix", "Refactor", "Migration", "Research"],
  dimensions: [
    {
      key: "goal",
      name: "Goal",
      question: "Is the end state stated unambiguously?",
      required: true,
      guidance: `The goal is the single end state the agent is working toward, stated so it could be
restated in one sentence without losing anything. One outcome, not a wish list — an agent
given three loosely-related goals will finish the easiest and declare victory. If several
things must change, name the one outcome they add up to.
Bad example: "Improve the auth flow and maybe clean things up."
Good example: "Users can reset their password from the login page via an emailed link,
end to end."`,
    },
    {
      key: "context_grounding",
      name: "Context & Grounding",
      question: "Does it point at the relevant files, docs, and prior decisions?",
      guidance: `Grounding is what saves the agent an hour of re-deriving what you already know: the
relevant files and entry points, existing patterns to follow, decisions already made and
their reasons. An ungrounded brief produces work that is correct in isolation and wrong
for the codebase. CONDITIONAL — a self-contained or greenfield task may need little.
Bad example: "It's somewhere in the backend."
Good example: "The flow lives in frontend/app/login/. Follow the magic-link pattern in
auth/callback/route.ts. We already decided against SMS reset — don't revisit it."`,
    },
    {
      key: "constraints",
      name: "Constraints & Non-Goals",
      question: "Are boundaries and untouchables listed?",
      guidance: `Constraints fence the work: files and behavior not to change, technology choices that are
fixed, size or dependency budgets, and explicit non-goals. Agents over-deliver into
adjacent code unless told where the edges are — the cheapest way to prevent a sprawling
diff is one line saying what not to touch. CONDITIONAL — omit when the task is naturally
self-bounding.
Bad example: (absent — and the agent refactors the session layer while it's in there.)
Good example: "Don't modify the session or signup flows. No new dependencies. Out of
scope: rate limiting, styling changes beyond the new form."`,
    },
    {
      key: "done_criteria",
      name: "Done Criteria",
      question: "Will the agent know, checkably, when it is finished?",
      required: true,
      guidance: `Done-criteria are the acceptance conditions, each one checkable by the agent itself —
the difference between an agent that finishes and one that abandons the task mid-loop or
stops at 80%. "Works well" is not checkable; a list of observable behaviors is.
Bad example: "Make sure it works properly."
Good example: "Done when: a reset email arrives within a minute, the link expires after
one use, an expired link shows the error state, and all existing auth tests still pass."`,
    },
    {
      key: "verification",
      name: "Verification",
      question: "Does it say how to prove the work is correct?",
      required: true,
      guidance: `Verification names the commands to run and the evidence to report: the test suite, the
build, a manual check to perform, what output to include in the summary. Self-verifiable
briefs are what let agents loop to correctness instead of declaring victory on the first
plausible diff.
Bad example: "Test it before you're done."
Good example: "Run npm test and npm run build — both must pass clean. Manually request a
reset for a real account in dev and paste the delivered link's redirect chain into your
summary."`,
    },
  ],
};

// Documentation for a single tool / function / MCP endpoint — the text a model routes on.
const TOOL_DESC: Framework = {
  id: "tool_desc",
  name: "Tool Description",
  tagline:
    "Trigger conditions, parameters, return contract — docs a model can pick the right tool from.",
  intro:
    "You evaluate the draft as the documentation for a single tool, function, or MCP endpoint — the description a model reads when deciding whether and how to call it — then rewrite it. The rewrite must work standing alone in a list of sibling tools.",
  kind: "agent",
  runsAs: "none",
  categories: ["MCP", "Function Calling", "API", "CLI", "Integration"],
  dimensions: [
    {
      key: "tool_purpose",
      name: "Purpose & Naming",
      question: "Do the name and first sentence say exactly what the tool does?",
      required: true,
      guidance: `The name and opening line are what the model sees first in a crowded tool list: a
verb-first name that says the action, and a first sentence that stands alone — no
marketing prose, no restating the name. If the first sentence could describe three
different tools, it describes none.
Bad example: "data_helper — A powerful utility for working with your data."
Good example: "search_orders — Search the store's order database by customer email, order
id, or date range; returns matching order summaries."`,
    },
    {
      key: "trigger_conditions",
      name: "Trigger Conditions",
      question: "Is it clear when to call this tool — and when not to?",
      required: true,
      guidance: `Trigger conditions are what models actually route on: "use this when…" phrasing, example
requests that should invoke it, negative triggers for lookalike cases, and disambiguation
from sibling tools. A description that only says what the tool does — never when to reach
for it — gets under-called for the cases it exists for and over-called for its neighbors'.
Bad example: "Searches orders."
Good example: "Use when the user asks about the status, contents, or history of an
existing order. Do not use for refunds (use refund_payment) or for products not yet
ordered (use search_catalog)."`,
    },
    {
      key: "param_clarity",
      name: "Parameter Clarity",
      question: "Is each parameter's type, format, and meaning unambiguous?",
      guidance: `Each parameter needs its type, exact format ("ISO 8601 date", "repo-relative path"),
whether it is required, its default when omitted, and an example value wherever the
format is not obvious. Enums beat free text for closed sets. Ambiguous parameters are
where tool calls fail silently — the model guesses a format and the call errors or, worse,
succeeds wrongly. CONDITIONAL — correctly absent for a zero-parameter tool.
Bad example: "date: the date to search."
Good example: "date_from (optional, ISO 8601 date, e.g. 2026-08-01): include orders placed
on or after this date. Defaults to 90 days ago."`,
    },
    {
      key: "return_contract",
      name: "Return Contract",
      question: "Does the caller know what comes back — including errors and empty results?",
      guidance: `The return contract describes the shape of success output, what an empty result looks
like, the error modes, and what the model should do with each. Without it the model
misreads empty results as failures or invents fields that aren't there. CONDITIONAL —
may be omitted when the return is trivially obvious from the purpose.
Good example: "Returns a JSON array of {order_id, status, total, placed_at}, newest
first, max 20. An empty array means no orders matched — tell the user, don't retry.
Errors return {error: string}; surface the message verbatim."`,
    },
    {
      key: "scope_limits",
      name: "Scope & Limits",
      question: "Are side effects, costs, and limits stated?",
      guidance: `State whether the tool mutates anything or is read-only, rate and size limits, latency or
cost the model should weigh, and any permission requirements. A model told a tool is
irreversible calls it more carefully; one told nothing treats every tool as free and
safe. CONDITIONAL — a pure, cheap, read-only tool may need none of this.
Good example: "Read-only; safe to call repeatedly. Max 5 calls per user turn. Queries
older than 12 months hit cold storage and take ~10s."`,
    },
  ],
};

// ── Image generation ─────────────────────────────────────────────────────────────────────
//
// Prompting an image model (Midjourney, DALL·E, Stable Diffusion, Flux, Imagen) is closer to
// briefing a photographer than instructing an assistant: you describe the finished picture, and
// every attribute you leave unstated the model fills in with its own defaults — centred framing,
// eye-level, glossy over-lit digital art. Two things drive most of the guidance below. First,
// composition is the highest-leverage element drafts omit almost universally. Second, the
// quality-keyword habit ("4k, ultra detailed, masterpiece") does close to nothing on modern
// models while crowding out the description that would actually have helped.
//
// Like the video frameworks, this one deliberately avoids tool-specific flag syntax — the
// per-tool parameters churn, the underlying craft does not.
const IMAGE_GEN: Framework = {
  id: "image_gen",
  name: "Image Generation",
  tagline:
    "Subject, composition, light, style — for a generated still image (Midjourney, DALL·E, Stable Diffusion, Flux).",
  intro:
    "You evaluate the draft as a prompt for an AI image generator, then rewrite it as an image description. The rewrite must read as a description of the finished picture — never as an instruction addressed to an assistant.",
  kind: "image",
  categories: ["Illustration", "Photography", "Concept Art", "Marketing", "Product"],
  dimensions: [
    {
      key: "subject",
      name: "Subject",
      question: "Is the subject described with concrete visual specificity?",
      required: true,
      guidance: `The subject is what the picture is of, described in terms a camera or a brush could
capture: age, build, wardrobe, material, colour, texture, wear, expression, posture.
Abstract nouns ("a businessman", "a nice house") hand the model a category average, and
what comes back is a stock-photo cliché. Name ONE primary subject where you can — with
several, image models routinely blend their attributes together or duplicate limbs and
faces.
Bad example: "a woman with her dog."
Good example: "a woman in her late 60s, deep smile lines, silver hair pinned back loosely,
mustard-yellow raincoat over a grey sweater, one hand resting on the head of a
wiry-haired terrier."`,
    },
    {
      key: "composition",
      name: "Composition & Framing",
      question: "Are shot size, angle, subject placement, and depth specified?",
      required: true,
      guidance: `Composition is the single highest-leverage thing most drafts leave out entirely, and
omitting it means accepting the model's default: subject centred, mid-distance, eye-level,
everything in focus. Specify shot size (extreme close-up, close-up, medium, wide,
establishing), camera angle (eye-level, low, high, overhead, dutch), where the subject
sits in the frame, depth of field, and the aspect ratio the image is for.
Bad example: unstated, or "a good composition."
Good example: "tight three-quarter portrait from slightly below eye level, subject offset
to the left third, shallow depth of field with the background falling away, vertical 4:5
crop."`,
    },
    {
      key: "style_medium",
      name: "Style & Medium",
      question: "Is the visual medium and stylistic reference established?",
      required: true,
      guidance: `Style declares what KIND of image this is — photograph (and which kind: 35mm film,
medium-format, editorial, documentary), oil painting, watercolour, ink drawing, cel
animation, 3D render, technical illustration, collage — anchored with an era, movement,
or process. This is where quality-keyword spam goes to die: "4k, ultra-detailed,
masterpiece, trending on artstation" contributes almost nothing on current models and
displaces description that would. Name the medium instead.
Bad example: "high quality, 8k, highly detailed, beautiful, masterpiece."
Good example: "editorial portrait on medium-format film, natural grain, muted print-like
colour, the restrained look of 1970s magazine photography."`,
    },
    {
      key: "lighting",
      name: "Lighting",
      question: "Is the quality, direction, and source of light described?",
      guidance: `Lighting is most of what separates an image that reads as photographed from one that
reads as generated. Describe quality (hard, soft, diffused), direction (backlit, side-lit,
top-down, rim), source (window light, overcast sky, single bare bulb, studio softbox,
sodium streetlamp), and the resulting contrast. CONDITIONAL — correctly absent for flat
vector art, diagrams, logos, and other work where lighting is not a concept.
Good example: "a single large window camera-left, soft directional light, deep falloff
into shadow across the right of the face, no fill."`,
    },
    {
      key: "setting",
      name: "Setting & Background",
      question: "Is the environment and background treatment established?",
      guidance: `The setting places the subject: location, surfaces, props, weather, and how the background
is treated (seamless white, thrown out of focus, dense and detailed). An unspecified
background is where image models improvise most freely and least usefully — cluttered,
tonally mismatched, or full of half-formed objects. CONDITIONAL — a tight macro crop or an
isolated object on a plain ground may not need one.
Good example: "a cluttered ceramics studio, half-glazed pots on raw wooden shelving
behind, dusty afternoon air, background thrown well out of focus."`,
    },
    {
      key: "technical",
      name: "Technical Constraints",
      question: "Are exclusions and hard requirements stated where they matter?",
      guidance: `The non-descriptive requirements: the aspect ratio the image must fit, what to keep OUT
of the frame, and anything the output has to satisfy exactly. This is also where you route
around what image models still handle badly — legible small text, precise hand positions,
exact object counts, real brand marks — either by excluding them or by not building the
image around them. CONDITIONAL — many prompts need none of this.
Good example: "3:2 landscape. Keep out: text, watermarks, logos, lens flare. No hands in
frame."`,
    },
  ],
};

// ── Video generation ─────────────────────────────────────────────────────────────────────
//
// Prompting a video model (Sora, Veo, Runway, Kling, Luma) is a different craft from prompting a
// chat model: you are describing a shot, not issuing an instruction. Two rules drive most of the
// guidance below. First, these models render ONE continuous take — asking for a sequence of
// actions in a single clip is the most common way a prompt fails. Second, camera language is the
// highest-leverage thing most drafts omit entirely.
//
// Both frameworks deliberately avoid naming a specific tool or version. Per-tool rubrics
// (Gen-3 -> Gen-4, Veo 2 -> 3, Sora -> Sora 2) go stale fast; the shared cinematic vocabulary
// does not.

// Single continuous clip — the workhorse.
const VIDEO_SHOT: Framework = {
  id: "video_shot",
  name: "Cinematic Video",
  tagline:
    "Subject, motion, camera, light — for a single generated clip (Sora, Veo, Runway, Kling).",
  intro:
    "You evaluate the draft as a prompt for an AI video generator producing one continuous shot, then rewrite it as a shot description. The rewrite must read as a description of what the camera sees — never as an instruction addressed to an assistant.",
  kind: "video",
  categories: ["Video", "Film", "Marketing", "Social", "Animation"],
  dimensions: [
    {
      key: "subject",
      name: "Subject",
      question: "Is the subject described with concrete visual specificity?",
      required: true,
      guidance: `The subject is who or what the shot is about, described in terms a camera could capture:
age, build, wardrobe, colour, texture, distinguishing features. Abstractions ("a
businessman", "a nice car") give the model nothing to hold onto, so its interpretation
drifts frame to frame and the subject visibly morphs mid-clip. Name one primary subject;
every additional character multiplies the chance of identity drift.
Bad example: "a woman walking her dog."
Good example: "a woman in her early 60s, silver hair in a loose braid, olive raincoat over
a grey wool sweater, walking a wiry-haired terrier on a red leash."`,
    },
    {
      key: "action",
      name: "Action & Motion",
      question: "Is there a single, continuous, physically plausible action?",
      required: true,
      guidance: `A generated clip is one unbroken take of a few seconds. It should contain ONE continuous
action, described as ongoing motion rather than a sequence of events. Stacking beats
("she enters, sits down, then opens the letter") is the single most common failure: the
model either compresses them into an incoherent blur or silently drops all but one.
Physical plausibility matters too — precise hand interactions, and anything requiring
readable text or exact object counts, degrade badly.
Bad example: "a chef walks in, chops vegetables, plates the dish and smiles at the camera."
Good example: "a chef's hands rocking a heavy knife through a bunch of parsley, steady
rhythmic motion, blade catching the light on each downstroke."`,
    },
    {
      key: "scene",
      name: "Scene",
      question: "Is the setting, time of day, and background established?",
      required: true,
      guidance: `The scene places the subject: location, time of day, weather, season, and what sits in the
background and middle distance. Background detail is what creates a sense of depth and
scale; without it the model tends to produce a subject floating in a vague, flat void.
Bad example: "in a city."
Good example: "a narrow Lisbon side street at dusk, wet cobblestones, laundry strung
between balconies overhead, a lit tram window passing in the far background."`,
    },
    {
      key: "camera",
      name: "Camera & Framing",
      question: "Are shot size, angle, lens, and camera movement specified?",
      required: true,
      guidance: `Camera language is the highest-leverage element most drafts omit completely, and omitting
it hands the model a coin flip on how the shot reads. Four things to specify: shot size
(extreme wide / wide / medium / close-up / extreme close-up), angle (low, high, eye-level,
overhead, over-the-shoulder), lens character (wide-angle, 35mm, 85mm portrait, macro,
anamorphic), and movement (locked-off static, slow dolly in, tracking alongside, crane up,
handheld). Pick ONE movement — combining several in a short take produces drifting,
seasick results.
Bad example: unstated, or "cool camera work."
Good example: "low-angle medium shot on a 35mm lens, slow dolly in, subject centred and
held slightly below eye level."`,
    },
    {
      key: "lighting",
      name: "Lighting & Look",
      question: "Is the lighting quality, direction, and colour palette described?",
      guidance: `Lighting is what makes a clip read as cinematic rather than synthetic. Describe quality
(hard, soft, diffused), direction (backlit, side-lit, top-down, rim), source (golden-hour
sun, sodium streetlamp, single practical lamp, overcast sky), and the resulting palette or
grade. Specify it whenever mood matters; for a flatly-lit documentary look it can be left
implicit.
Good example: "hard low sun raking in from frame left, long shadows, warm amber
highlights against deep blue shade, slightly crushed blacks."`,
    },
    {
      key: "style",
      name: "Style & Medium",
      question: "Is the visual medium and stylistic reference established?",
      guidance: `Style declares what kind of image this is: photoreal live action, 35mm film, 16mm
documentary, 3D render, cel animation, stop-motion, claymation. Anchor it further with an
era, genre, or film-stock reference. Leave it out only when photoreal is genuinely the
intent and no particular look is wanted — but note the default tends toward a glossy,
over-saturated house style, so naming a medium is usually worth it.
Good example: "shot on grainy 16mm, handheld vérité documentary style, muted 1970s colour
palette, slight halation on the highlights."`,
    },
    {
      key: "audio",
      name: "Audio",
      question: "Is sound specified, where the target model generates it?",
      guidance: `Some video models generate synchronised audio (dialogue, ambience, sound effects, score)
alongside the picture; others are silent. Where audio is supported, describe it in three
layers: dialogue (with the speaker and delivery), diegetic effects tied to the on-screen
action, and background ambience or score. This dimension is CONDITIONAL — for a silent
target model, or a shot intended to be scored later, its absence is correct.
Good example: "ambience: rain on canvas awnings and distant traffic. Effect: the rhythmic
scrape of the knife on the board. No dialogue, no music."`,
    },
  ],
};

// Multi-shot sequence — a storyboard rather than a single take.
const VIDEO_STORY: Framework = {
  id: "video_story",
  name: "Video Narrative",
  tagline: "Premise, shot list, continuity — for multi-shot sequences and storyboards.",
  intro:
    "You evaluate the draft as a prompt for a multi-shot generated video sequence, then rewrite it as a numbered shot list. Each shot is generated independently, so the rewrite must make every shot self-contained while keeping the subject and setting consistent across all of them.",
  kind: "video",
  categories: ["Video", "Film", "Marketing", "Social", "Animation"],
  dimensions: [
    {
      key: "premise",
      name: "Premise",
      question: "Is there one clear story beat with a beginning and an end?",
      required: true,
      guidance: `The premise is the single beat the sequence conveys and the arc it travels — the change
between the first frame and the last. A sequence without one is a pile of disconnected
pretty shots. Keep it to one beat: a 20-second sequence cannot carry a three-act story.
Bad example: "a video about our coffee brand."
Good example: "a barista's pre-dawn opening ritual, moving from a dark empty room to the
first customer stepping in as the lights come up — a beat about quiet craft before the
rush."`,
    },
    {
      key: "shot_list",
      name: "Shot List",
      question: "Is the sequence broken into discrete, individually-specified shots?",
      required: true,
      guidance: `The sequence must be an explicit numbered list of shots, each one a self-contained shot
description carrying its own subject, action, framing, and camera movement — because each
shot is generated as a separate clip with no knowledge of its neighbours. One continuous
action per shot. Vary shot sizes between neighbours; a run of identically-framed medium
shots reads as static and lifeless.
Good example: "SHOT 1 — Extreme close-up, static: a brass key turning in a deadbolt. SHOT
2 — Wide, slow dolly in: the darkened café interior, chairs still inverted on tables. SHOT
3 — Medium, tracking right: the barista crossing behind the counter, flicking switches."`,
    },
    {
      key: "continuity",
      name: "Continuity",
      question: "Are the subject and setting described identically in every shot?",
      required: true,
      guidance: `Continuity is what makes separately-generated clips read as one scene, and it is the
dimension that most often breaks. Because the shots share no state, any recurring
character, wardrobe, prop, or location must be re-described in the SAME words in every
shot that contains it — a paraphrase produces a visibly different person or room. Lock a
short, repeatable description block per recurring element and reuse it verbatim. Keep
lighting and time of day consistent unless a change is intentional.
Bad example: shot 1 "a young barista", shot 3 "the woman behind the counter."
Good example: a fixed block reused in every shot — "the barista: late 20s, close-cropped
dark hair, wire-rim glasses, black apron over a white tee."`,
    },
    {
      key: "pacing",
      name: "Pacing",
      question: "Are shot durations and the cutting rhythm indicated?",
      guidance: `Pacing is the intended duration of each shot and the rhythm of the cuts — where it lingers
and where it clips along, and how the shots join (hard cut, match cut, cut on action).
Specify it when the edit carries the feeling; for a short sequence of evenly-weighted
shots it can be left implicit.
Good example: "Shots 1-2 slow, ~4s each, letting the stillness sit. Shots 3-5 tighten to
~1.5s, cut on action, building momentum into the final beat."`,
    },
    {
      key: "look",
      name: "Unified Look",
      question: "Is one consistent visual treatment applied across all shots?",
      guidance: `A unified look is the single medium, colour grade, and lens character shared by every shot
— stated once for the whole sequence and applied to each. Without it, independently
generated clips arrive in visibly different styles and refuse to cut together. Where the
generator has no cross-shot memory, restate the look in each shot rather than only in a
preamble.
Good example: "All shots: photoreal, shot on 35mm with warm practical light sources, teal
shadows and amber highlights, shallow depth of field, subtle film grain."`,
    },
    {
      key: "audio",
      name: "Audio",
      question: "Is sound specified per shot, where the target model generates it?",
      guidance: `Where the target model generates audio, specify it per shot: dialogue with speaker and
delivery, diegetic effects tied to that shot's action, and the ambience or score carrying
across the cut. Continuous ambience or music running underneath every shot is what
sonically binds a sequence together. CONDITIONAL — correctly absent for a silent target
model or a sequence intended to be scored in post.
Good example: "Continuous under all shots: low room hum and rain outside. Shot 1: the
mechanical clunk of the deadbolt. Shot 5: the door chime, first line of dialogue —
'Morning.' — spoken quietly, half off-mic."`,
    },
  ],
};

export const FRAMEWORKS: Framework[] = [
  ANTHROPIC,
  COSTAR,
  RTF_RISEN,
  CRISPE,
  COT,
  HEALTHCARE,
  AGENT_SYSTEM,
  AGENT_BRIEF,
  TOOL_DESC,
  IMAGE_GEN,
  VIDEO_SHOT,
  VIDEO_STORY,
];

export const DEFAULT_FRAMEWORK_ID = ANTHROPIC.id;

/** Look up a framework by id, falling back to the default for unknown/absent ids. */
export function getFramework(id?: string | null): Framework {
  return FRAMEWORKS.find((f) => f.id === id) ?? ANTHROPIC;
}

/** Keys of the framework's required dimensions (a Poor there caps the overall score). */
export function requiredKeys(framework: Framework): string[] {
  return framework.dimensions.filter((d) => d.required).map((d) => d.key);
}

/**
 * True for frameworks whose output targets a generative media model (video, image) rather than
 * a text one. Callers use this to hide the text-only affordances (Test); `kind` is left absent
 * on the text frameworks, so this reads false for them and for anything that predates the field.
 */
export function isMediaFramework(framework: Framework): boolean {
  return framework.kind === "video" || framework.kind === "image";
}

/**
 * True when the refined prompt can be run through the Test drawer's text model. Media prompts
 * can't (the model would just describe a hypothetical clip or picture); neither can artifacts
 * that aren't directly runnable at all, like tool descriptions (`runsAs: "none"`).
 */
export function supportsTest(framework: Framework): boolean {
  return !isMediaFramework(framework) && framework.runsAs !== "none";
}

/**
 * True when the refined prompt is a system prompt: Test must send it as the system role with a
 * sample user message — running it as a bare user turn would test the wrong thing.
 */
export function testRunsAsSystem(framework: Framework): boolean {
  return framework.runsAs === "system";
}

/**
 * True when handing the refined prompt to a chat provider makes sense. A tool description
 * lives in a tool schema, not a chat box, so the open-in-provider row is hidden for it.
 */
export function supportsProviderHandoff(framework: Framework): boolean {
  return framework.runsAs !== "none";
}

/**
 * Recover which framework produced a stored scorecard. Library entries don't persist a
 * framework id (pre-dating frameworks entirely, in the oldest rows), but every framework has
 * a distinct dimension-key set, so the keys identify it. Accepts both storage shapes: the
 * ordered array of `{key, ...}` and the legacy `{clarity: {...}, ...}` object. Returns
 * undefined when nothing matches (e.g. a framework definition changed after the save).
 */
export function inferFramework(scorecard: unknown): Framework | undefined {
  let keys: string[];
  if (Array.isArray(scorecard)) {
    keys = scorecard
      .map((d) => (d as { key?: string }).key)
      .filter((k): k is string => typeof k === "string");
  } else if (scorecard && typeof scorecard === "object") {
    keys = Object.keys(scorecard);
  } else {
    return undefined;
  }
  const set = new Set(keys);
  return FRAMEWORKS.find(
    (f) =>
      f.dimensions.length === set.size &&
      f.dimensions.every((d) => set.has(d.key)),
  );
}

// ── Prompt + schema builders ─────────────────────────────────────────────────────────────

/** Category examples used when a framework doesn't supply its own. */
const DEFAULT_CATEGORIES = ["Coding", "Writing", "Research", "Analysis", "Ops"];

/** Build the framework-specific system prompt: knowledge base + scoring rules. */
export function buildSystemPrompt(framework: Framework): string {
  const required = framework.dimensions.filter((d) => d.required).map((d) => d.name);
  const conditional = framework.dimensions.filter((d) => !d.required).map((d) => d.name);
  const categories = (framework.categories ?? DEFAULT_CATEGORIES).join(", ");

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

Work in this order — each field builds on the ones before it.

First, the scorecard. For each dimension, provide:
- score: one of Poor / Needs Work / Good / Excellent
- assessment: 1-2 sentences explaining why you gave that score
- advice: one specific, actionable improvement

Then, having assessed every dimension, provide:
- priority_fix: the single most impactful change the user should make first (1-2 sentences).
- revised_prompt: the full rewritten prompt that incorporates every improvement, ready to use
  as-is, satisfying the ${framework.name} framework. Do NOT pad it — omit anything the task
  genuinely doesn't need. Output the rewritten prompt only; do not describe the changes inside it.
- suggested_title: a short descriptive title (3-6 words) naming what the prompt does.
- suggested_category: a single short category for filing this prompt (e.g. ${categories}).
- suggested_tags: 2-5 short lowercase tags useful for later search.
</scoring_rules>

The prompt to evaluate is provided in the next (user) message.`;
}

/**
 * Build the framework-specific output schema: a `scorecard` object whose keys are exactly this
 * framework's dimension keys, plus the shared scalar fields. The model is forced to judge every
 * dimension and nothing else.
 *
 * Key order is load-bearing. The model emits the object in schema order, and the response is
 * streamed, so schema order IS the order fields appear on screen. `scorecard` comes first so
 * dimension rows fill in top-down exactly where the UI already puts them — otherwise the
 * revised prompt renders first and every arriving row shoves it down the page. It also means
 * the revision is written after the critiques it's meant to address.
 */
export function buildEvaluationSchema(framework: Framework) {
  const scorecardShape: Record<string, typeof DimensionResultSchema> = {};
  for (const d of framework.dimensions) scorecardShape[d.key] = DimensionResultSchema;
  return z.object({
    scorecard: z.object(scorecardShape),
    ...EVALUATION_SCALAR_FIELDS,
  });
}
