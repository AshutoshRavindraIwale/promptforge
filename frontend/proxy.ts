// Next 16 renamed Middleware -> Proxy: this file must export `proxy` (not `middleware`) and
// must NOT set `export const runtime` (proxy already runs on Node; setting it throws).
// Two jobs: (1) refresh the rotating Supabase auth cookie on every request, and
// (2) redirect unauthenticated users to /login. getUser() (not getSession) revalidates the
// token against the auth server.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth");
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
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
