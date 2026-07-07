"use client";

import { useState } from "react";
import { Scorecard } from "@/components/Scorecard";
import { RevisedPrompt } from "@/components/RevisedPrompt";
import { SaveDialog, type SavePayload } from "@/components/SaveDialog";
import { Library } from "@/components/Library";
import { addEntry } from "@/lib/library";
import { createClient } from "@/lib/supabase/client";
import type { EvaluationResult } from "@/lib/schema";

export default function Home() {
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"evaluate" | "library">("evaluate");
  const [showSave, setShowSave] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function evaluate(input: string) {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Evaluation failed.");
      setResult(data as EvaluationResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed.");
    } finally {
      setLoading(false);
    }
  }

  function refine() {
    if (!result) return;
    const revised = result.evaluation.revised_prompt;
    setDraft(revised);
    setResult(null);
    void evaluate(revised);
  }

  function discard() {
    setResult(null);
    setSavedMsg(null);
  }

  async function save(payload: SavePayload) {
    if (!result) return;
    try {
      await addEntry({
        name: payload.name,
        category: payload.category,
        tags: payload.tags,
        original_prompt: draft,
        revised_prompt: result.evaluation.revised_prompt,
        scorecard: result.evaluation.scorecard,
        overall_score: result.overall_score,
        priority_fix: result.evaluation.priority_fix,
      });
      setShowSave(false);
      setSavedMsg(`Saved "${payload.name}".`);
    } catch {
      setError("Could not save to your library. Please try again.");
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    location.href = "/login";
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Prompt<span className="text-violet-400">Forge</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Score, revise, and save your prompts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === "evaluate" ? "library" : "evaluate")}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            {view === "evaluate" ? "Library" : "← Evaluate"}
          </button>
          <button
            onClick={signOut}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 transition hover:border-slate-600 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      {view === "library" ? (
        <Library onBack={() => setView("evaluate")} />
      ) : (
        <div className="space-y-6">
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void evaluate(draft);
              }}
              placeholder="Paste a draft prompt…  (⌘/Ctrl + Enter to evaluate)"
              rows={6}
              className="w-full resize-y rounded-xl border border-slate-800 bg-slate-900/40 p-4 font-mono text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-500"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => void evaluate(draft)}
                disabled={loading || !draft.trim()}
                className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Evaluating…" : "Evaluate"}
              </button>
              {savedMsg && <span className="text-sm text-emerald-400">{savedMsg}</span>}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <Scorecard result={result} />
              <RevisedPrompt text={result.evaluation.revised_prompt} />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowSave(true)}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  Save
                </button>
                <button
                  onClick={refine}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-600"
                >
                  Refine
                </button>
                <button
                  onClick={discard}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition hover:text-white"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showSave && result && (
        <SaveDialog
          defaultCategory={result.evaluation.suggested_category}
          defaultTags={result.evaluation.suggested_tags}
          onSave={save}
          onClose={() => setShowSave(false)}
        />
      )}
    </main>
  );
}
