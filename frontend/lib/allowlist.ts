// The email allowlist, in one place so both boundaries agree on it: the API gate (lib/auth.ts,
// which turns a miss into 401/403 JSON) and the request boundary (proxy.ts, which turns a miss
// into a redirect to /no-access before the user ever reaches the app).
//
// No Supabase import on purpose — proxy.ts runs on every request and must stay lightweight, and
// this reads only process.env. It FAILS CLOSED: an unset ALLOWED_EMAILS rejects everyone rather
// than silently reverting to "any signed-in account can spend the key."

/** Parsed ALLOWED_EMAILS (lowercased), or null when the variable isn't configured at all. */
export function allowlist(): Set<string> | null {
  const raw = process.env.ALLOWED_EMAILS;
  if (raw === undefined) return null;
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True only when the allowlist is configured AND this email is on it (case-insensitive). */
export function isAllowed(email: string | null | undefined): boolean {
  const allowed = allowlist();
  if (allowed === null) return false;
  const e = email?.toLowerCase();
  return !!e && allowed.has(e);
}
