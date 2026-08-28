// Next 16 renamed Middleware -> Proxy: this file must export `proxy` (not `middleware`) and
// must NOT set `export const runtime` (proxy already runs on Node; setting it throws).
// Four jobs: (1) refresh the rotating Supabase auth cookie on every request, (2) redirect
// unauthenticated users to /login, (3) redirect signed-in-but-not-allowlisted users to
// /no-access — so they see a clear "not approved yet" state instead of reaching the app and
// only discovering the block when an evaluation fails 403 — and (4) attach a per-request
// nonce-based Content-Security-Policy. getUser() (not getSession) revalidates the token
// against the auth server.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowed } from "@/lib/allowlist";

// Nonce-based Content-Security-Policy (job 4 below). Built here rather than next.config.ts
// because the nonce must be fresh per request: Next reads it from this request header and
// stamps it onto every framework/inline script it renders, so only markup we generated runs.
// Notes on the softer directives:
//  - style-src keeps 'unsafe-inline': components use React style={{}} attributes, which
//    style-src governs; style injection is a far weaker vector than script and script-src
//    stays nonce-strict.
//  - dev adds 'unsafe-eval' (React error overlay) and ws: (HMR); production drops both.
function buildCsp(nonce: string, supabaseOrigin: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    // supabase-js calls auth + PostgREST from the browser; no realtime/storage, so no wss.
    `connect-src 'self' ${supabaseOrigin}${isDev ? " ws:" : ""}`,
    `media-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : [`upgrade-insecure-requests`]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to frontend/.env.local (local) or your deployment's environment variables.",
    );
  }

  // Set on the REQUEST headers before any NextResponse.next({ request }) is created (including
  // the ones the cookie handler below re-creates) so the render Next does downstream sees them.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, new URL(url).origin);
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // /auth is always reachable so the OAuth / magic-link callback can complete (it exchanges the
  // code and then redirects onward, at which point these rules apply to the destination).
  const isAuthCallback = path.startsWith("/auth");
  const isLogin = path.startsWith("/login");
  const isNoAccess = path === "/no-access";
  // The guide and the wiki are public on purpose: someone who lands here without an account (or
  // who is signed in but still waiting on the allowlist) should be able to find out what this is
  // and read the writing. Prefix-matched, so a new wiki article is public the moment it exists.
  const isPublicDoc = path === "/how-to-use" || path.startsWith("/wiki");

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.redirect(url);
  };

  if (!user) {
    // Signed out: only the auth pages are reachable; everything else goes to /login.
    if (!isLogin && !isAuthCallback && !isPublicDoc) return redirectTo("/login");
  } else if (!isAllowed(user.email)) {
    // Signed in but not on the allowlist: park them on /no-access (never the app, never a
    // 403 after a 20s evaluation). /auth stays reachable so an in-flight callback can land.
    if (!isNoAccess && !isAuthCallback && !isPublicDoc) return redirectTo("/no-access");
  } else if (isNoAccess) {
    // Allowed users have no business on the not-approved screen.
    return redirectTo("/");
  }

  // Must return THIS response object so the refreshed session cookies are sent back.
  // The browser enforces the CSP from the response header; the copy on the request headers
  // above is what told Next which nonce to stamp onto its scripts.
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Skip static assets, and skip the API routes — not because they're public (they spend the
  // Anthropic and Groq keys and must not be), but because the redirect above is the wrong answer
  // for a fetch(). They enforce auth themselves via denyUnauthorized() and reply 401 JSON instead.
  // Listed individually on purpose: a new /api route left off this list gets a useless redirect
  // rather than silently losing its gate, which is the safer way to fail.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/evaluate|api/test|api/transcribe|api/suggest-framework|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
