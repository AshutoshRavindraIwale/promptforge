"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    // signOut() clears the cookies, but the Client Cache still holds RSC payloads rendered
    // while the session existed. refresh() drops them, so pressing Back re-asks the server —
    // which now sees no user and redirects — instead of replaying the signed-in UI.
    router.refresh();
  }

  return (
    <button onClick={signOut} className={className}>
      {children}
    </button>
  );
}
