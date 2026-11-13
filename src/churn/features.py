"""Feature engineering that stays *inside* the sklearn pipeline.

The :class:`FeatureEngineer` transformer is the only place where derived
columns are created. Because it is a step of the same ``Pipeline`` that
contains the estimator, it is fitted/transformed consistently on every split
and there is no leakage.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

from churn.config import FeatureParams, load_params
from churn.data.schema import CATEGORICAL_COLUMNS, NUMERIC_COLUMNS
from churn.logging_config import get_logger

logger = get_logger(__name__)

# Columns produced by :class:`FeatureEngineer`.
ENGINEERED_NUMERIC: list[str] = [
    "avg_monthly_spend",
    "num_addon_services",
    "charge_to_tenure_ratio",
    "is_month_to_month",
    "has_autopay",
]
ENGINEERED_CATEGORICAL: list[str] = ["tenure_bucket"]

NUMERIC_FEATURES: list[str] = list(NUMERIC_COLUMNS) + ENGINEERED_NUMERIC
CATEGORICAL_FEATURES: list[str] = list(CATEGORICAL_COLUMNS) + ENGINEERED_CATEGORICAL

ADDON_SERVICE_COLUMNS: list[str] = [
    "OnlineSecurity",
    "OnlineBackup",
    "DeviceProtection",
    "TechSupport",
    "StreamingTV",
    "StreamingMovies",
]


def _tenure_bucket(tenure: pd.Series, edges: list[int]) -> pd.Series:
    """Map a tenure (months) series to a human readable bucket label."""
    labels = [f"{edges[i]}-{edges[i + 1] - 1}m" for i in range(len(edges) - 1)] + [f"{edges[-1]}m+"]
    bucketed = pd.cut(
        tenure,
        bins=[-1] + list(edges[1:]) + [10**9],
        labels=labels,
        right=False,
    )
    return bucketed.astype(str).replace("nan", "unknown")


class FeatureEngineer(BaseEstimator, TransformerMixin):  # type: ignore[misc]
    """Add derived features to a raw cleaned frame.

    The transformer is stateless: ``fit`` only records the configuration, and
    ``transform`` returns a *new* frame with the engineered columns appended.
    """

    def __init__(self, params: FeatureParams | None = None) -> None:
        self.params = params

    def _resolved_params(self) -> FeatureParams:
        if self.params is not None:
            return self.params
        try:
            return load_params().features
        except FileNotFoundError:
            return FeatureParams()

    def fit(self, X: pd.DataFrame, y: object = None) -> FeatureEngineer:
        self.params_ = self._resolved_params()
        # Record the input columns so that transform can be validated.
        self.feature_names_in_ = np.asarray(list(X.columns), dtype=object)
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        if not hasattr(self, "params_"):
            self.fit(X)
        params = self.params_

        result = X.copy()
        tenure = result["tenure"].astype(float).clip(lower=0)

        # tenure_bucket
        edges = list(params.tenure_bucket_edges)
        result["tenure_bucket"] = _tenure_bucket(result["tenure"].astype(int), edges)

        # avg_monthly_spend
        result["avg_monthly_spend"] = result["TotalCharges"].astype(float) / np.maximum(tenure, 1.0)

        # num_addon_services
        addon_cols = [c for c in params.addon_services if c in result.columns]
        if not addon_cols:
            addon_cols = [c for c in ADDON_SERVICE_COLUMNS if c in result.columns]
        result["num_addon_services"] = result[addon_cols].apply(
            lambda row: int(sum(1 for value in row if str(value).strip().lower() == "yes")),
            axis=1,
        )

        # is_month_to_month
        result["is_month_to_month"] = (result["Contract"].astype(str) == "Month-to-month").astype(
            int
        )

        # has_autopay
        result["has_autopay"] = (
            result["PaymentMethod"].astype(str).str.contains("automatic", case=False, regex=False)
        ).astype(int)

        # charge_to_tenure_ratio
        result["charge_to_tenure_ratio"] = result["MonthlyCharges"].astype(float) / np.maximum(
            tenure, 1.0
        )

        return result

    def get_feature_names_out(self, input_features: Iterable[str] | None = None) -> Any:
        base = list(input_features) if input_features is not None else list(self.feature_names_in_)
        return np.asarray(base + ENGINEERED_NUMERIC + ENGINEERED_CATEGORICAL, dtype=object)


def build_preprocessor(min_frequency: int = 10) -> object:
    """Build the ColumnTransformer used inside the training pipeline."""
    from sklearn.compose import ColumnTransformer
    from sklearn.impute import SimpleImputer
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler

    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "encoder",
                OneHotEncoder(
                    handle_unknown="ignore", min_frequency=min_frequency, sparse_output=False
                ),
            ),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipeline, NUMERIC_FEATURES),
            ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
        ],
        remainder="drop",
        verbose_feature_names_out=True,
    )
