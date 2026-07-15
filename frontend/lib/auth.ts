// Access gate for the route handlers that spend the server-side Anthropic key.
//
// Two checks: (1) the caller is signed in, and (2) their email is on the allowlist. proxy.ts
// skips /api in its matcher on purpose — it answers an unauthenticated request with a redirect
// to /login, which is useless to a fetch() and would surface as an HTML body where the caller
// expects JSON. So the routes gate themselves here instead, with a status the client can render.
// getUser() (not getSession) revalidates the token against the auth server.
//
// The allowlist bounds cost: signup is open (any Google account / any email via magic link), so
// without it any account could run these paid routes. It FAILS CLOSED — if ALLOWED_EMAILS is
// unset, every caller is rejected rather than silently reverting to "any signed-in user."
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Parsed ALLOWED_EMAILS (lowercased), or null when the variable isn't configured at all. */
function allowlist(): Set<string> | null {
  const raw = process.env.ALLOWED_EMAILS;
  if (raw === undefined) return null;
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Null when an allowed, signed-in user made the request; otherwise the error response the route
 * should return (401 not signed in, 403 not permitted / allowlist not configured).
 */
export async function denyUnauthorized(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to continue." },
      { status: 401 },
    );
  }

  const allowed = allowlist();
  if (allowed === null) {
    // No allowlist configured — refuse rather than expose the paid routes to every account.
    return NextResponse.json(
      {
        error:
          "Access isn't configured on the server. Set ALLOWED_EMAILS to a comma-separated list of permitted addresses.",
      },
      { status: 403 },
    );
  }

  const email = user.email?.toLowerCase();
  if (!email || !allowed.has(email)) {
    return NextResponse.json(
      { error: "Your account isn't allowed to use this app." },
      { status: 403 },
    );
  }

  return null;
}
