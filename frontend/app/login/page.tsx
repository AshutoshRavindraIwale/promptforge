"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  // Surface a failed callback (e.g. the user backed out of the consent screen). Derived from
  // the URL during render — no effect — so it can't trip the setState-in-effect lint.
  const [error, setError] = useState<string | null>(
    searchParams.get("error")
      ? "Sign-in didn't complete. Try again."
      : null,
  );
  const [showEmail, setShowEmail] = useState(false);

  // Strip the consumed ?error param so a refresh doesn't re-show the message. Pure URL
  // housekeeping — no state is set here.
  useEffect(() => {
    if (searchParams.get("error")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  async function signInWithGoogle() {
    if (loading) return;
    setLoading("google");
    setError(null);
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
      // The browser is being redirected to Google; keep the button in its loading state.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start Google sign-in.",
      );
      setLoading(null);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr || loading) return;
    setLoading("email");
    setError(null);
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email: addr,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send the sign-in link.",
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <span className="size-2.5 rotate-45 rounded-[1px] bg-ember" />
        <h1 className="mt-5 text-[26px] font-light tracking-[-0.01em] text-ink">
          PromptForge
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Rough prompts in. Refined prompts out.
        </p>
      </div>

      {sent ? (
        <div className="mt-10 rounded-2xl border border-line bg-surface px-5 py-4 text-center text-sm leading-relaxed text-ink-2">
          A sign-in link is on its way to{" "}
          <span className="text-ink">{email.trim()}</span>. Open it on this
          device to continue.
        </div>
      ) : (
        <div className="mt-10">
          <button
            onClick={signInWithGoogle}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line bg-surface px-5 py-3 text-[13px] font-medium text-ink transition-colors hover:border-ink-3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <GoogleMark />
            {loading === "google" ? "Redirecting…" : "Continue with Google"}
          </button>

          {showEmail ? (
            <form onSubmit={sendLink} className="mt-6 space-y-3">
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-full border border-line bg-surface px-5 py-3 text-center text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3"
              />
              <button
                type="submit"
                disabled={loading !== null || !email.trim()}
                className="w-full rounded-full bg-ember px-5 py-3 text-[13px] font-medium text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "email" ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowEmail(true)}
              className="mt-5 w-full text-center text-[13px] text-ink-3 transition-colors hover:text-ink"
            >
              Use email instead
            </button>
          )}

          {error && (
            <p className="mt-4 text-center text-sm text-grade-poor">{error}</p>
          )}
        </div>
      )}
    </main>
  );
}

// useSearchParams() requires a Suspense boundary in the App Router.
export default function Login() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
