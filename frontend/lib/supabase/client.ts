// Browser-side Supabase client. Used by lib/library.ts (data CRUD) and the
// login UI. Safe to ship to the browser: the anon key is public by design and Row-Level Security
// (see the entries table policies) is what isolates each user's rows.
//
// createBrowserClient is memoized into a per-tab singleton so every caller shares one instance
// (and one auth state) instead of each module spinning up its own.
import { createBrowserClient } from "@supabase/ssr";

// Static member access, not process.env[name]: Next only inlines NEXT_PUBLIC_* into the browser
// bundle when referenced literally. A dynamic lookup would read as undefined client-side.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (cached) return cached;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to frontend/.env.local (local) or your deployment's environment variables.",
    );
  }
  cached = createBrowserClient(url, anonKey);
  return cached;
}
