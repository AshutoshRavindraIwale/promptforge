"use client";

import { useEffect, useState } from "react";
import { Scorecard } from "@/components/Scorecard";
import { RevisedPrompt } from "@/components/RevisedPrompt";
import { SaveDialog, type SavePayload } from "@/components/SaveDialog";
import { RefineDialog } from "@/components/RefineDialog";
import { Library } from "@/components/Library";
import { EvaluatingState } from "@/components/EvaluatingState";
import { TestDrawer } from "@/components/TestDrawer";
import { SignOutButton } from "@/components/SignOutButton";
import { FrameworkSelect } from "@/components/FrameworkSelect";
import { SuggestFramework } from "@/components/SuggestFramework";
import { MicButton } from "@/components/MicButton";
import { SettingsDialog } from "@/components/SettingsDialog";
import { OpenInProviders } from "@/components/OpenInProviders";
import { Tour, type TourStep } from "@/components/Tour";
import { addEntry } from "@/lib/library";
import { keyHeaders } from "@/lib/apiKeys";
import { hasSeenTour, markTourSeen } from "@/lib/tour";
import {
  DEFAULT_FRAMEWORK_ID,
  getFramework,
  supportsProviderHandoff,
  supportsTest,
  type Framework,
} from "@/lib/frameworks";
import { parsePartialJson } from "@/lib/partialJson";
import { SCORES, type Dimension, type EvaluationResult, type Score } from "@/lib/schema";

/** The half-written evaluation rendered while the model is still generating. */
type PartialEvaluation = {
  scorecard: Dimension[];
  revised_prompt?: string;
};

/**
 * Reshape the JSON the model has written so far into something renderable. Dimensions are
 * emitted keyed, so they're mapped back into the framework's canonical order; a dimension is
 * only shown once all three of its fields have arrived, which keeps rows from appearing with
 * a half-typed score like `"Goo"` that no grade colour matches.
 */
function toPartial(json: string, framework: Framework): PartialEvaluation | null {
  const obj = parsePartialJson(json);
  if (!obj) return null;

  const keyed = (obj.scorecard ?? {}) as Record<string, Partial<Dimension>>;
  const scorecard = framework.dimensions
    .map((d) => ({ key: d.key, name: d.name, ...(keyed[d.key] ?? {}) }))
    .filter(
      (d): d is Dimension =>
        SCORES.includes(d.score as Score) &&
        typeof d.assessment === "string" &&
        typeof d.advice === "string",
    );

  return {
    scorecard,
    revised_prompt:
      typeof obj.revised_prompt === "string" ? obj.revised_prompt : undefined,
  };
}

// The four things a first-time user won't discover on their own. The core loop (paste →
// Forge it) is self-evident from the empty state, so the tour doesn't narrate it.
const TOUR_STEPS: TourStep[] = [
  {
    target: "framework",
    title: "Pick a framework",
    body: "Every framework grades with its own rubric — video and agent prompts included. Not sure which fits? “Suggest a framework” reads your draft and recommends one.",
  },
  {
    target: "draft",
    title: "Drop in a rough prompt",
    body: "Type, paste, or dictate with the mic — then hit Forge it. The scorecard streams in with a priority fix and a ready-to-use rewrite.",
  },
  {
    target: "library",
    title: "Your prompt library",
    body: "Prompts you save land here — searchable, reusable, and ready to refine again as your needs change.",
  },
  {
    target: "keys",
    title: "Bring your own keys",
    body: "Add your Claude and Groq keys to spend your own quota. They're stored only in this browser.",
  },
];

