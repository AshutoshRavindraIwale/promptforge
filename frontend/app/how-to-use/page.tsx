// The public "how to use" guide. Reachable while signed out (see proxy.ts) so someone who lands
// on the app — or arrives from the repo — can understand what it does before they have access,
// and so a signed-in user waiting on the allowlist has something to read.
//
// Server component: the content is static, and the framework list is derived from
// lib/frameworks.ts rather than retyped, so adding a framework updates this page with it.
import Link from "next/link";
import { FRAMEWORKS, type Framework } from "@/lib/frameworks";
import type { Score } from "@/lib/schema";

export const metadata = {
  title: "How to use PromptForge",
  description:
    "A plain-language guide to scoring, refining, and reusing your prompts.",
};

// Grouped for a newcomer: what you are making, not how the code classifies it. Healthcare and
// the other rubrics with no `kind` are text prompts, so they sit in the first group.
const GROUPS: { label: string; blurb: string; match: (f: Framework) => boolean }[] = [
  {
    label: "Writing, chat, and work",
    blurb: "Everyday prompts you send to a chatbot.",
    match: (f) => !f.kind,
  },
  {
    label: "AI agents",
    blurb: "Instructions for an AI that acts on its own or uses tools.",
    match: (f) => f.kind === "agent",
  },
  {
    label: "Images",
    blurb: "Prompts for a picture generator.",
    match: (f) => f.kind === "image",
  },
  {
    label: "Video",
    blurb: "Prompts for a video generator.",
    match: (f) => f.kind === "video",
  },
];

// The same four grades the scorecard uses, in the same colours, explained in plain words.
const GRADES: { score: Score; className: string; meaning: string }[] = [
  {
    score: "Poor",
    className: "text-grade-poor",
    meaning: "Missing. The AI has to guess, and it often guesses wrong.",
  },
  {
    score: "Needs Work",
    className: "text-grade-fair",
    meaning: "Partly there, but too vague to rely on.",
  },
  {
    score: "Good",
    className: "text-grade-good",
    meaning: "Clear enough to work. Could be sharper.",
  },
  {
    score: "Excellent",
    className: "text-grade-excellent",
    meaning: "Nothing important left to the AI's imagination.",
  },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Do I need to know anything about prompt engineering?",
    a: "No — that is the whole point. You write your prompt the way you normally would, and PromptForge tells you what is missing and writes the better version for you.",
  },
  {
    q: "Do I need an API key?",
    a: (
      <>
        Not usually. If the person running the app set one up, it just works.
        You can add your own key later under the key icon in the header, and it
        stays in your browser.
      </>
    ),
  },
  {
    q: "Who can see my prompts?",
    a: "Only you. Anything you save goes to your own library — other signed-in people cannot see it.",
  },
  {
    q: "Can I speak instead of typing?",
    a: "Yes. The microphone button next to the prompt box types out what you say.",
  },
  {
    q: "Does it change my prompt without asking?",
    a: "Never. You always get the scorecard and the rewrite side by side, and you choose whether to use it, refine it again, or ignore it.",
  },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <h2 className="text-[19px] font-medium tracking-[-0.01em] text-ink">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-2">
        {children}
      </div>
    </section>
  );
}

const card = "rounded-2xl border border-line bg-surface px-5 py-4";

