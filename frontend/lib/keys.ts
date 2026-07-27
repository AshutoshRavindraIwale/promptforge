// Server-side key resolution for the paid API routes: a key the user saved in Settings
// (sent as a request header by lib/apiKeys.ts) wins over the server env var. Requests are
// already gated by denyUnauthorized(), so honoring a caller-supplied key never opens the
// routes up — it only lets an allowed user spend their own quota instead of the server's.

const ANTHROPIC_KEY_HEADER = "x-anthropic-api-key";
const GROQ_KEY_HEADER = "x-groq-api-key";

export function resolveAnthropicKey(req: Request): string | undefined {
  return req.headers.get(ANTHROPIC_KEY_HEADER) || process.env.ANTHROPIC_API_KEY || undefined;
}

export function resolveGroqKey(req: Request): string | undefined {
  return req.headers.get(GROQ_KEY_HEADER) || process.env.GROQ_API_KEY || undefined;
}

export const MISSING_ANTHROPIC_KEY =
  "No Claude API key available. Add yours in Settings (key icon in the header), or set ANTHROPIC_API_KEY in frontend/.env.local / your Vercel env vars. Keys: https://console.anthropic.com/settings/keys";

export const MISSING_GROQ_KEY =
  "No Groq API key available. Add yours in Settings (key icon in the header), or set GROQ_API_KEY in frontend/.env.local / your Vercel env vars. Free keys: https://console.groq.com/keys";
