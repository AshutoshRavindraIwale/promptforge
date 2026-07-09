"""Unit tests for engine input validation (no API calls).

The empty-draft guard fails fast before any model is built, so these tests never
touch the network or require an API key.
"""

import pytest

from promptforge.engine import evaluate


@pytest.mark.parametrize("draft", ["", "   ", "\n\t  \n"])
def test_evaluate_rejects_blank_draft(draft):
    with pytest.raises(ValueError, match="empty"):
        evaluate(draft)
