// Next 16 renamed Middleware -> Proxy: this file must export `proxy` (not `middleware`) and
// must NOT set `export const runtime` (proxy already runs on Node; setting it throws).
// Three jobs: (1) refresh the rotating Supabase auth cookie on every request, (2) redirect
// unauthenticated users to /login, and (3) redirect signed-in-but-not-allowlisted users to
// /no-access — so they see a clear "not approved yet" state instead of reaching the app and
// only discovering the block when an evaluation fails 403. getUser() (not getSession)
// revalidates the token against the auth server.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowed } from "@/lib/allowlist";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to frontend/.env.local (local) or your deployment's environment variables.",
    );
  }

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

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.redirect(url);
  };

  if (!user) {
    // Signed out: only the auth pages are reachable; everything else goes to /login.
    if (!isLogin && !isAuthCallback) return redirectTo("/login");
  } else if (!isAllowed(user.email)) {
    // Signed in but not on the allowlist: park them on /no-access (never the app, never a
    // 403 after a 20s evaluation). /auth stays reachable so an in-flight callback can land.
    if (!isNoAccess && !isAuthCallback) return redirectTo("/no-access");
  } else if (isNoAccess) {
    // Allowed users have no business on the not-approved screen.
    return redirectTo("/");
  }

  // Must return THIS response object so the refreshed session cookies are sent back.
  return response;
}

export const config = {
  // Skip static assets, and skip /api — not because those routes are public (they spend the
  // Anthropic key and must not be), but because the redirect above is the wrong answer for a
  // fetch(). They enforce auth themselves via rejectIfSignedOut() and reply 401 JSON instead.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/evaluate|api/test|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
