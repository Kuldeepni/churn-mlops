"""SHAP based top-factor explanations for individual predictions."""

from __future__ import annotations

from typing import Any

import logging
from typing import Any

import numpy as np
import pandas as pd
import shap
from sklearn.pipeline import Pipeline

from churn.features import FeatureEngineer
from churn.logging_config import get_logger

logger = get_logger(__name__)


def _readable_name(transformed: str) -> str:
    """Map a transformed feature name to a human readable label."""
    name = transformed
    for prefix in ("numeric__", "categorical__"):
        if name.startswith(prefix):
            name = name[len(prefix):]
    # One-hot encoded columns look like "<column>_<value>".
    return name


def _extract_estimator_and_preprocessor(pipeline: Pipeline) -> tuple[Any, Any]:
    estimator = pipeline.named_steps["model"]
    preprocessor = pipeline.named_steps["preprocess"]
    return estimator, preprocessor


class Explainer:
    """Precomputed SHAP explainer for a fitted (uncalibrated) pipeline."""

    def __init__(self, pipeline: Pipeline, background: pd.DataFrame | None = None) -> None:
        self.pipeline = pipeline
        self.feature_engineer = pipeline.named_steps["features"]
        self.preprocessor = pipeline.named_steps["preprocess"]
        self.estimator = pipeline.named_steps["model"]
        self.feature_names = list(self.preprocessor.get_feature_names_out())
        self.readable = [_readable_name(n) for n in self.feature_names]

        transformed_bg = None
        if background is not None and len(background) > 0:
            engineered = self.feature_engineer.transform(background)
            transformed_bg = self.preprocessor.transform(engineered)

        model_type = type(self.estimator).__name__.lower()
        if "lgbm" in model_type or "xgb" in model_type or "forest" in model_type or "tree" in model_type:
            self.explainer = shap.TreeExplainer(self.estimator)
            self._kind = "tree"
        else:
            if transformed_bg is None:
                # Fall back to a small identity background.
                transformed_bg = np.zeros((1, len(self.feature_names)))
            self.explainer = shap.LinearExplainer(self.estimator, transformed_bg)
            self._kind = "linear"
        logger.info("explainer built", extra={"kind": self._kind, "n_features": len(self.feature_names)})

    def _transform(self, df: pd.DataFrame) -> Any:
        engineered = self.feature_engineer.transform(df)
        return self.preprocessor.transform(engineered)

    def top_factors(self, df: pd.DataFrame, k: int = 3) -> Any:
        """Return the top ``k`` contributing features for each row of ``df``."""
        matrix = self._transform(df)
        shap_values = self.explainer.shap_values(matrix)
        if isinstance(shap_values, list):
            # Binary classification: take the positive class.
            shap_values = shap_values[1] if len(shap_values) > 1 else shap_values[0]
        shap_values = np.asarray(shap_values)
        if shap_values.ndim == 3:
            shap_values = shap_values[:, :, 1]

        results: list[list[dict[str, Any]]] = []
        for row in shap_values:
            order = np.argsort(np.abs(row))[::-1][:k]
            factors = []
            for idx in order:
                impact = float(row[idx])
                factors.append(
                    {
                        "feature": self.readable[idx],
                        "impact": impact,
                        "direction": "increases_churn" if impact >= 0 else "decreases_churn",
                    }
                )
            results.append(factors)
        return results


def build_explainer(pipeline: Pipeline, background: pd.DataFrame | None = None) -> Explainer:
    return Explainer(pipeline, background=background)
