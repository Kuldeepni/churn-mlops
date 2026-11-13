from __future__ import annotations

import pandas as pd
import pytest

from churn.data.clean import clean
from churn.data.split import split


@pytest.fixture
def cleaned() -> pd.DataFrame:
    raw = pd.read_csv("tests/fixtures/telco_sample.csv")
    return clean(raw)


def test_split_no_overlap(cleaned: pd.DataFrame) -> None:
    train, val, test = split(cleaned, seed=42)
    assert set(train["customerID"]).isdisjoint(val["customerID"])
    assert set(train["customerID"]).isdisjoint(test["customerID"])
    assert set(val["customerID"]).isdisjoint(test["customerID"])


def test_split_sizes(cleaned: pd.DataFrame) -> None:
    train, val, test = split(cleaned, seed=42)
    total = len(train) + len(val) + len(test)
    assert total == len(cleaned)
    assert len(test) >= 30


def test_split_stratification(cleaned: pd.DataFrame) -> None:
    train, val, test = split(cleaned, seed=42)
    overall = cleaned["Churn"].mean()
    for part in (train, val, test):
        assert abs(part["Churn"].mean() - overall) < 0.1
