// The "signed in, but not approved yet" screen. proxy.ts sends a signed-in user here when their
// email isn't on ALLOWED_EMAILS, so they get a clear, actionable state up front instead of
// reaching the app and only learning they're blocked when an evaluation returns 403.
//
// Server component: it reads the session server-side to show the exact address they're signed in
// as, and re-checks the allowlist so a direct hit to /no-access can't strand an allowed user
// here (proxy.ts already guards this; this is defense in depth).
import { redirect } from "next/navigation";
import { isAllowed } from "@/lib/allowlist";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

export default async function NoAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (isAllowed(user.email)) redirect("/");

  // Optional: if the operator sets a contact address, offer a prefilled "Request access" mailto.
  const contact = process.env.ACCESS_CONTACT_EMAIL?.trim();
  const mailto = contact
    ? `mailto:${contact}?subject=${encodeURIComponent(
        "PromptForge access request",
      )}&body=${encodeURIComponent(
        `Please add ${user.email} to the PromptForge allowlist.`,
      )}`
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <span className="size-2.5 rotate-45 rounded-[1px] bg-ember" />
        <h1 className="mt-5 text-[26px] font-light tracking-[-0.01em] text-ink">
          Almost there
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          You&rsquo;re signed in as{" "}
          <span className="text-ink">{user.email}</span>, but this account
          isn&rsquo;t approved yet.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-line bg-surface px-5 py-4 text-center text-sm leading-relaxed text-ink-2">
        Access is invite-only. Ask the app owner to add your address to the
        allowlist — once it&rsquo;s added, reload this page and you&rsquo;re in.
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        {mailto && (
          <a
            href={mailto}
            className="w-full rounded-full bg-ember px-5 py-3 text-center text-[13px] font-medium text-white transition hover:brightness-110"
          >
            Request access
          </a>
        )}
        <SignOutButton className="text-[13px] text-ink-3 transition-colors hover:text-ink" />
      </div>
    </main>
  );
}
