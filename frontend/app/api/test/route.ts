import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { denyUnauthorized } from "@/lib/auth";
import { MODEL } from "@/lib/model";

// The Anthropic SDK needs the Node.js runtime (not Edge). maxDuration gives the Claude
// call headroom beyond the default function timeout.
export const runtime = "nodejs";
export const maxDuration = 60;

// Bound per-call cost: inputs beyond this are rejected, output is capped at 1024 tokens.
const MAX_CHARS = 20_000;

// Runs a prompt under test. The prompt plays the system role and the sample input is the
// user message; with no input the prompt itself is the user message (self-contained
// prompts like "Write a haiku about autumn" need no separate input). Default temperature
// on purpose — this previews typical output, unlike the temperature-0 scoring call.
export async function POST(req: Request) {
  // This route runs an arbitrary prompt on the server-side Anthropic key: without this gate it
  // is a free Claude proxy for any allowed account (and, unchecked, the whole internet).
  const denied = await denyUnauthorized();
  if (denied) return denied;

  let prompt = "";
  let input = "";
  try {
    const body = await req.json();
    prompt = String(body?.prompt ?? "").trim();
    input = String(body?.input ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json(
      { error: "Please provide a prompt to test." },
      { status: 400 },
    );
  }
  if (prompt.length > MAX_CHARS || input.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Prompt and input must each be under ${MAX_CHARS} characters.` },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set on the server. Add it to frontend/.env.local (local) or your Vercel project env vars.",
      },
      { status: 500 },
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      ...(input
        ? { system: prompt, messages: [{ role: "user", content: input }] }
        : { messages: [{ role: "user", content: prompt }] }),
    });
    const output = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    return NextResponse.json({ output });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
