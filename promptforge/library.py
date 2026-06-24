"""Local JSON prompt library (the CLI analog of the PRD's localStorage MVP).

The on-disk JSON shape is deliberately flat and stable - it's the migration source for
the future Supabase schema (PRD Phase 2). No external deps; clipboard uses macOS
`pbcopy` with a graceful fallback.
"""

from __future__ import annotations

import json
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

LIBRARY_PATH = Path(__file__).resolve().parent.parent / "promptforge_library.json"


def _load() -> list[dict]:
    if not LIBRARY_PATH.exists():
        return []
    try:
        return json.loads(LIBRARY_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _save(entries: list[dict]) -> None:
    LIBRARY_PATH.write_text(
        json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def all_entries() -> list[dict]:
    return _load()


def add(entry: dict) -> dict:
    """Persist a new entry; stamps a short id and a UTC timestamp."""
    entries = _load()
    record = {
        "id": uuid.uuid4().hex[:8],
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        **entry,
    }
    entries.append(record)
    _save(entries)
    return record


def delete(entry_id: str) -> bool:
    entries = _load()
    remaining = [e for e in entries if e.get("id") != entry_id]
    if len(remaining) == len(entries):
        return False
    _save(remaining)
    return True


def find(entry_id: str) -> dict | None:
    for e in _load():
        if e.get("id") == entry_id:
            return e
    return None


def search(query: str) -> list[dict]:
    """Substring match over name, category, tags, and prompt text."""
    q = query.strip().lower()
    if not q:
        return _load()
    matches = []
    for e in _load():
        haystack = " ".join(
            [
                str(e.get("name", "")),
                str(e.get("category", "")),
                " ".join(e.get("tags", []) or []),
                str(e.get("revised_prompt", "")),
                str(e.get("original_prompt", "")),
            ]
        ).lower()
        if q in haystack:
            matches.append(e)
    return matches


def copy_to_clipboard(text: str) -> bool:
    """Best-effort copy via macOS pbcopy. Returns True on success."""
    try:
        subprocess.run(["pbcopy"], input=text.encode("utf-8"), check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False
