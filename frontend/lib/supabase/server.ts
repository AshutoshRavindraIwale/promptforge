// Cookie-based Supabase client for Server Components and route handlers.
// Next 16: cookies() is async, so this factory is async too. The setAll try/catch is required
// because cookies can't be written during a Server Component render — proxy.ts refreshes the
// session on each request, so swallowing that error here is safe.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to frontend/.env.local (local) or your deployment's environment variables.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component render — proxy.ts handles the refresh.
        }
      },
    },
  });
}
