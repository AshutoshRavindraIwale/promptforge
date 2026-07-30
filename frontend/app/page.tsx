"use client";

import { useState } from "react";
import { Scorecard } from "@/components/Scorecard";
import { RevisedPrompt } from "@/components/RevisedPrompt";
import { SaveDialog, type SavePayload } from "@/components/SaveDialog";
import { RefineDialog } from "@/components/RefineDialog";
import { Library } from "@/components/Library";
import { EvaluatingState } from "@/components/EvaluatingState";
import { TestDrawer } from "@/components/TestDrawer";
import { SignOutButton } from "@/components/SignOutButton";
import { FrameworkSelect } from "@/components/FrameworkSelect";
import { MicButton } from "@/components/MicButton";
import { SettingsDialog } from "@/components/SettingsDialog";
import { OpenInProviders } from "@/components/OpenInProviders";
import { addEntry } from "@/lib/library";
import { keyHeaders } from "@/lib/apiKeys";
import {
  DEFAULT_FRAMEWORK_ID,
  getFramework,
  isVideoFramework,
} from "@/lib/frameworks";
import type { EvaluationResult } from "@/lib/schema";

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 text-[15px] font-medium tracking-[-0.01em] text-ink">
      <span className="size-2 rotate-45 rounded-[1px] bg-ember" />
      PromptForge
    </span>
  );
}

export default function Home() {
  const [draft, setDraft] = useState("");
  const [framework, setFramework] = useState(DEFAULT_FRAMEWORK_ID);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"evaluate" | "library">("evaluate");
  const [showSave, setShowSave] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function evaluate(input: string, focus?: string) {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    setSavedMsg(null);
    // A drawer left open from the previous evaluation must not carry over onto the new result.
    setShowTest(false);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...keyHeaders() },
        body: JSON.stringify({ draft: text, framework, focus }),
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

  function refine(focus: string) {
    if (!result) return;
    const revised = result.evaluation.revised_prompt;
    setDraft(revised);
    setResult(null);
    setShowRefine(false);
    void evaluate(revised, focus || undefined);
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
      setSavedMsg(`Saved "${payload.name}" to your library.`);
    } catch {
      setError("Could not save to your library. Please try again.");
    }
  }

  const idle = view === "evaluate" && !result && !loading;

  // Test runs the prompt through a text model, which is meaningless for a video prompt — it would
  // return prose describing a hypothetical clip. Keyed off the framework that produced THIS
  // result rather than the `framework` selector state, which the user can change while a result
  // is still on screen. A result with no framework recorded falls back to the default (text), so
  // legacy results keep their Test button.
  const canTest =
    !!result && !isVideoFramework(getFramework(result.evaluation.framework?.id));

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6">
        <button onClick={() => setView("evaluate")} className="rounded-md">
          <Wordmark />
        </button>
        <nav className="flex items-center gap-1">
          {(
            [
              ["evaluate", "Evaluate"],
              ["library", "Library"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors hover:bg-surface hover:text-ink ${
                view === v ? "text-ink" : "text-ink-2"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setShowSettings(true)}
            aria-label="API key settings"
            title="API keys"
            className="rounded-full p-2 text-ink-3 transition-colors hover:bg-surface hover:text-ink"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="7.5" cy="15.5" r="4.5" />
              <path d="M10.85 12.15 19 4" />
              <path d="M18 5l2 2" />
              <path d="M15 8l2 2" />
            </svg>
          </button>
          <SignOutButton className="rounded-full px-3.5 py-1.5 text-[13px] text-ink-3 transition-colors hover:bg-surface hover:text-ink" />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-28">
        {view === "library" ? (
          <Library />
        ) : (
          <>
            {idle && (
              <h1 className="mb-10 mt-20 text-center text-[28px] font-light tracking-[-0.01em] text-ink">
                Refine your prompt.
              </h1>
            )}

            <div
              className={`rounded-2xl border border-line bg-surface transition-colors focus-within:border-ink-3 ${
                idle ? "" : "mt-4"
              }`}
            >
              <FrameworkSelect
                value={framework}
                onChange={setFramework}
                disabled={loading}
              />
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                    void evaluate(draft);
                }}
                placeholder="Paste a rough prompt…"
                rows={idle ? 6 : 4}
                className="w-full resize-none bg-transparent px-6 pb-2 pt-5 font-mono text-[13px] leading-[1.7] text-ink outline-none placeholder:text-ink-3"
              />
              <div className="flex items-center justify-between px-4 pb-4">
                <div className="flex items-center gap-1">
                  <MicButton
                    value={draft}
                    onChange={setDraft}
                    disabled={loading}
                  />
                  <span className="text-xs text-ink-3">⌘⏎ to forge</span>
                </div>
                <button
                  onClick={() => void evaluate(draft)}
                  disabled={loading || !draft.trim()}
                  className="rounded-full bg-ember px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Forging…" : "Forge it"}
                </button>
              </div>
            </div>

            {savedMsg && (
              <p className="mt-4 text-center text-sm text-ink-2">{savedMsg}</p>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-grade-poor/30 bg-grade-poor/10 px-4 py-3 text-sm text-grade-poor">
                {error}
              </div>
            )}

            {loading && <EvaluatingState />}

            {result && !loading && (
              <div className="animate-rise mt-8 space-y-4">
                <Scorecard result={result} />
                <RevisedPrompt text={result.evaluation.revised_prompt} />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setShowSave(true)}
                    className="rounded-full bg-ember px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-110"
                  >
                    Save to library
                  </button>
                  <button
                    onClick={() => setShowRefine(true)}
                    className="rounded-full border border-line px-4 py-2 text-[13px] text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
                  >
                    Refine again
                  </button>
                  {canTest && (
                    <button
                      onClick={() => setShowTest(true)}
                      className="rounded-full border border-line px-4 py-2 text-[13px] text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
                    >
                      Test
                    </button>
                  )}
                  <button
                    onClick={discard}
                    className="rounded-full px-4 py-2 text-[13px] text-ink-3 transition-colors hover:text-ink"
                  >
                    Discard
                  </button>
                </div>
                <OpenInProviders prompt={result.evaluation.revised_prompt} />
              </div>
            )}
          </>
        )}
      </main>

      {showTest && result && canTest && (
        <TestDrawer
          original={result.evaluation.prompt_evaluated}
          revised={result.evaluation.revised_prompt}
          onClose={() => setShowTest(false)}
        />
      )}

      {showRefine && result && (
        <RefineDialog onRefine={refine} onClose={() => setShowRefine(false)} />
      )}

      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} />
      )}

      {showSave && result && (
        <SaveDialog
          defaultName={result.evaluation.suggested_title}
          defaultCategory={result.evaluation.suggested_category}
          defaultTags={result.evaluation.suggested_tags}
          onSave={save}
          onClose={() => setShowSave(false)}
        />
      )}
    </div>
  );
}
