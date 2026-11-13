from __future__ import annotations

import pandas as pd
import pytest

from churn.data.clean import clean
from churn.features import FeatureEngineer, build_preprocessor


@pytest.fixture
def cleaned() -> pd.DataFrame:
    raw = pd.read_csv("tests/fixtures/telco_sample.csv")
    return clean(raw)


def test_feature_engineer_deterministic(cleaned: pd.DataFrame) -> None:
    fe = FeatureEngineer()
    fe.fit(cleaned)
    a = fe.transform(cleaned)
    b = fe.transform(cleaned)
    pd.testing.assert_frame_equal(a, b)


def test_feature_engineer_unseen_category() -> None:
    raw = pd.read_csv("tests/fixtures/telco_sample.csv")
    cleaned = clean(raw)
    preprocessor = build_preprocessor(min_frequency=10)

    # Add a new category at transform time via a modified frame.
    modified = cleaned.copy()
    modified.loc[0, "Contract"] = "Three year"
    fe = FeatureEngineer()
    fe.fit(cleaned)
    transformed_train = fe.transform(cleaned)
    # Preprocessor fitted on train should not crash on unseen category.
    preprocessor.fit(transformed_train)
    transformed_val = fe.transform(modified)
    out = preprocessor.transform(transformed_val)
    assert out.shape[0] == len(modified)


def test_feature_names_match_output(cleaned: pd.DataFrame) -> None:
    fe = FeatureEngineer()
    fe.fit(cleaned)
    transformed = fe.transform(cleaned)
    preprocessor = build_preprocessor(min_frequency=10)
    preprocessor.fit(transformed)
    names = preprocessor.get_feature_names_out()
    out = preprocessor.transform(transformed)
    assert len(names) == out.shape[1]
