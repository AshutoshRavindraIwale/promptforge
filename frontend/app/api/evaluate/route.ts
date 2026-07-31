import { NextResponse } from "next/server";
import { denyUnauthorized } from "@/lib/auth";
import { streamEvaluate } from "@/lib/engine";
import { getFramework } from "@/lib/frameworks";
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

  // Everything above returns a normal JSON status code. From here the response is a stream, so
  // the status line is already committed — a failure mid-generation can't become a 500 and is
  // reported in-band as a final {"type":"error"} line instead.
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (chunk: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
      try {
        for await (const chunk of streamEvaluate(
          draft,
          framework.id,
          focus,
          resolveAnthropicKey(req),
        )) {
          send(chunk);
        }
      } catch (err) {
        send({
          type: "error",
          error: err instanceof Error ? err.message : "Evaluation failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      // Newline-delimited JSON: one {"type":"delta"|"done"|"error"} object per line.
      "Content-Type": "application/x-ndjson; charset=utf-8",
      // Deltas are worthless if something between here and the browser buffers them.
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
