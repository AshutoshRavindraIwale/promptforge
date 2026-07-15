import { NextResponse } from "next/server";
import { denyUnauthorized } from "@/lib/auth";
import { evaluate } from "@/lib/engine";
import { overallScore } from "@/lib/scoring";

// The Anthropic SDK needs the Node.js runtime (not Edge). maxDuration gives the Claude
// call headroom beyond the default function timeout.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  // This route spends the server-side Anthropic key — only allowed, signed-in users.
  const denied = await denyUnauthorized();
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
      { error: "Please provide a prompt to evaluate." },
      { status: 400 },
    );
  }

  try {
    const evaluation = await evaluate(draft);
    return NextResponse.json({
      evaluation,
      overall_score: overallScore(evaluation.scorecard),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Evaluation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
