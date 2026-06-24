"""The PromptForge engine: one structured LLM call that scores AND revises a draft.

This is PRD Phase 0 - the highest-leverage piece. The system prompt lives in
`prompts/scorer_reviser.txt` so it can be tuned without touching code. Output shape is
enforced by `with_structured_output(Evaluation)`, so there is no manual JSON parsing.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from .schema import Evaluation

# Load a local .env if python-dotenv is available (optional convenience).
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover - dotenv is optional
    pass

# Provider:model in init_chat_model's "<provider>:<model>" form. Swapping providers is
# a one-line change. temperature=0 keeps scoring consistent across runs.
# NOTE: remove `temperature` if you switch to Claude Opus 4.7/4.8 - those models reject
# sampling parameters (HTTP 400). Sonnet 4.6 accepts it.
MODEL = "anthropic:claude-sonnet-4-6"
TEMPERATURE = 0

_PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "scorer_reviser.txt"


def load_system_prompt() -> str:
    """Read the tunable scorer/reviser system prompt from disk."""
    return _PROMPT_PATH.read_text(encoding="utf-8")


def require_api_key() -> None:
    """Fail fast with a clear message if no API key is configured."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "Error: ANTHROPIC_API_KEY is not set.\n"
            "Add it to a .env file (ANTHROPIC_API_KEY=sk-ant-...) or run:\n"
            '  export ANTHROPIC_API_KEY="sk-ant-..."',
            file=sys.stderr,
        )
        raise SystemExit(1)


def build_model():
    """Create the chat model. Kept tiny so swapping providers stays a one-liner."""
    from langchain.chat_models import init_chat_model

    return init_chat_model(MODEL, temperature=TEMPERATURE)


def evaluate(draft: str, framework: str = "default") -> Evaluation:
    """Score and revise a draft prompt in one structured call.

    `framework` is accepted for future pluggable frameworks (PRD section 4); the MVP
    ships the single default Clear/Guided/Structured/Exampled framework baked into the
    system prompt, so the argument is currently informational.
    """
    from langchain_core.messages import HumanMessage, SystemMessage

    model = build_model().with_structured_output(Evaluation)
    result = model.invoke(
        [
            SystemMessage(load_system_prompt()),
            HumanMessage(draft),
        ]
    )
    return result  # type: ignore[return-value]
