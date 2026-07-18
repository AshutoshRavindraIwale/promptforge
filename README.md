# PromptForge

> Turn a rough prompt into a scored, framework-conformant, reusable one.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

Paste a draft; one structured LLM call scores it across four dimensions (Clarity, Guidelines,
Structure, Examples), explains each score, gives one actionable fix per dimension, names the
single priority fix, and returns a ready-to-use rewrite. Then save it, refine it, or test the
rewrite against real input.

PromptForge ships as two surfaces that share one engine and rubric:

- **CLI** (`backend/`, Python) — the original: paste a draft in a menu REPL, get the scorecard and
  rewrite, save to a local JSON library.
- **Web UI** (`frontend/`, Next.js) — the same engine in TypeScript, plus Google/magic-link
  sign-in, Supabase-backed history and library, refine chains with diffs, and side-by-side
  testing. See [`frontend/README.md`](frontend/README.md).

<!-- Hero screenshot: save a PNG to docs/screenshot.png, then uncomment the line below.
<p align="center"><img src="docs/screenshot.png" alt="PromptForge web UI" width="760"></p>
-->

## Features

- **Four-dimension scoring** — a per-dimension assessment and fix, a single priority fix, and a
  deterministic overall grade (required-dimension cap: a Poor on Clarity or Guidelines caps the
  total).
- **Evaluate → rewrite in one call** — schema-validated structured output (Pydantic in Python, Zod
  in TypeScript) from a single Claude request; the rubric lives in one editable prompt file.
- **Refine & compare** (web) — re-score a rewrite to build a versioned chain, with score movement
  and a word-level diff between versions.
- **Side-by-side test** (web) — run the original and revised prompt on the same input to judge the
  rewrite by its output, not just its score.
- **Library** — save, search, and reuse prompts; `[PLACEHOLDER]` templates can be filled in and
  copied. Local JSON in the CLI; Supabase with per-user Row-Level Security on the web.

## Repository layout

```
backend/                Python CLI + engine
  promptforge/
    engine.py           evaluate(draft) -> one structured Claude call (score + revise)
    schema.py           typed contract: Evaluation / Scorecard / Dimension
    scoring.py          deterministic overall score + required-dimension cap
    library.py          local JSON library: save / search / delete / clipboard
    cli.py              menu REPL (Evaluate / Library)
    prompts/scorer_reviser.txt   the tunable system prompt — edit to tune, no code change
  tests/                unit tests for the scoring logic (no API calls)
frontend/               the Next.js web UI — same engine/rubric in TypeScript (see its README)
docs/                   product requirements document
```

## Quickstart — CLI

Requires Python 3.10+ (the repo's `.venv` is 3.12).

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env      # then paste your key into backend/.env
cd backend && python -m promptforge
```

Get a key at <https://console.anthropic.com>. The engine uses Claude Sonnet (`MODEL` in
`backend/promptforge/engine.py` — swapping providers/models is a one-line change).

- **[E]valuate** — paste a draft (end with a line containing only `END`), get the scorecard +
  revised prompt, then **[S]ave**, **[R]efine** (re-score the rewrite), or **[D]iscard**.
- **[L]ibrary** — list / view / search / copy-to-clipboard / delete saved prompts.

## Quickstart — Web UI

```bash
cd frontend
npm install
cp .env.example .env.local     # Anthropic key, email allowlist, Supabase credentials
npm run dev                    # http://localhost:3000
```

Full setup — every env var, the Supabase schema step, and deployment — is in
[`frontend/README.md`](frontend/README.md).

## Test

```bash
cd backend && pytest tests/test_scoring.py
```

## Tuning

The highest-leverage step (per the PRD): run 5–10 of your real prompts through it and adjust only
[`backend/promptforge/prompts/scorer_reviser.txt`](backend/promptforge/prompts/scorer_reviser.txt)
until scores are consistent and rewrites genuinely impress you — no code changes needed.

## Security

- The Anthropic key is read only from the environment (server-side in the web app, never
  `NEXT_PUBLIC_`), so it never reaches the browser.
- The web app's paid routes require a signed-in **and** allowlisted user and fail closed; Supabase
  Row-Level Security scopes every row to its owner.
- No secrets are committed — `.env*` is git-ignored; only `.env.example` templates are tracked.

## Roadmap

See [`docs/PromptForge_PRD.md`](docs/PromptForge_PRD.md). `schema`, `scoring`, and
`engine.evaluate()` are the reusable core shared across both surfaces; next up: a richer library
(favorites, tags), multiple frameworks plus a custom-framework builder, and synced storage.

## License

[MIT](LICENSE) © Ashutosh Iwale
