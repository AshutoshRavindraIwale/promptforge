// Client-side store for user-supplied API keys (bring-your-own-key). Keys live only in
// this browser's localStorage and travel as headers on requests to our own API routes,
// which fall back to the server env vars when a header is absent. Nothing is persisted
// server-side, so clearing a field here fully revokes what the app can spend.

export interface ApiKeys {
  anthropic: string;
  groq: string;
}

const STORAGE_KEY = "promptforge:api-keys";

export const ANTHROPIC_KEY_HEADER = "x-anthropic-api-key";
export const GROQ_KEY_HEADER = "x-groq-api-key";

// Header values must be printable ASCII or fetch() throws; this also strips the
// whitespace and invisible characters that ride along with a copy-pasted key.
function sanitize(value: unknown): string {
  return String(value ?? "").replace(/[^\x21-\x7e]/g, "");
}

export function getApiKeys(): ApiKeys {
  if (typeof window === "undefined") return { anthropic: "", groq: "" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { anthropic: sanitize(parsed?.anthropic), groq: sanitize(parsed?.groq) };
  } catch {
    return { anthropic: "", groq: "" };
  }
}

export function setApiKeys(keys: ApiKeys): void {
  const anthropic = sanitize(keys.anthropic);
  const groq = sanitize(keys.groq);
  try {
    if (!anthropic && !groq) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ anthropic, groq }));
    }
  } catch {
    // Storage can be unavailable (private mode, quota); the app still works on server keys.
  }
}

/** Headers to spread into any fetch that hits a paid API route. */
export function keyHeaders(): Record<string, string> {
  const { anthropic, groq } = getApiKeys();
  const headers: Record<string, string> = {};
  if (anthropic) headers[ANTHROPIC_KEY_HEADER] = anthropic;
  if (groq) headers[GROQ_KEY_HEADER] = groq;
  return headers;
}
