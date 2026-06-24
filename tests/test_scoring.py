"""Unit tests for the deterministic overall-score computation (no API calls)."""

from promptforge.schema import Dimension, Scorecard
from promptforge.scoring import overall_score


def _sc(clarity, guidelines, structure, examples) -> Scorecard:
    mk = lambda s: Dimension(score=s, assessment="x", advice="y")
    return Scorecard(
        clarity=mk(clarity),
        guidelines=mk(guidelines),
        structure=mk(structure),
        examples=mk(examples),
    )


def test_all_excellent():
    assert overall_score(_sc("Excellent", "Excellent", "Excellent", "Excellent")) == "Excellent"


def test_all_good():
    assert overall_score(_sc("Good", "Good", "Good", "Good")) == "Good"


def test_all_needs_work():
    assert overall_score(_sc("Needs Work", "Needs Work", "Needs Work", "Needs Work")) == "Needs Work"


def test_mean_rounds_half_up():
    # (3+3+4+4)/4 = 3.5 -> rounds up to Excellent
    assert overall_score(_sc("Good", "Good", "Excellent", "Excellent")) == "Excellent"


def test_required_clarity_poor_caps_at_needs_work():
    # (1+4+4+4)/4 = 3.25 -> Good, but Clarity=Poor caps it at Needs Work
    assert overall_score(_sc("Poor", "Excellent", "Excellent", "Excellent")) == "Needs Work"


def test_required_guidelines_poor_caps_at_needs_work():
    assert overall_score(_sc("Excellent", "Poor", "Excellent", "Excellent")) == "Needs Work"


def test_both_required_poor_capped_at_needs_work():
    # (1+1+4+4)/4 = 2.5 -> Good, capped to Needs Work
    assert overall_score(_sc("Poor", "Poor", "Excellent", "Excellent")) == "Needs Work"


def test_conditional_poor_is_not_capped():
    # Structure is conditional, not required -> no cap. (4+4+1+4)/4 = 3.25 -> Good
    assert overall_score(_sc("Excellent", "Excellent", "Poor", "Excellent")) == "Good"


def test_correctly_omitted_conditionals_do_not_penalize():
    # Conditionals scored Excellent for correct omission lift, not drag, the average.
    # (3+3+4+4)/4 = 3.5 -> Excellent
    assert overall_score(_sc("Good", "Good", "Excellent", "Excellent")) == "Excellent"
