import { NextResponse } from "next/server";
import { denyUnauthorized } from "@/lib/auth";

// Multipart parsing and the outbound upload both need the Node.js runtime (not Edge).
export const runtime = "nodejs";
export const maxDuration = 60;

// Groq's OpenAI-compatible transcription endpoint. Plain fetch — no SDK needed for one call.
const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

// whisper-large-v3-turbo: ~$0.04 per hour of audio, ~200x realtime. The free tier covers
// 2,000 requests and 8 hours of audio per day, which this app will never exhaust.
const MODEL = "whisper-large-v3-turbo";

// Bound per-call cost and stay under Groq's free-tier upload ceiling. Opus runs ~3 KB/s, so
// 8 MB is well over the client's 2-minute recording cap — this is a backstop, not the limit.
const MAX_BYTES = 8 * 1024 * 1024;

// Whisper accepts a prompt to bias its decoding. Feeding it the jargon this app is dictated in
// is what stops "few-shot" from landing as "fuchsia" — the main accuracy win over Web Speech.
const VOCABULARY_HINT =
  "Prompt engineering terms: prompt, few-shot, zero-shot, chain-of-thought, system prompt, " +
  "XML tags, temperature, tokens, JSON, schema, rubric, LLM, Claude, Opus, Sonnet, Haiku.";

// Transcribes a dictated audio clip for the prompt input. The client records with MediaRecorder
// and posts the whole blob once, on stop — there is no streaming/interim transcript.
export async function POST(req: Request) {
  // Same gate as the other paid routes: unguarded, this is a free transcription proxy for
  // anyone who can reach it.
  const denied = await denyUnauthorized();
  if (denied) return denied;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GROQ_API_KEY is not set on the server. Add it to frontend/.env.local (local) or your Vercel project env vars. Free keys: https://console.groq.com/keys",
      },
      { status: 500 },
    );
  }

  let audio: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("audio");
    if (value instanceof File) audio = value;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (!audio || audio.size === 0) {
    return NextResponse.json({ error: "No audio received." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That recording is too long. Try a shorter one." },
      { status: 413 },
    );
  }

  // Whisper infers the container from the filename extension, and MediaRecorder blobs arrive
  // without one. webm covers Chrome/Firefox; Safari records mp4.
  const extension = audio.type.includes("mp4") ? "mp4" : "webm";

  const upstream = new FormData();
  upstream.set("file", audio, `dictation.${extension}`);
  upstream.set("model", MODEL);
  upstream.set("response_format", "text");
  upstream.set("prompt", VOCABULARY_HINT);
  // Pinning the language skips detection and avoids the odd spurious translation. Drop this
  // line to accept dictation in any language Whisper supports.
  upstream.set("language", "en");

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!res.ok) {
      // Surface rate limits distinctly — they're the one failure a free-tier key will actually hit.
      if (res.status === 429) {
        return NextResponse.json(
          { error: "Transcription rate limit reached. Try again in a moment." },
          { status: 429 },
        );
      }
      const detail = await res.text();
      console.error("Groq transcription failed:", res.status, detail);
      return NextResponse.json(
        { error: "Transcription failed. Please try again." },
        { status: 502 },
      );
    }

    // response_format=text returns the bare transcript, not JSON.
    const text = (await res.text()).trim();
    return NextResponse.json({ text });
  } catch (err) {
    console.error("Groq transcription error:", err);
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 502 },
    );
  }
}