// One click to a first wow: fills the draft with a famously vague prompt so a new user can
// forge something real in seconds instead of composing a draft first.
const EXAMPLE_PROMPT = "Make me a workout plan.";

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
  // The in-flight preview. Cleared when the authoritative result lands, so what the user ends
  // up acting on is always the validated evaluation, never the best-effort partial parse.
  const [partial, setPartial] = useState<PartialEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"evaluate" | "library">("evaluate");
  // Once a forge starts, the editor collapses to a one-line summary so the results own the
  // viewport; "Edit" re-expands it. Reset on every forge so refine loops re-collapse.
  const [editing, setEditing] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);

  // First visit in this browser: offer the tour once. Runs in an effect because localStorage
  // doesn't exist during server rendering; the short delay lets the page settle before the
  // spotlight appears (and satisfies the no-sync-setState-in-effect rule).
  useEffect(() => {
    if (hasSeenTour()) return;
    const t = window.setTimeout(() => setShowTour(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  function closeTour() {
    markTourSeen();
    setShowTour(false);
  }

  async function evaluate(input: string, focus?: string) {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    setSavedMsg(null);
    setPartial(null);
    setEditing(false);
    // A drawer left open from the previous evaluation must not carry over onto the new result.
    setShowTest(false);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...keyHeaders() },
        body: JSON.stringify({ draft: text, framework, focus }),
      });
      // Request-level rejections (auth, validation) still answer with a JSON status code;
      // only once the stream starts does the route report failures in-band.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Evaluation failed.");
      }

      const selected = getFramework(framework);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let json = "";
      let done: EvaluationResult | null = null;

      for (;;) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buffer += decoder.decode(value, { stream: true });

        // NDJSON: complete lines only — the last fragment stays buffered for the next read.
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;

          const msg = JSON.parse(line);
          if (msg.type === "delta") {
            json += msg.text;
            const next = toPartial(json, selected);
            // A chunk we can't parse yet leaves the last good preview on screen.
            if (next) setPartial(next);
          } else if (msg.type === "done") {
            done = msg.result as EvaluationResult;
          } else if (msg.type === "error") {
            throw new Error(msg.error || "Evaluation failed.");
          }
        }
      }

      if (!done) throw new Error("The evaluation ended before it finished. Try again.");
      setResult(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed.");
    } finally {
      setLoading(false);
      setPartial(null);
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

  // The framework that produced THIS result — not the selector state, which the user can change
  // while a result is still on screen. A result with no framework recorded falls back to the
  // default (text), so legacy results keep today's behavior.
  const resultFramework = getFramework(result?.evaluation.framework?.id);

  // Test runs the prompt through a text model, which is meaningless for a video prompt (it would
  // return prose describing a hypothetical clip) and for a tool description (not runnable at all).
  const canTest = !!result && supportsTest(resultFramework);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-5 sm:px-6 sm:py-6">
        <button onClick={() => setView("evaluate")} className="shrink-0 rounded-md">
          <Wordmark />
        </button>
        <nav className="flex items-center sm:gap-1">
          {(
            [
              ["evaluate", "Evaluate"],
              ["library", "Library"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              data-tour={v === "library" ? "library" : undefined}
              onClick={() => setView(v)}
              className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] transition-colors hover:bg-surface hover:text-ink sm:px-3.5 ${
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
            data-tour="keys"
            className="inline-flex items-center justify-center rounded-full p-2 text-ink-3 transition-colors hover:bg-surface hover:text-ink pointer-coarse:size-11 pointer-coarse:p-0"
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
          <SignOutButton className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] text-ink-3 transition-colors hover:bg-surface hover:text-ink sm:px-3.5" />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 sm:px-6">
        {view === "library" ? (
          <Library />
        ) : (
          <>
            {idle && (
              <h1 className="mb-10 mt-20 text-center text-[28px] font-light tracking-[-0.01em] text-ink">
                Refine your prompt.
              </h1>
            )}

            {/* Once a forge is running or a result is on screen, the editor gives up the top of
                the viewport: it collapses to a one-line summary so the scorecard — the thing the
                user is actually reading now — starts above the fold. */}
            {!idle && !editing ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface py-2.5 pl-5 pr-2.5">
                <span className="hidden shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3 sm:block">
                  {getFramework(framework).name}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs leading-none text-ink-2">
                  {draft.trim()}
                </span>
                {loading ? (
                  <span className="flex shrink-0 items-center gap-2 px-2.5 py-1.5 text-xs text-ink-3">
                    <span className="size-1.5 animate-pulse rotate-45 rounded-[1px] bg-ember" />
                    Forging…
                  </span>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-xs text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
                  >
                    Edit
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`rounded-2xl border border-line bg-surface transition-colors focus-within:border-ink-3 ${
                  idle ? "" : "mt-4"
                }`}
              >
                <div data-tour="framework">
                  <FrameworkSelect
                    value={framework}
                    onChange={setFramework}
                    disabled={loading}
                  />
                  <SuggestFramework
                    draft={draft}
                    value={framework}
                    onApply={setFramework}
                    disabled={loading}
                  />
                </div>
                <textarea
                  data-tour="draft"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                      void evaluate(draft);
                  }}
                  placeholder="Paste a rough prompt…"
                  rows={idle ? 6 : 4}
                  autoFocus={editing}
                  className="w-full resize-none bg-transparent px-6 pb-2 pt-5 font-mono text-[13px] leading-[1.7] text-ink outline-none placeholder:text-ink-3"
                />
                <div className="flex items-center justify-between px-4 pb-4">
                  <div className="flex items-center gap-1">
                    <MicButton
                      value={draft}
                      onChange={setDraft}
                      disabled={loading}
                    />
                    {/* Keyboard hint means nothing on a touch screen. */}
                    <span className="hidden text-xs text-ink-3 pointer-fine:inline">
                      ⌘⏎ to forge
                    </span>
                  </div>
                  <button
                    onClick={() => void evaluate(draft)}
                    disabled={loading || !draft.trim()}
                    className="rounded-full bg-ember px-5 py-2 text-[13px] font-medium text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? "Forging…" : "Forge it"}
                  </button>
                </div>
              </div>
            )}

            {idle && !draft.trim() && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setDraft(EXAMPLE_PROMPT)}
                  className="rounded-full border border-line px-4 py-2 text-xs text-ink-3 transition-colors hover:border-ink-3 hover:text-ink"
                >
                  Try an example: “{EXAMPLE_PROMPT}”
                </button>
              </div>
            )}

            {savedMsg && (
              <p className="mt-4 text-center text-sm text-ink-2">{savedMsg}</p>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-grade-poor/30 bg-grade-poor/10 px-4 py-3 text-sm text-grade-poor">
                {error}
              </div>
            )}

            {/* Skeleton only until the first dimension arrives; after that the real
                scorecard fills in row by row and the revised prompt types itself out. */}
            {loading && !partial?.scorecard.length && <EvaluatingState />}

            {loading && !!partial?.scorecard.length && (
              <div className="animate-rise mt-8 space-y-4" aria-busy="true">
                <Scorecard
                  result={{
                    evaluation: {
                      scorecard: partial.scorecard,
                      framework: {
                        id: getFramework(framework).id,
                        name: getFramework(framework).name,
                      },
                    },
                  }}
                />
                {partial.revised_prompt && (
                  <RevisedPrompt text={partial.revised_prompt} />
                )}
              </div>
            )}

            {result && !loading && (
              <div className="animate-rise mt-8 space-y-4">
                <Scorecard result={result} />
                <RevisedPrompt text={result.evaluation.revised_prompt} />
                {/* Sticky within the results flow: pinned to the viewport bottom while the
                    3+ screens of scorecard scroll by, settling into place at the end. Saves
                    the trip to the bottom of the page to act on a result. */}
                <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-line/60 bg-bg/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
                  <button
                    onClick={() => setShowSave(true)}
                    className="rounded-full bg-ember px-5 py-2 text-[13px] font-medium text-bg transition hover:brightness-110"
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
                {/* A tool description lives in a tool schema, not a chat box — no handoff. */}
                {supportsProviderHandoff(resultFramework) && (
                  <OpenInProviders prompt={result.evaluation.revised_prompt} />
                )}
              </div>
            )}
          </>
        )}
      </main>

      {showTest && result && canTest && (
        <TestDrawer
          original={result.evaluation.prompt_evaluated}
          revised={result.evaluation.revised_prompt}
          framework={resultFramework}
          onClose={() => setShowTest(false)}
        />
      )}

      {showRefine && result && (
        <RefineDialog onRefine={refine} onClose={() => setShowRefine(false)} />
      )}

      {showSettings && (
        <SettingsDialog
          onClose={() => setShowSettings(false)}
          onReplayTour={() => {
            // The tour spotlights the evaluate screen, so make sure it's showing.
            setShowSettings(false);
            setView("evaluate");
            setShowTour(true);
          }}
        />
      )}

      {showTour && <Tour steps={TOUR_STEPS} onClose={closeTour} />}

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
