import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { toClientError } from "@/lib/apiError";
import { denyUnauthorized } from "@/lib/auth";
import { FRAMEWORKS } from "@/lib/frameworks";
import { MISSING_ANTHROPIC_KEY, resolveAnthropicKey } from "@/lib/keys";
import { SUGGEST_MODEL } from "@/lib/model";

// The Anthropic SDK needs the Node.js runtime (not Edge).
export const runtime = "nodejs";
export const maxDuration = 30;

// Classification reads the shape of a draft, not its full contents — the opening lines are
// enough to tell a video prompt from a reasoning task. Truncating (rather than rejecting, as
// /api/evaluate does) keeps the call cheap no matter what gets pasted.
const MAX_CLASSIFY_CHARS = 4_000;

// The framework list and the output schema are both derived from lib/frameworks.ts, so a new
// framework is suggestable the moment it's defined — no changes here.
const KIND_HINTS: Record<string, string> = {
  video: ", for AI-video prompts",
  agent: ", for AI-agent artifacts",
};

const FRAMEWORK_LINES = FRAMEWORKS.map(
  (f) => `- ${f.id} (${f.name}${KIND_HINTS[f.kind ?? ""] ?? ""}): ${f.tagline}`,
).join("\n");

const SYSTEM = `You pick the best-fit prompt-engineering framework for evaluating a draft prompt.

Frameworks:
${FRAMEWORK_LINES}

Rules:
- Pick a video framework only when the draft is clearly for an AI video generator (Sora, Veo,
  Runway, Kling — shots, camera moves, scenes). "Video Narrative" is for multi-shot sequences;
  "Cinematic Video" for a single clip.
- Pick an agent framework only when the draft IS an agent artifact, not merely about agents.
  "Agent System Prompt" is standing instructions defining an agent — an identity ("You are…"),
  tool rules, guardrails, persistent behavior. "Agent Task Brief" is a one-shot work order for
  an autonomous or coding agent: a goal with context, constraints, and done-criteria. "Tool
  Description" documents a single tool, function, or MCP endpoint — what it does, when to call
  it, parameters, return value.
- A draft asking a model to write ABOUT agents or tools is a normal content prompt — classify
  by what the draft is for, not its topic.
- Prefer a specialized framework only when the draft clearly matches its purpose; when nothing
  stands out, choose "anthropic" — it is the general-purpose default.
- The reason is shown to the user: one short sentence saying why this framework fits THIS draft,
  in plain language. Never mention these rules.`;

export async function POST(req: Request) {
  // Same gate as the other paid routes — this one is cheap, but it still spends a key.
  const denied = await denyUnauthorized(req);
  if (denied) return denied;

  let draft = "";
  try {
    const body = await req.json();
    draft = String(body?.draft ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!draft) {
    return NextResponse.json(
      { error: "Write or paste a draft first." },
      { status: 400 },
    );
  }

  const apiKey = resolveAnthropicKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: MISSING_ANTHROPIC_KEY }, { status: 500 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: SUGGEST_MODEL,
      max_tokens: 200,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `<draft>\n${draft.slice(0, MAX_CLASSIFY_CHARS)}\n</draft>`,
        },
      ],
      // Structured output pins the response to a valid framework id — no parsing fallbacks.
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              framework: { type: "string", enum: FRAMEWORKS.map((f) => f.id) },
              reason: { type: "string" },
            },
            required: ["framework", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = message.content.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text) as { framework: string; reason: string };
    return NextResponse.json(parsed);
  } catch (err) {
    const { status, message } = toClientError(err, "Suggestion failed.");
    return NextResponse.json({ error: message }, { status });
  }
}
