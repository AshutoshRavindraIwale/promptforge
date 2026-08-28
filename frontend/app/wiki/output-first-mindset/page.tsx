// First article in the wiki: the reasoning behind what the rubrics grade. /how-to-use explains
// how to drive the app; this explains why the rewrites look the way they do, so the habit
// survives outside PromptForge.
//
// Public (see proxy.ts) and a server component: the content is static, and the rubric
// dimensions are read from lib/frameworks.ts rather than retyped, so renaming one updates the
// article with it.
import Link from "next/link";
import { DEFAULT_FRAMEWORK_ID, getFramework } from "@/lib/frameworks";

export const metadata = {
  title: "Output-first prompting",
  description:
    "Describe what you want back before you describe the work — the habit behind most good prompts.",
};

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
const prompt =
  "rounded-2xl border border-line bg-surface px-5 py-4 font-mono text-[13px] leading-[1.7] text-ink";

// The five things a draft most often leaves for the model to guess.
const NAME_THESE = [
  {
    t: "The artifact",
    d: "A summary, a table, an email, a checklist, a commit message. Name the thing, not just the topic.",
  },
  {
    t: "The length",
    d: "Words, sentences, or bullets. Short is not a length — it is a hope.",
  },
  {
    t: "The reader",
    d: "An expert skims for the claim. A beginner needs the terms defined. The same facts become two different documents.",
  },
  {
    t: "The shape",
    d: "Headings, bullets, prose, JSON. If something downstream has to parse it, say so here.",
  },
  {
    t: "The exclusions",
    d: "What to leave out is often worth more than what to include. No preamble, no opinions, no caveats.",
  },
];

export default function OutputFirst() {
  // Mapping the idea back onto the default rubric, by the dimension names the app actually uses.
  const dimensions = getFramework(DEFAULT_FRAMEWORK_ID).dimensions;
  const named = (key: string) =>
    dimensions.find((d) => d.key === key)?.name ?? key;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-6">
      <header className="flex flex-col items-center text-center">
        <span className="size-2.5 rotate-45 rounded-[1px] bg-ember" />
        <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
          Wiki
        </p>
        <h1 className="mt-2 text-[28px] font-light tracking-[-0.01em] text-ink">
          Output-first prompting
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-2">
          Describe what you want back before you describe the work. It is the
          highest-leverage habit in prompting, and the one most drafts skip.
        </p>
      </header>

      <Section title="The habit that costs you">
        <p>
          Most prompts name a task and stop. &ldquo;Write a summary of this
          article.&rdquo; That sentence says what to do and almost nothing about
          what to hand back: how long, for whom, in what shape, with what left
          out. Every one of those is still a decision, so the model makes it for
          you.
        </p>
        <p>
          When it guesses differently than you would have, you reword and run it
          again. That is the retry loop — and it is not a model problem. The
          request was underspecified before it was ever sent.
        </p>
      </Section>

      <Section title="Turn the prompt around">
        <p>
          Output-first means the artifact comes first and the verb comes second.
          Before you write <span className="text-ink">summarize</span>, decide
          what the summary <em>is</em>.
        </p>
        <div className={prompt}>
          <span className="text-ink-3">Task-first — the model decides:</span>
          <br />
          Write a summary of this article.
        </div>
        <div className={prompt}>
          <span className="text-ink-3">Output-first — you decide:</span>
          <br />
          Write a 120&ndash;150 word summary for a technical reader. Cover the
          core claim, the evidence, and one limitation. Neutral tone, no
          opinions, no heading.
        </div>
        <p>
          The task did not change. Everything added describes the thing coming
          back.
        </p>
      </Section>

      <Section title="Five things worth naming">
        <ul className="space-y-2.5">
          {NAME_THESE.map((n) => (
            <li key={n.t} className={card}>
              <span className="text-[15px] font-medium text-ink">{n.t}</span>
              <span className="mt-1 block text-sm text-ink-3">{n.d}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Why it works">
        <p>
          A language model continues the most likely text. A task with no
          described output leaves an enormous space of plausible answers, and it
          will pick one — usually the most generic, because generic is what is
          most likely.
        </p>
        <p>
          Naming the artifact collapses that space before a single word is
          generated. You are not making the model smarter. You are making the
          target smaller.
        </p>
      </Section>

      <Section title="What PromptForge is checking">
        <p>
          This is not a separate technique bolted onto the app — it is most of
          what the default rubric grades. Four of its dimensions are output-first
          questions wearing different hats:
        </p>
        <ul className="space-y-1.5">
          <li className="text-sm text-ink-3">
            <span className="text-ink">{named("clarity")}</span> — is the reader
            named, and the length?
          </li>
          <li className="text-sm text-ink-3">
            <span className="text-ink">{named("guidelines")}</span> — is it clear
            what to include, and what to leave out?
          </li>
          <li className="text-sm text-ink-3">
            <span className="text-ink">{named("structure")}</span> — is the shape
            of the answer specified?
          </li>
          <li className="text-sm text-ink-3">
            <span className="text-ink">{named("examples")}</span> — is there an
            anchor for what good looks like?
          </li>
        </ul>
        <p>
          When a scorecard comes back with a Poor on one of those, it is usually
          saying the same thing: you described the work, not the result.
        </p>
      </Section>

      <Section title="When to hold back">
        <p>
          This is a habit, not a law. If you are exploring — brainstorming
          names, hunting for an angle you have not had yet — specifying the
          artifact narrows exactly the thing you wanted wide. Pin the format so
          the answer is usable, and leave the content open.
        </p>
        <p>
          And do not invent constraints you do not have. A length you made up is
          still a constraint the model will honour, and it will drop something
          real to hit it. Specify what you actually need; leave the rest alone.
        </p>
      </Section>

      <div className="mt-14 flex flex-col items-center gap-4 border-t border-line pt-10">
        <p className="max-w-md text-center text-[15px] text-ink-2">
          The fastest way to feel the difference is to forge a prompt you have
          already written and read what it adds.
        </p>
        <Link
          href="/login"
          className="rounded-full bg-ember px-6 py-3 text-[13px] font-medium text-bg transition hover:brightness-110"
        >
          Sign in and try it
        </Link>
        <Link
          href="/how-to-use"
          className="text-sm text-ink-3 underline decoration-line underline-offset-4 transition-colors hover:text-ink"
        >
          New here? Start with the guide
        </Link>
      </div>
    </main>
  );
}
