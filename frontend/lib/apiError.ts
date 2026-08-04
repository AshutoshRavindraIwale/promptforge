// Maps a failed Claude call to a message safe to send the client, mirroring what
// /api/transcribe already does for Groq: full upstream detail (request ids, account/quota
// text) is logged server-side only, and the client gets a curated line with the actionable
// cases — bad key, rate limit, overload — kept distinct.
import Anthropic from "@anthropic-ai/sdk";

export interface ClientError {
  status: number;
  message: string;
}

export function toClientError(err: unknown, fallback: string): ClientError {
  if (err instanceof Anthropic.APIError) {
    console.error("Anthropic API error:", err.status, err.message);
    if (err.status === 401) {
      return {
        status: 502,
        message:
          "The Claude API key was rejected. Check the key in Settings (key icon in the header) or the server's ANTHROPIC_API_KEY.",
      };
    }
    if (err.status === 429) {
      return {
        status: 429,
        message: "Claude rate limit reached. Try again in a moment.",
      };
    }
    if (err.status === 529) {
      return {
        status: 502,
        message: "Claude is overloaded right now. Try again in a moment.",
      };
    }
    return { status: 502, message: "The Claude call failed. Please try again." };
  }
  // Non-SDK errors are ours (curated messages thrown by lib/engine.ts) or generic runtime
  // failures — nothing upstream-derived, so the message is safe to pass through.
  if (err instanceof Error && err.message) {
    return { status: 500, message: err.message };
  }
  return { status: 500, message: fallback };
}
