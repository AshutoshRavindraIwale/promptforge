# PromptForge — Web UI

A Next.js (App Router) chat UI for PromptForge: paste a draft prompt → score it on four
dimensions + get a priority fix and a ready-to-use rewrite → save it to a local library.
The Claude API key is held **server-side only** (in the `/api/evaluate` route).

Part of the [`promptforge`](../) repo; mirrors the Python CLI's engine/rubric in TypeScript.

## Stack
- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
- `@anthropic-ai/sdk` with structured outputs (Zod) · model `claude-sonnet-4-6`
- Library persisted in the browser's `localStorage`

## Run locally
```bash
cd frontend
npm install                  # if not already done
cp .env.example .env.local   # then paste your real key
npm run dev                  # http://localhost:3000
```
Get a key at <https://console.anthropic.com>. `frontend/.env.local` is git-ignored and read
only on the server — it never reaches the browser.

## Layout
```
app/
  page.tsx              main screen (client): input → scorecard → Save/Refine/Discard
  layout.tsx            dark theme + fonts
  globals.css           Tailwind v4 + theme tokens
  api/evaluate/route.ts server handler: holds the key, calls the engine
lib/
  engine.ts             SYSTEM_PROMPT + Anthropic structured call (server-only)
  schema.ts             Zod Evaluation/Scorecard/Dimension (mirrors promptforge/schema.py)
  scoring.ts            overallScore() incl. required-dimension cap (port of scoring.py)
  library.ts            localStorage CRUD + search
components/             Scorecard, RevisedPrompt, SaveDialog, Library
```

## Deploy (Vercel)
Import the repo → set **Root Directory = `frontend`** → add the `ANTHROPIC_API_KEY` environment
variable → deploy. `npm run build` must pass first (`next build` type-checks; it no longer
runs lint in Next 16).
