# PromptForge — Web UI

Paste a rough prompt, get it scored on four dimensions with a priority fix and a ready-to-use
rewrite, then test the revision and save it to your library. This is the web front-end for
[PromptForge](../); it mirrors the Python CLI's engine and rubric in TypeScript.

> The Anthropic API key stays server-side, and the paid routes are gated by sign-in **and** an
> email allowlist — so a deployed instance can't be turned into an open Claude proxy.

## Features

- **Four-dimension scoring** — Clarity, Guidelines, Structure, Examples, each with an assessment
  and one actionable fix, plus a single priority fix and a deterministic overall grade (with a
  required-dimension cap).
- **One-call evaluate + rewrite** — a single structured, Zod-validated Claude call returns the
  scorecard and a ready-to-use revised prompt.
- **Refine chains & history** — re-score a rewrite to build a versioned chain; History shows each
  version's score movement and a word-level diff of what changed.
- **Side-by-side test** — run the original and the revised prompt against the same input and
  compare the outputs, not just the scores.
- **Reusable templates** — saved prompts with `[PLACEHOLDER]` fields can be filled in and copied.
- **Personal library** — save, search, and manage prompts, scoped per user by Supabase
  Row-Level Security.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
- `@anthropic-ai/sdk` with structured outputs (Zod) · model `claude-sonnet-4-6`
- Supabase (Postgres + Auth) — persistence and sign-in; Row-Level Security scopes every row to
  its owner

## Prerequisites

- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com)
- A [Supabase](https://supabase.com) project (the free tier is enough)

## Quickstart

```bash
cd frontend
npm install
cp .env.example .env.local     # then fill in the values from the table below
npm run dev                    # http://localhost:3000
```

Then apply the database schema: open your Supabase project's **SQL editor** and run each file in
[`supabase/migrations/`](supabase/migrations/) in order (`0001_runs.sql`, then
`0002_run_titles.sql`), along with the `entries` table the library uses.

## Configuration

All variables live in `frontend/.env.local` (git-ignored). The `NEXT_PUBLIC_` ones are sent to
the browser by design; the rest stay server-side.

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Server-side key for the evaluate/test routes. Never exposed to the browser. |
| `ALLOWED_EMAILS` | yes | Comma-separated allowlist of emails permitted to use the paid routes. **Fails closed** — if unset, every request is rejected (you'll be signed in but get a 403). |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key (public by design; Row-Level Security does the isolation). |

## How it works

A signed-in request to `/api/evaluate` makes one structured Claude call (`lib/engine.ts`) that
both scores and rewrites the draft. The overall grade is computed deterministically on the server
(`lib/scoring.ts`) — never taken from the model. The result is recorded to Supabase and rendered
as a scorecard plus a revised prompt.

Access is enforced in two places: `proxy.ts` redirects unauthenticated *page* requests to
`/login`, and the *API* routes call `lib/auth.ts` (`denyUnauthorized`) to check both sign-in and
the allowlist before spending the key — returning 401/403 JSON that the client renders inline.

## Project layout

```
app/
  page.tsx                 main screen: input → scorecard → Save / Refine / Test / Discard
  layout.tsx               root layout + metadata (dark theme; system font stack)
  error.tsx                app-wide error boundary
  globals.css              Tailwind v4 + theme tokens
  login/page.tsx           Google + magic-link sign-in
  auth/callback/route.ts   OAuth / magic-link code exchange
  api/evaluate/route.ts    server handler: auth + allowlist, calls the engine
  api/test/route.ts        run a prompt against a sample input (side-by-side test)
lib/
  engine.ts                SYSTEM_PROMPT + Anthropic structured call (server-only)
  schema.ts                Zod Evaluation / Scorecard / Dimension (mirrors promptforge/schema.py)
  scoring.ts               overallScore() incl. required-dimension cap (port of scoring.py)
  model.ts                 shared Claude model id
  auth.ts                  sign-in + allowlist gate for the API routes
  library.ts               Supabase CRUD + search for saved prompts
  history.ts               Supabase CRUD for evaluation runs + refine-chain grouping
  template.ts, diff.ts     placeholder fill-in / word-level diff
  supabase/                browser + server Supabase clients
components/                 Scorecard, RevisedPrompt, SaveDialog, Library, History,
                           TestDrawer, DiffView, UseTemplateDialog, Markdown, Modal
proxy.ts                   Next "proxy" (middleware): session refresh + auth redirect
supabase/migrations/       SQL to create the runs table (apply in your Supabase project)
```

## Security

- The Anthropic key is read only on the server (never `NEXT_PUBLIC_`), so it never reaches the
  browser.
- `/api/evaluate` and `/api/test` require a signed-in **and** allowlisted user, and reject
  anonymous callers with 401. The allowlist fails closed.
- Per-call input is capped at 20,000 characters to bound token cost.
- Supabase Row-Level Security scopes every `runs`/`entries` row to `auth.uid()`, so users only
  ever see their own data.
- Conservative security headers (`X-Frame-Options: DENY`, `nosniff`, referrer and permissions
  policy) are set in `next.config.ts`.

## Scripts

```bash
npm run dev      # start the dev server
npm run build    # production build (type-checks)
npm run lint     # ESLint — run this in CI; `next build` no longer lints in Next 16
npm start        # serve the production build
```

## Deploy (Vercel)

Import the repo → set **Root Directory = `frontend`** → add `ANTHROPIC_API_KEY`,
`ALLOWED_EMAILS`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` → deploy. In the
Supabase dashboard, set the Auth redirect/allowed URLs to your deployed origin. `npm run build`
must pass first.

## Troubleshooting

- **Signed in, but every evaluation returns 403 "Access isn't configured."** `ALLOWED_EMAILS` is
  unset or doesn't include your address. Add it (comma-separated) and restart the dev server.
- **History says the runs table is missing.** Run the SQL in `supabase/migrations/` in your
  Supabase project's SQL editor.
