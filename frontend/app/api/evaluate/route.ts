import { NextResponse } from "next/server";
import { denyUnauthorized } from "@/lib/auth";
import { evaluate } from "@/lib/engine";
import { overallScore } from "@/lib/scoring";
import { getFramework, requiredKeys } from "@/lib/frameworks";
import { resolveAnthropicKey } from "@/lib/keys";

// The Anthropic SDK needs the Node.js runtime (not Edge). maxDuration gives the Claude
// call headroom beyond the default function timeout.
export const runtime = "nodejs";
export const maxDuration = 60;

// Bound per-call cost: drafts beyond this are rejected before they reach Claude (matches the
// same guard on /api/test).
const MAX_CHARS = 20_000;
const MAX_FOCUS_CHARS = 2_000;

export async function POST(req: Request) {
  // This route spends the server-side Anthropic key — only allowed, signed-in users.
  const denied = await denyUnauthorized();
  if (denied) return denied;

  let draft = "";
  let frameworkId: string | undefined;
  let focus: string | undefined;
  try {
    const body = await req.json();
    draft = String(body?.draft ?? "").trim();
    if (body?.framework != null) frameworkId = String(body.framework);
    if (body?.focus != null) focus = String(body.focus).trim() || undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  // getFramework falls back to the default for unknown ids, so an unrecognized value never
  // errors — it just evaluates against the default rubric.
  const framework = getFramework(frameworkId);

  if (!draft) {
    return NextResponse.json(
      { error: "Please provide a prompt to evaluate." },
      { status: 400 },
    );
  }
  if (draft.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Prompt must be under ${MAX_CHARS} characters.` },
      { status: 400 },
    );
  }
  if (focus && focus.length > MAX_FOCUS_CHARS) {
    return NextResponse.json(
      { error: `Refinement note must be under ${MAX_FOCUS_CHARS} characters.` },
      { status: 400 },
    );
  }

  try {
    const evaluation = await evaluate(
      draft,
      framework.id,
      focus,
      resolveAnthropicKey(req),
    );
    return NextResponse.json({
      evaluation,
      overall_score: overallScore(evaluation.scorecard, requiredKeys(framework)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Evaluation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
