from __future__ import annotations

import pandas as pd
import pytest

from churn.api import model_store
from churn.data.clean import clean


@pytest.fixture(autouse=True)
def load_bundle(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("PROJECT_ROOT", raising=False)
    from churn.config import get_paths as _gp
    from churn.config import get_settings as _gs

    _gp.cache_clear()
    _gs.cache_clear()
    if not model_store.is_ready():
        model_store.load_bundle()


def test_top_factors_returns_list() -> None:
    raw = pd.read_csv("tests/fixtures/telco_sample.csv")
    cleaned = clean(raw).drop(columns=["Churn", "customerID"], errors="ignore")
    factors = model_store.top_factors(cleaned.head(3), k=2)
    assert isinstance(factors, list)
    assert len(factors) == 3


def test_risk_band() -> None:
    assert model_store.risk_band(0.1) in {"low", "medium", "high"}
    assert model_store.risk_band(0.9) == "high"
