"use client";

import { createClient } from "@/lib/supabase/client";

/** Signs the user out and returns them to /login. Client-side because sign-out clears the
 *  browser's Supabase session. Shared by the header nav and the /no-access screen. */
export function SignOutButton({
  className,
  children = "Sign out",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  async function signOut() {
    await createClient().auth.signOut();
    location.href = "/login";
  }

  return (
    <button onClick={signOut} className={className}>
      {children}
    </button>
  );
}
