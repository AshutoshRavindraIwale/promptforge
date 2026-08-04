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
//
// proxy.ts enforces the same allowlist a step earlier, redirecting a signed-in-but-not-allowed
// user to /no-access so they never reach the app and hit these 403s. This gate stays as the
// authoritative check for the paid routes (defense in depth, and the right answer for a fetch()).
import { NextResponse } from "next/server";
import { allowlist } from "@/lib/allowlist";
import { rateLimited } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

/**
 * Null when an allowed, signed-in user made the request; otherwise the error response the route
 * should return (401 not signed in, 403 not permitted / allowlist not configured, 429 over the
 * per-user rate limit). Pass the request so the limit is scoped per route — an evaluate burst
 * shouldn't lock the same user out of dictation.
 */
export async function denyUnauthorized(req?: Request): Promise<NextResponse | null> {
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

  // The allowlist bounds who can spend; this bounds how fast. Keyed by user id, not email or
  // IP, so the cap follows the account across devices and can't be dodged by rotating IPs.
  if (req && rateLimited(`${user.id}:${new URL(req.url).pathname}`)) {
    return NextResponse.json(
      { error: "Too many requests. Wait a minute and try again." },
      { status: 429 },
    );
  }

  return null;
}
