"""Factories for the candidate models."""

from __future__ import annotations

from typing import Any

from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from churn.config import FeatureParams, LogisticParams, LightGBMParams, ModelParams
from churn.features import FeatureEngineer, build_preprocessor


def make_logistic_pipeline(params: LogisticParams, feature_params: FeatureParams, min_frequency: int) -> Pipeline:
    """Build an uncalibrated logistic-regression pipeline."""
    class_weight = None if params.class_weight == "none" else params.class_weight
    estimator = LogisticRegression(
        C=params.C,
        class_weight=class_weight,
        max_iter=params.max_iter,
        solver="lbfgs",
        n_jobs=-1,
        random_state=42,
    )
    preprocessor = build_preprocessor(min_frequency=min_frequency)
    return Pipeline(
        steps=[
            ("features", FeatureEngineer(params=feature_params)),
            ("preprocess", preprocessor),
            ("model", estimator),
        ]
    )


def make_lightgbm_pipeline(params: LightGBMParams, feature_params: FeatureParams, min_frequency: int) -> Pipeline:
    """Build an uncalibrated LightGBM pipeline."""
    import lightgbm as lgb

    estimator = lgb.LGBMClassifier(
        n_estimators=params.n_estimators,
        learning_rate=params.learning_rate,
        num_leaves=params.num_leaves,
        max_depth=params.max_depth,
        min_child_samples=params.min_child_samples,
        subsample=params.subsample,
        subsample_freq=params.subsample_freq,
        colsample_bytree=params.colsample_bytree,
        reg_alpha=params.reg_alpha,
        reg_lambda=params.reg_lambda,
        scale_pos_weight=params.scale_pos_weight,
        random_state=params.random_state,
        n_jobs=-1,
        verbose=-1,
    )
    preprocessor = build_preprocessor(min_frequency=min_frequency)
    return Pipeline(
        steps=[
            ("features", FeatureEngineer(params=feature_params)),
            ("preprocess", preprocessor),
            ("model", estimator),
        ]
    )


def build_candidate(name: str, model_params: ModelParams, feature_params: FeatureParams, min_frequency: int) -> Pipeline:
    if name == "logistic":
        return make_logistic_pipeline(model_params.logistic, feature_params, min_frequency)
    if name == "lightgbm":
        return make_lightgbm_pipeline(model_params.lightgbm, feature_params, min_frequency)
    raise ValueError(f"unknown candidate: {name}")
