from __future__ import annotations

from churn.config import FeatureParams, ModelParams
from churn.models.candidates import build_candidate


def test_build_candidate_logistic() -> None:
    params = ModelParams()
    fp = FeatureParams()
    pipe = build_candidate("logistic", params, fp, min_frequency=5)
    assert pipe is not None


def test_build_candidate_lightgbm() -> None:
    params = ModelParams()
    fp = FeatureParams()
    pipe = build_candidate("lightgbm", params, fp, min_frequency=5)
    assert pipe is not None
