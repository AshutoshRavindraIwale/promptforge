#!/usr/bin/env python3
"""
chatbot.py - a minimal ("vanilla") conversational CLI chatbot built on LangChain.

What it does
------------
- Runs in the terminal as a REPL: you type, the bot replies, until you exit.
- Keeps conversation memory for the session by replaying the full message
  history on every turn (the model itself is stateless - the history IS memory).
- LLM: Anthropic Claude (claude-opus-4-8) via the `langchain-anthropic`
  integration. Switching providers/models is a one-line change (see MODEL).

What it intentionally does NOT do (yet)
---------------------------------------
- No tools, no RAG, no agents. Future extension points are flagged `EXTEND:`.

Targets
-------
- langchain 1.x (verified against 1.3.x)
- langchain-anthropic 1.0.x  (uses langchain-core >= 1.4.7)
- Python 3.10+
"""

from __future__ import annotations

import os
import sys

# --- Configuration -----------------------------------------------------------

# Provider + model in init_chat_model's "<provider>:<model>" form.
# Default is Anthropic's latest Opus. To use OpenAI GPT-4o instead:
#   1) MODEL = "openai:gpt-4o"
#   2) pip install langchain-openai
#   3) export OPENAI_API_KEY=...
MODEL = "anthropic:claude-opus-4-8"

# EXTEND (prompts): give the bot a persona / rules here, or set to None to omit.
SYSTEM_PROMPT = "You are a helpful, concise assistant."


def message_text(message) -> str:
    """Return a message's text whether `content` is a plain string or a list of
    content blocks. Keeps printing robust across providers and model configs."""
    content = message.content
    if isinstance(content, str):
        return content
    parts = []
    for block in content:
        if isinstance(block, str):
            parts.append(block)
        elif isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "".join(parts)


def build_model():
    """Create the chat model. Kept tiny so swapping providers stays a one-liner."""
    from langchain.chat_models import init_chat_model

    # Note: we do NOT pass temperature/top_p. Claude Opus 4.7/4.8 reject sampling
    # parameters (HTTP 400). If you switch to a model that supports them, add
    # them here, e.g. init_chat_model(MODEL, temperature=0).
    return init_chat_model(MODEL)


def main() -> int:
    # 1) Fail fast with a clear message if the API key is missing.
    if MODEL.startswith("anthropic:") and not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "Error: ANTHROPIC_API_KEY is not set.\n"
            'Set it with:  export ANTHROPIC_API_KEY="sk-ant-..."',
            file=sys.stderr,
        )
        return 1

    try:
        model = build_model()
    except Exception as exc:
        # e.g. unknown model id, or the integration package isn't installed.
        print(f"Error: could not initialize model '{MODEL}': {exc}", file=sys.stderr)
        return 1

    # 2) Session memory = a plain list of messages, replayed every turn.
    # EXTEND (memory backends): swap this list for a LangGraph checkpointer,
    # Redis, or a database to persist across sessions. The append/replay
    # pattern below stays the same.
    from langchain_core.messages import HumanMessage, SystemMessage

    history = []
    if SYSTEM_PROMPT:
        history.append(SystemMessage(SYSTEM_PROMPT))

    print("Bot: Hi! How can I help you today? (type 'exit' to quit)")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            # Ctrl-D / Ctrl-C -> exit cleanly.
            print("\nBot: Goodbye!")
            return 0

        if not user_input:
            continue
        if user_input.lower() in {"exit", "quit"}:
            print("Bot: Goodbye!")
            return 0

        history.append(HumanMessage(user_input))

        try:
            # Passing the whole history is what gives the bot its memory.
            response = model.invoke(history)
        except Exception as exc:
            # Network failure, rate limit, auth error, etc. Keep the REPL alive.
            print(f"Bot: [sorry, the request failed: {exc}]")
            history.pop()  # drop the unanswered turn so the next try is clean
            continue

        history.append(response)  # response is an AIMessage; keep it for context
        print(f"Bot: {message_text(response)}")
        # EXTEND (tools / RAG): inspect or augment the response, or route to
        # tools, right here before the next loop iteration.


if __name__ == "__main__":
    raise SystemExit(main())