export default function HowToUse() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-6">
      <header className="flex flex-col items-center text-center">
        <span className="size-2.5 rotate-45 rounded-[1px] bg-ember" />
        <h1 className="mt-5 text-[28px] font-light tracking-[-0.01em] text-ink">
          How to use PromptForge
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-2">
          PromptForge reads the instructions you give an AI and rewrites them so
          you get a good answer the first time — instead of asking again and
          again.
        </p>
      </header>

      <Section title="The problem it solves">
        <p>
          When an answer comes back wrong, the usual fix is to reword the
          question and try again. Most people repeat that four or five times.
          The reason is almost always the same: the original request left out
          something the AI needed — who it is for, how long it should be, what
          to leave out.
        </p>
        <p>
          PromptForge fixes the request instead of the answer, so you stop
          paying for the retries.
        </p>
      </Section>

      <Section title="Three steps">
        <ol className="space-y-3">
          {[
            {
              t: "Paste your prompt",
              d: "Type or paste whatever you were going to send the AI. Rough is fine — rough is the point.",
            },
            {
              t: "Press Forge it",
              d: "You get a scorecard grading your prompt line by line, the single most useful fix, and a rewritten version.",
            },
            {
              t: "Use the rewrite",
              d: "Copy it into ChatGPT, Claude, or wherever you were headed. Or save it so you never have to write it again.",
            },
          ].map((s, i) => (
            <li key={s.t} className={`${card} flex gap-4`}>
              <span className="font-mono text-xs text-ember">{i + 1}</span>
              <span>
                <span className="block text-[15px] font-medium text-ink">
                  {s.t}
                </span>
                <span className="mt-1 block text-sm text-ink-3">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="What that looks like">
        <p>A real example. Before:</p>
        <p className={`${card} font-mono text-[13px] leading-relaxed text-ink`}>
          Write a summary of this article.
        </p>
        <p>
          Nothing here says who reads it, how long it should be, or what to
          leave out — so the AI decides all three for you. After:
        </p>
        <p className={`${card} font-mono text-[13px] leading-relaxed text-ink`}>
          Summarize the article below for a technical audience in 120&ndash;150
          words. Cover the core claim, the evidence, and one limitation. Neutral
          tone, no opinions. Output as 3&ndash;4 sentences, no heading.
        </p>
        <p>
          Same request, but nothing important is left to chance. That is the
          whole job.
        </p>
      </Section>

      <Section title="Picking a framework">
        <p>
          A framework is just a checklist for what makes a good prompt of a
          particular kind. A prompt for a picture is judged on different things
          than a prompt for a chatbot, so PromptForge keeps one checklist per
          job.
        </p>
        <p>
          <span className="text-ink">You do not have to choose.</span> Leave it
          on the default, or click{" "}
          <span className="text-ink">Suggest a framework</span> and it reads
          your draft and picks one for you.
        </p>
        <div className="space-y-4 pt-1">
          {GROUPS.map((g) => {
            const items = FRAMEWORKS.filter(g.match);
            if (items.length === 0) return null;
            return (
              <div key={g.label} className={card}>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {g.label}
                </p>
                <p className="mt-1.5 text-sm text-ink-2">{g.blurb}</p>
                <ul className="mt-3 space-y-1.5">
                  {items.map((f) => (
                    <li key={f.id} className="text-sm text-ink-3">
                      <span className="text-ink">{f.name}</span> — {f.tagline}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Reading the scorecard">
        <p>
          Each row is one thing that makes a prompt work. Every row gets one of
          four grades:
        </p>
        <ul className={`${card} space-y-2.5`}>
          {GRADES.map((g) => (
            <li key={g.score} className="flex flex-wrap items-baseline gap-x-3">
              <span
                className={`font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${g.className}`}
              >
                {g.score}
              </span>
              <span className="text-sm text-ink-3">{g.meaning}</span>
            </li>
          ))}
        </ul>
        <p>
          Some rows are marked <span className="text-ink">required</span>. If
          one of those is Poor, the overall grade cannot rise above Needs Work,
          however good the other rows are — because a prompt missing something
          essential is not a good prompt with one flaw, it is a prompt that will
          not work.
        </p>
        <p>
          You will also get a{" "}
          <span className="text-ink">priority fix</span>: if you only change one
          thing, change that.
        </p>
      </Section>

      <Section title="After the rewrite">
        <ul className="space-y-2.5">
          {[
            [
              "Save to library",
              "Keep it. Your library is searchable, so a prompt you got right once is a prompt you never write again.",
            ],
            [
              "Refine again",
              "Not quite right? Add a note like “make it shorter” and run it through once more.",
            ],
            [
              "Test",
              "Run your original and the rewrite side by side on real input and see the difference for yourself.",
            ],
            [
              "Open in…",
              "Copies the rewrite and opens a blank chat in Claude, ChatGPT, Gemini, or Perplexity. Paste and go.",
            ],
          ].map(([t, d]) => (
            <li key={t} className={card}>
              <span className="text-[15px] font-medium text-ink">{t}</span>
              <span className="mt-1 block text-sm text-ink-3">{d}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Common questions">
        <dl className="space-y-4">
          {FAQ.map((item) => (
            <div key={item.q} className={card}>
              <dt className="text-[15px] font-medium text-ink">{item.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink-3">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Go deeper">
        <p>
          The guide above is how to drive the app. If you want the habit behind
          it — the one that makes a prompt good before PromptForge ever sees it
          — start here:
        </p>
        <Link
          href="/wiki/output-first-mindset"
          className={`${card} block transition-colors hover:border-ink-3`}
        >
          <span className="text-[15px] font-medium text-ink">
            Output-first prompting
          </span>
          <span className="mt-1 block text-sm text-ink-3">
            Describe what you want back before you describe the work.
          </span>
        </Link>
      </Section>

      <div className="mt-14 flex flex-col items-center gap-4 border-t border-line pt-10">
        <p className="text-center text-[15px] text-ink-2">
          That is everything. The rest you learn by forging one.
        </p>
        <Link
          href="/login"
          className="rounded-full bg-ember px-6 py-3 text-[13px] font-medium text-bg transition hover:brightness-110"
        >
          Sign in and try it
        </Link>
      </div>
    </main>
  );
}
