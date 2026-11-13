from __future__ import annotations

import pandas as pd
import pytest

from churn.data.clean import clean
from churn.data.schema import raw_schema


@pytest.fixture
def raw_frame() -> pd.DataFrame:
    return pd.read_csv("tests/fixtures/telco_sample.csv")


def test_clean_produces_valid_frame(raw_frame: pd.DataFrame) -> None:
    cleaned = clean(raw_frame)
    assert len(cleaned) == len(raw_frame)
    assert cleaned["Churn"].isin([0, 1]).all()
    assert cleaned["TotalCharges"].dtype.kind == "f"
    assert (cleaned["TotalCharges"] >= 0).all()


def test_clean_rejects_blank_total_charges_for_tenured() -> None:
    frame = pd.read_csv("tests/fixtures/telco_sample.csv").copy()
    # Force a blank TotalCharges on a tenured customer.
    idx = frame.index[frame["tenure"] > 0][0]
    frame.loc[idx, "TotalCharges"] = " "
    with pytest.raises(ValueError):
        clean(frame)


def test_raw_schema_rejects_bad_data(raw_frame: pd.DataFrame) -> None:
    bad = raw_frame.copy()
    bad.loc[0, "tenure"] = 999
    with pytest.raises(Exception):  # noqa: B017
        raw_schema().validate(bad, lazy=True)
