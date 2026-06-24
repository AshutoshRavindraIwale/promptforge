"""Typed contract for an evaluation (PRD section 5 JSON, minus overall_score).

`overall_score` is intentionally NOT a model output - it is computed deterministically
in `scoring.py` so the band (and the required-dimension cap) never depends on the
model's arithmetic. This module is the reusable contract for the future web backend.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Score = Literal["Poor", "Needs Work", "Good", "Excellent"]


class Dimension(BaseModel):
    score: Score = Field(description="Poor / Needs Work / Good / Excellent")
    assessment: str = Field(description="1-2 sentences explaining the score")
    advice: str = Field(description="one specific, actionable improvement")


class Scorecard(BaseModel):
    clarity: Dimension
    guidelines: Dimension
    structure: Dimension
    examples: Dimension


class Evaluation(BaseModel):
    prompt_evaluated: str = Field(description="the user's original prompt, verbatim")
    scorecard: Scorecard
    priority_fix: str = Field(
        description="the single most impactful change to make first"
    )
    revised_prompt: str = Field(description="the full rewritten prompt, ready to use")
    suggested_category: str = Field(description="a single short category for filing")
    suggested_tags: list[str] = Field(
        default_factory=list, description="2-5 short lowercase tags for search"
    )
