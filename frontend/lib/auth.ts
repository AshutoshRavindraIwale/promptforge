// Auth gate for the route handlers that spend the server-side Anthropic key.
//
// proxy.ts skips /api in its matcher on purpose: it answers an unauthenticated request with a
// redirect to /login, which is useless to a fetch() and would surface as an HTML body where the
// caller expects JSON. So the routes gate themselves here instead, with a 401 the client can
// render. getUser() (not getSession) revalidates the token against the auth server.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Null when a signed-in user made the request; otherwise the 401 to return from the route. */
export async function rejectIfSignedOut(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return null;
  return NextResponse.json(
    { error: "Please sign in to continue." },
    { status: 401 },
  );
}
