from __future__ import annotations

import json
from pathlib import Path

import pytest

DATA_DIR = Path("web/public/data")


@pytest.mark.parametrize("name", [
    "metrics.json", "model_info.json", "validation_scores.json",
    "business_params.json", "examples.json", "feature_options.json",
    "importance.json", "drift_demo.json", "pipeline_status.json",
])
def test_export_files_exist(name: str) -> None:
    assert (DATA_DIR / name).is_file(), f"missing {name}"


def test_validation_scores_in_range() -> None:
    data = json.loads((DATA_DIR / "validation_scores.json").read_text())
    assert isinstance(data, list) and len(data) > 0
    for row in data:
        assert 0.0 <= row["p"] <= 1.0
        assert row["y"] in (0, 1)


def test_examples_have_required_fields() -> None:
    data = json.loads((DATA_DIR / "examples.json").read_text())
    assert len(data) > 0
    for ex in data:
        assert "features" in ex
        assert "churn_probability" in ex
        assert 0.0 <= ex["churn_probability"] <= 1.0
        assert ex["risk_band"] in ("low", "medium", "high")
        assert "top_factors" in ex
