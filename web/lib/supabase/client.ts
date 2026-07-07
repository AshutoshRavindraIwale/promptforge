// Browser-side Supabase client. Used by lib/library.ts (data CRUD) and the login UI.
// Safe to ship to the browser: the anon key is public by design and Row-Level Security
// (see the entries table policies) is what isolates each user's rows.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
