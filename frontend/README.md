# PromptForge — Web UI

Paste a rough prompt, pick a framework, get a streamed scorecard with a priority fix and a
ready-to-use rewrite, then test the revision and save it to your library. This is the
PromptForge app; the repo root's [README](../README.md) has the 5-minute quick start.

> The Anthropic API key stays server-side (or per-browser via Settings), and the paid routes
> are gated by sign-in **and** an email allowlist — so a deployed instance can't be turned
> into an open Claude proxy.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
- `@anthropic-ai/sdk` with structured outputs (Zod) · model `claude-sonnet-4-6`
- Supabase (Postgres + Auth) — sign-in and the prompt library, with Row-Level Security
- Groq (Whisper) — optional, powers the mic dictation

## Setup

Prerequisites: Node 20+, a free [Supabase](https://supabase.com) project.

```bash
cd frontend
npm install
cp .env.example .env.local
```

**1. Configure `.env.local`** (all variables documented below — three are required).

**2. Apply the database schema:** open your Supabase project's **SQL Editor**, paste the
contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. It creates the `entries`
table, its search trigger, and the Row-Level Security policies. Idempotent — safe to re-run.

**3. Run:**

```bash
npm run dev        # http://localhost:3000
```

**4. Sign in.** Email **magic link** works on a fresh Supabase project with no configuration —
Supabase sends the email itself. The **Google** button additionally requires an OAuth client
configured under Supabase **Authentication → Providers → Google**
([guide](https://supabase.com/docs/guides/auth/social-login/auth-google)).

## Configuration

All variables live in `frontend/.env.local` (git-ignored). The `NEXT_PUBLIC_` ones are sent to
the browser by design; the rest stay server-side.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **yes** | Supabase project URL — dashboard → **Settings → API**. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **yes** | Supabase anon key (public by design; Row-Level Security does the isolation). |
| `ALLOWED_EMAILS` | **yes** | Comma-separated emails permitted to use the paid routes. **Fails closed** — unset means every request is rejected. Signed-in users not on the list are parked on `/no-access`. |
| `ANTHROPIC_API_KEY` | no | Server-side key for evaluate/test. Optional because users can paste their own key in the app's Settings (key icon) — a per-browser key that overrides this one. |
| `GROQ_API_KEY` | no | Server-side key for mic dictation (Whisper). Same Settings override applies. Unset, the mic renders but dictation errors. Free tier: <https://console.groq.com/keys> |
| `ACCESS_CONTACT_EMAIL` | no | If set, `/no-access` shows a "Request access" button that opens a prefilled email to this address. |

## How it works

A signed-in request to `/api/evaluate` makes one structured Claude call (`lib/engine.ts`) whose
system prompt and output schema are built from the selected framework (`lib/frameworks.ts` —
seven ship built in; adding one is data-only). The route streams the model's output back as
newline-delimited JSON: `delta` fragments the client renders best-effort as they arrive
(`lib/partialJson.ts`), then one authoritative schema-validated `done` result. The overall
grade is computed deterministically on the server (`lib/scoring.ts`) — never taken from the
model.

Access is enforced in two places: `proxy.ts` redirects unauthenticated *page* requests to
`/login` (and non-allowlisted users to `/no-access`), and the *API* routes call `lib/auth.ts`
(`denyUnauthorized`) to check both sign-in and the allowlist before spending a key — returning
401/403 JSON that the client renders inline.

## Project layout

```
app/
  page.tsx                 main screen: input → streamed scorecard → Save / Refine / Test
  login/page.tsx           Google + magic-link sign-in
  no-access/page.tsx       parked state for signed-in but not-allowlisted users
  auth/callback/route.ts   OAuth / magic-link code exchange
  api/evaluate/route.ts    auth + allowlist, streams the evaluation (NDJSON)
  api/test/route.ts        runs original vs revised prompt for the side-by-side test
  api/transcribe/route.ts  mic dictation → Whisper via Groq
lib/
  frameworks.ts            the seven frameworks: rubric, prompt, and schema per framework
  engine.ts                the structured Claude call (server-only)
  schema.ts                Zod contract: Evaluation / Scorecard / Dimension
  scoring.ts               deterministic overallScore() incl. required-dimension cap
  partialJson.ts           best-effort parse of the half-streamed evaluation
  keys.ts / apiKeys.ts     server/browser halves of bring-your-own-key
  auth.ts                  sign-in + allowlist gate for the API routes
  library.ts               Supabase CRUD + search for saved prompts
  template.ts              [PLACEHOLDER] fill-in
  supabase/                browser + server Supabase clients
components/                Scorecard, RevisedPrompt, FrameworkSelect, Library, TestDrawer,
                           SaveDialog, RefineDialog, SettingsDialog, MicButton, OpenInProviders…
supabase/schema.sql        the database schema — paste into Supabase's SQL editor
proxy.ts                   Next 16 "proxy" (middleware): session refresh + auth redirects
```

## Security

- The server's Anthropic/Groq keys are read only on the server (never `NEXT_PUBLIC_`).
  Keys pasted into Settings live in that browser's local storage and travel only as request
  headers to this app's own routes.
- `/api/evaluate`, `/api/test`, and `/api/transcribe` require a signed-in **and** allowlisted
  user; the allowlist fails closed.
- Per-call input is capped at 20,000 characters to bound token cost.
- Supabase Row-Level Security scopes every `entries` row to `auth.uid()`.
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

Import the repo → set **Root Directory = `frontend`** → add the env vars from the table above
→ deploy. In the Supabase dashboard, set **Authentication → URL Configuration** (site URL and
redirect URLs) to your deployed origin, or magic-link emails will point at localhost.
`npm run build` must pass first.

## Troubleshooting

- **Signed in, but every evaluation returns 403 "Access isn't configured."** — `ALLOWED_EMAILS`
  is unset or doesn't include your address. Add it and restart the dev server.
- **"relation \"public.entries\" does not exist"** when saving or opening the Library — the
  schema was never applied. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
- **"Missing NEXT_PUBLIC_SUPABASE_URL…" on startup** — `.env.local` isn't filled in (or the
  dev server wasn't restarted after editing it).
- **Magic-link email lands on localhost after deploying** — set the site/redirect URLs in
  Supabase's URL Configuration to the deployed origin.
- **Mic button errors** — no Groq key on the server or in Settings. See the table above.
