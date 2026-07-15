"use client";

import { useState } from "react";
import { testPrompt } from "@/lib/testPrompt";
import { fillTemplate } from "@/lib/template";
import { Markdown } from "./Markdown";
import { Modal } from "./Modal";

type PaneState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; output: string }
  | { status: "error"; message: string };

function OutputPane({
  label,
  state,
}: {
  label: string;
  state: PaneState;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (state.status !== "done") return;
    try {
      await navigator.clipboard.writeText(state.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; ignore
    }
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-bg/40">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
          {label}
        </span>
        {state.status === "done" && (
          <button
            onClick={copy}
            className="rounded-full px-2.5 py-0.5 text-xs text-ink-3 transition-colors hover:bg-raised hover:text-ink"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.status === "loading" ? (
          <div className="space-y-2.5 px-4 py-4">
            <span className="skeleton block h-2.5 w-full" />
            <span className="skeleton block h-2.5 w-11/12" />
            <span className="skeleton block h-2.5 w-full" />
            <span className="skeleton block h-2.5 w-3/5" />
          </div>
        ) : state.status === "error" ? (
          <p className="px-4 py-4 text-sm text-grade-poor">{state.message}</p>
        ) : state.status === "done" ? (
          <div className="px-4 py-4">
            <Markdown text={state.output} />
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-ink-3">
            Output appears here after you run the test.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Side-by-side test: run the original draft and the revised prompt against the same
 * sample input, so the user can judge whether the revision actually produces better
 * output — not just a better score.
 */
export function TestDrawer({
  original,
  revised,
  onClose,
}: {
  original: string;
  revised: string;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [left, setLeft] = useState<PaneState>({ status: "idle" });
  const [right, setRight] = useState<PaneState>({ status: "idle" });

  const running = left.status === "loading" || right.status === "loading";

  function runSide(
    prompt: string,
    setState: (s: PaneState) => void,
  ): Promise<void> {
    setState({ status: "loading" });
    // Unfilled [PLACEHOLDER]s stay as-is: the model sees them and improvises, which
    // is also what would happen if the user pasted the template somewhere untouched.
    return testPrompt(fillTemplate(prompt, {}), input.trim()).then(
      (output) => setState({ status: "done", output }),
      (e: unknown) =>
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Test failed.",
        }),
    );
  }

  function run() {
    if (running) return;
    // Fire both sides in parallel; each pane settles (or errors) independently.
    void runSide(original, setLeft);
    void runSide(revised, setRight);
  }

  return (
    <Modal
      onClose={onClose}
      labelledBy="test-drawer-title"
      className="animate-rise flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-line bg-surface shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
    >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 id="test-drawer-title" className="text-base font-medium text-ink">
              Does the revision actually help?
            </h2>
            <p className="mt-0.5 text-xs text-ink-3">
              Both prompts run against the same input — compare the outputs
              yourself.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="border-b border-line px-6 py-3.5">
          {showInput && (
            <textarea
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste a sample input for the prompts to work on…"
              rows={3}
              className="mb-3 w-full resize-none rounded-xl border border-line bg-raised px-4 py-3 font-mono text-xs leading-[1.7] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3"
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setShowInput(!showInput)}
              className="rounded-full px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-raised hover:text-ink"
            >
              {showInput
                ? "Hide sample input"
                : input.trim()
                  ? "Edit sample input"
                  : "+ Add sample input"}
            </button>
            <span className="flex items-center gap-3">
              {!showInput && !input.trim() && (
                <span className="hidden text-xs text-ink-3 sm:block">
                  No input needed if the prompt stands alone.
                </span>
              )}
              <button
                onClick={run}
                disabled={running}
                className="rounded-full bg-ember px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running
                  ? "Running…"
                  : left.status === "idle"
                    ? "Run test"
                    : "Run again"}
              </button>
            </span>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2">
          <OutputPane label="Original" state={left} />
          <OutputPane label="Revised" state={right} />
        </div>
    </Modal>
  );
}
