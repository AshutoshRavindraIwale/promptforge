"""Deterministic overall-score computation (PRD sections 3 and 11).

Overall = the four dimension bands mapped to 1-4, averaged, rounded half-up to the
nearest band -- with a required-dimension cap: a `Poor` on Clarity or Guidelines caps
the overall at `Needs Work`, so a clear-but-broken prompt can't read as `Good`.
Pure functions, no I/O, no model calls -> directly unit-testable.
"""

from __future__ import annotations

import math

from .schema import Score, Scorecard

BAND_TO_INT: dict[Score, int] = {
    "Poor": 1,
    "Needs Work": 2,
    "Good": 3,
    "Excellent": 4,
}
INT_TO_BAND: dict[int, Score] = {v: k for k, v in BAND_TO_INT.items()}

# Dimensions that always apply; a Poor here caps the overall (PRD section 11).
REQUIRED_DIMENSIONS = ("clarity", "guidelines")
REQUIRED_POOR_CAP: Score = "Needs Work"


def overall_score(scorecard: Scorecard) -> Score:
    dims = [
        scorecard.clarity,
        scorecard.guidelines,
        scorecard.structure,
        scorecard.examples,
    ]
    values = [BAND_TO_INT[d.score] for d in dims]
    mean = sum(values) / len(values)
    band_int = int(math.floor(mean + 0.5))  # round half-up
    band_int = max(1, min(4, band_int))  # clamp for safety
    band: Score = INT_TO_BAND[band_int]

    required_poor = any(
        BAND_TO_INT[getattr(scorecard, name).score] == 1
        for name in REQUIRED_DIMENSIONS
    )
    if required_poor and BAND_TO_INT[band] > BAND_TO_INT[REQUIRED_POOR_CAP]:
        band = REQUIRED_POOR_CAP
    return band
