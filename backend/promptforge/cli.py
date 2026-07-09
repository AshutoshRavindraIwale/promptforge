"""Menu-driven CLI for the PromptForge loop.

  Main menu -> [E]valuate / [L]ibrary / [Q]uit
  Evaluate  -> paste draft -> scorecard + revised prompt -> [S]ave / [R]efine / [D]iscard
  Library   -> list / view / search / copy / delete

Reuses the clean EOF/Ctrl-C exit handling from chatbot.py.
"""

from __future__ import annotations

from . import engine, library
from .schema import Evaluation
from .scoring import overall_score

BANNER = "PromptForge - score, revise, and save your prompts."
RULE = "=" * 64


def read_multiline(prompt: str) -> str:
    print(prompt)
    print("(paste your prompt, then a line containing only END - or press Ctrl-D)")
    lines: list[str] = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip() == "END":
            break
        lines.append(line)
    return "\n".join(lines).strip()


def render_evaluation(ev: Evaluation) -> None:
    dims = [
        ("CLARITY", ev.scorecard.clarity),
        ("GUIDELINES", ev.scorecard.guidelines),
        ("STRUCTURE", ev.scorecard.structure),
        ("EXAMPLES", ev.scorecard.examples),
    ]
    print("\n" + RULE)
    print("SCORECARD")
    print(RULE)
    for i, (name, d) in enumerate(dims, start=1):
        print(f"\n[{i}] {name}  -  {d.score}")
        print(f"    Assessment: {d.assessment}")
        print(f"    Advice:     {d.advice}")
    print("\n" + "-" * 64)
    print(f"OVERALL SCORE: {overall_score(ev.scorecard)}")
    print(f"PRIORITY FIX:  {ev.priority_fix}")
    print("-" * 64)
    print("\nREVISED PROMPT:\n")
    print(ev.revised_prompt)
    print("\n" + RULE)


def save_flow(ev: Evaluation, original: str) -> None:
    name = input("Name for this prompt: ").strip() or "Untitled prompt"
    category = (
        input(f"Category [{ev.suggested_category}]: ").strip() or ev.suggested_category
    )
    tag_default = ", ".join(ev.suggested_tags or [])
    raw_tags = input(f"Tags (comma-separated) [{tag_default}]: ").strip()
    tags = (
        [t.strip() for t in raw_tags.split(",") if t.strip()]
        if raw_tags
        else list(ev.suggested_tags or [])
    )
    record = library.add(
        {
            "name": name,
            "category": category,
            "tags": tags,
            "original_prompt": original,
            "revised_prompt": ev.revised_prompt,
            "scorecard": ev.scorecard.model_dump(),
            "overall_score": overall_score(ev.scorecard),
            "priority_fix": ev.priority_fix,
        }
    )
    print(f"Saved '{record['name']}' (id {record['id']}).")


def evaluate_flow() -> None:
    draft = read_multiline("\nPaste the prompt you want to evaluate:")
    if not draft:
        print("Nothing to evaluate.")
        return
    while True:
        print("\nEvaluating...")
        try:
            ev = engine.evaluate(draft)
        except Exception as exc:  # network / auth / rate-limit / parse errors
            print(f"Evaluation failed: {exc}")
            return
        render_evaluation(ev)
        choice = input("\n[S]ave  [R]efine  [D]iscard: ").strip().lower()
        if choice in ("s", "save"):
            save_flow(ev, draft)
            return
        if choice in ("r", "refine"):
            draft = ev.revised_prompt
            print("Refining: feeding the revised prompt back for another pass.")
            continue
        print("Discarded.")
        return


def _print_entry_line(e: dict) -> None:
    tags = ", ".join(e.get("tags", []) or [])
    tail = f"  #{tags}" if tags else ""
    print(
        f"  {e['id']}  [{e.get('overall_score', '?')}]  "
        f"{e.get('name', '?')}  ({e.get('category', '')}){tail}"
    )


def _view(entry_id: str) -> None:
    e = library.find(entry_id)
    if not e:
        print("No entry with that id.")
        return
    print(f"\n=== {e.get('name')}  ({e.get('overall_score')}) ===")
    print(f"Category: {e.get('category')}   Tags: {', '.join(e.get('tags', []) or [])}")
    print(f"\nRevised prompt:\n{e.get('revised_prompt')}")


def _copy(entry_id: str) -> None:
    e = library.find(entry_id)
    if not e:
        print("No entry with that id.")
        return
    text = e.get("revised_prompt", "")
    if library.copy_to_clipboard(text):
        print(f"Copied '{e.get('name')}' to clipboard.")
    else:
        print("Clipboard unavailable - copy it manually:\n")
        print(text)


def library_flow() -> None:
    while True:
        entries = library.all_entries()
        print(f"\n--- Library ({len(entries)} saved) ---")
        for e in entries:
            _print_entry_line(e)
        print("\n[V]iew <id>  [S]earch <q>  [C]opy <id>  [D]elete <id>  [B]ack")
        cmd = input("> ").strip()
        if not cmd:
            continue
        parts = cmd.split(maxsplit=1)
        action = parts[0].lower()
        arg = parts[1].strip() if len(parts) > 1 else ""

        if action in ("b", "back"):
            return
        if action in ("s", "search"):
            q = arg or input("Search: ").strip()
            results = library.search(q)
            print(f"\n{len(results)} match(es):")
            for e in results:
                _print_entry_line(e)
        elif action in ("v", "view"):
            _view(arg)
        elif action in ("c", "copy"):
            _copy(arg)
        elif action in ("d", "delete"):
            print(f"Deleted {arg}." if arg and library.delete(arg) else "No entry with that id.")
        else:
            print("Unknown command.")


def main() -> int:
    engine.require_api_key()
    print(BANNER)
    while True:
        try:
            choice = input("\n[E]valuate  [L]ibrary  [Q]uit: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            return 0
        if choice in ("e", "evaluate"):
            evaluate_flow()
        elif choice in ("l", "library"):
            library_flow()
        elif choice in ("q", "quit", "exit"):
            print("Goodbye!")
            return 0
        else:
            print("Pick E, L, or Q.")
