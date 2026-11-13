from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pandas as pd

from churn.config import get_settings
from churn.models.registry import register_model


def test_register_model_runs() -> None:
    # Use a file-based MLflow backend to avoid sqlalchemy.
    tmp = Path(tempfile.mkdtemp())
    os.environ["MLFLOW_TRACKING_URI"] = f"file:{tmp}/mlruns"

    get_settings.cache_clear()
    settings = get_settings()
    settings.mlflow_tracking_uri = f"file:{tmp}/mlruns"

    from sklearn.linear_model import LogisticRegression

    model = LogisticRegression()
    X = pd.DataFrame({"a": [1.0, 2.0, 3.0], "b": [0.0, 1.0, 0.0]})
    y = pd.Series([0, 1, 0])
    model.fit(X, y)

    version = register_model(
        pipeline=model,
        X_example=X,
        metrics={"pr_auc": 0.5},
        params=None,
        git_sha="testsha",
        validation_pr_auc=0.5,
        current_champion_pr_auc=None,
    )
    assert version is not None
    get_settings.cache_clear()
