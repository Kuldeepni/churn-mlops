from __future__ import annotations

import numpy as np
import pandas as pd

from churn.config import MonitoringParams
from churn.monitoring.drift import compute_drift


def _reference_stats(train_df: pd.DataFrame) -> dict:
    stats: dict = {}
    for col in train_df.columns:
        if col == "customerID":
            continue
        s = train_df[col]
        if pd.api.types.is_numeric_dtype(s):
            stats[col] = {"type": "numeric", "values": s.astype(float).tolist()}
        else:
            counts = s.astype(str).value_counts(normalize=True).to_dict()
            stats[col] = {
                "type": "categorical",
                "frequencies": {str(k): float(v) for k, v in counts.items()},
            }
    return stats


def test_drift_no_false_alarm() -> None:
    rng = np.random.default_rng(0)
    base = pd.DataFrame({"x": rng.normal(size=500), "cat": rng.choice(["a", "b"], size=500)})
    stats = _reference_stats(base)
    prod = base.sample(300, random_state=1).reset_index(drop=True)
    params = MonitoringParams(min_samples=10)
    report = compute_drift(prod, stats, params)
    assert report["drift_detected"] is False


def test_drift_detects_shift() -> None:
    rng = np.random.default_rng(0)
    base = pd.DataFrame({"x": rng.normal(size=500), "cat": rng.choice(["a", "b"], size=500)})
    stats = _reference_stats(base)
    shifted = pd.DataFrame(
        {"x": rng.normal(loc=3, size=300), "cat": rng.choice(["a", "b"], size=300, p=[0.9, 0.1])}
    )
    params = MonitoringParams(min_samples=10)
    report = compute_drift(shifted, stats, params)
    assert report["drift_detected"] is True


def test_drift_too_few_samples() -> None:
    base = pd.DataFrame({"x": [1.0, 2.0, 3.0]})
    stats = _reference_stats(base)
    prod = base.copy()
    params = MonitoringParams(min_samples=100)
    report = compute_drift(prod, stats, params)
    assert report["status"] == "skipped"
