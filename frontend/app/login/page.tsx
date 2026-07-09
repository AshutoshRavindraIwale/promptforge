"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr || loading) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the sign-in link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-white">
        Prompt<span className="text-violet-400">Forge</span>
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        Sign in to score, revise, and save your prompts.
      </p>

      {sent ? (
        <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          Check your inbox — we sent a sign-in link to <strong>{email.trim()}</strong>.
          Open it on this device to continue.
        </div>
      ) : (
        <form onSubmit={send} className="mt-8 space-y-3">
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Sending…" : "Email me a sign-in link"}
          </button>
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </form>
      )}
    </main>
  );
}
