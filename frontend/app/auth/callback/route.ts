// Magic-link callback. With @supabase/ssr's default PKCE flow, Supabase's default email link
// redirects here with `?code=...`; we exchange it for a session (the code verifier is in the
// browser cookies set when signInWithOtp was called). No custom email template needed.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
