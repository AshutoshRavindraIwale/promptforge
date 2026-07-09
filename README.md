# PromptForge

Turn a rough prompt into a scored, framework-conformant, reusable one. Paste a draft;
one LLM call scores it across four dimensions (Clarity, Guidelines, Structure, Examples),
explains each score, gives one actionable fix per dimension, names the single priority
fix, and returns a ready-to-use rewrite. Then **save** it to a local library or
**discard** it.

This is the CLI implementation of **Phase 0 + the Phase-1 loop** from the product spec
([`docs/PromptForge_PRD.md`](docs/PromptForge_PRD.md)) — the engine and rubric, done well,
before any web UI is built.

## Layout

```
backend/                the Python CLI + engine
  promptforge/          the package
    engine.py           evaluate(draft) -> one structured Claude call (score + revise)
    schema.py           typed contract: Evaluation / Scorecard / Dimension
    scoring.py          deterministic overall score + required-dimension cap
    library.py          local JSON library: save / search / delete / clipboard
    cli.py              menu REPL (Evaluate / Library)
    __main__.py         enables `python -m promptforge`
    prompts/
      scorer_reviser.txt  the tunable system prompt — edit to tune, no code change
  tests/                unit tests for the scoring logic (no API calls)
  examples/             chatbot.py — the generic LangChain CLI this grew from
  requirements.txt · .env.example
frontend/               the Next.js web UI (see frontend/README.md)
data/                   promptforge_library.json — your saved prompts (gitignored)
docs/                   the product requirements document
```

## Setup

Requires Python 3.10+ (the repo's `.venv` is 3.12).

```bash
python3.12 -m venv .venv && source .venv/bin/activate   # if not already created
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env    # then paste your real key into backend/.env
```

Get a key at <https://console.anthropic.com>. The engine uses **Claude Sonnet 4.6**
(`MODEL` in `backend/promptforge/engine.py` — swapping providers/models is a one-line change).

## Run

```bash
cd backend && python -m promptforge
```

- **[E]valuate** — paste a draft (end with a line containing only `END`), get the
  scorecard + revised prompt, then **[S]ave**, **[R]efine** (re-score the rewrite), or
  **[D]iscard**.
- **[L]ibrary** — list / view / search / copy-to-clipboard / delete saved prompts.

## Test

```bash
cd backend && pytest tests/test_scoring.py
```

## Tuning

The highest-leverage step (per the PRD): run 5–10 of your real prompts through it and
adjust only [`backend/promptforge/prompts/scorer_reviser.txt`](backend/promptforge/prompts/scorer_reviser.txt)
until scores are consistent and rewrites genuinely impress you — no code changes needed.

## Roadmap

See [`docs/PromptForge_PRD.md`](docs/PromptForge_PRD.md). Next phases: richer library
(search/favorites), multiple frameworks + a custom-framework builder, then the React/Vite
PWA with a serverless proxy and synced storage. `schema.py`, `scoring.py`, and
`engine.evaluate()` are the reusable core that work carries forward.
