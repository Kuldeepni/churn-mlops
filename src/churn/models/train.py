"""Training, cross-validation and hyper-parameter tuning with MLflow tracking."""

from __future__ import annotations

from typing import Any

import json
import logging
import subprocess
from pathlib import Path
from typing import Any

import mlflow
import numpy as np
import optuna
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold

from churn.config import Params, get_paths, get_settings, load_params
from churn.data.schema import TARGET_COLUMN
from churn.features import build_preprocessor
from churn.logging_config import get_logger
from churn.models.candidates import build_candidate

logger = get_logger(__name__)

OPTUNA_SEED_OFFSET: int = 17


def _git_sha() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=False,
        )
        return result.stdout.strip() or "unknown"
    except FileNotFoundError:
        return "unknown"


def _dataset_hash() -> str:
    from churn.config import get_paths

    manifest_path = get_paths().raw_dir / "manifest.json"
    if not manifest_path.is_file():
        return "unknown"
    return manifest_path.read_text(encoding="utf-8")


def _cv_metrics(pipeline: Any, X: pd.DataFrame, y: Any, params: Params) -> dict[str, float]:
    """Stratified K-fold cross validation returning mean/std metrics."""
    splitter = StratifiedKFold(n_splits=params.model.cv_folds, shuffle=True, random_state=params.seed)
    scores: dict[str, list[float]] = {
        "roc_auc": [],
        "pr_auc": [],
        "f1": [],
        "precision": [],
        "recall": [],
        "brier": [],
    }
    for train_idx, val_idx in splitter.split(X, y):
        X_tr, X_va = X.iloc[train_idx], X.iloc[val_idx]
        y_tr, y_va = y[train_idx], y[val_idx]
        pipeline.fit(X_tr, y_tr)
        proba = pipeline.predict_proba(X_va)[:, 1]
        pred = (proba >= 0.5).astype(int)
        scores["roc_auc"].append(float(roc_auc_score(y_va, proba)))
        scores["pr_auc"].append(float(average_precision_score(y_va, proba)))
        scores["f1"].append(float(f1_score(y_va, pred, zero_division=0)))
        scores["precision"].append(float(precision_score(y_va, pred, zero_division=0)))
        scores["recall"].append(float(recall_score(y_va, pred, zero_division=0)))
        scores["brier"].append(float(brier_score_loss(y_va, proba)))

    result: dict[str, float] = {}
    for name, values in scores.items():
        result[f"{name}_mean"] = float(np.mean(values))
        result[f"{name}_std"] = float(np.std(values))
    return result


def _log_mlflow_common(params: Params, git_sha: str, dataset_hash: str) -> None:
    mlflow.set_tag("git_sha", git_sha)
    mlflow.set_tag("dataset_manifest", dataset_hash[:200])
    mlflow.log_artifact(str(get_paths().params_file)) if get_paths().params_file.is_file() else None
    lock_path = Path("requirements.lock")
    if lock_path.is_file():
        mlflow.log_artifact(str(lock_path))


def train(params: Params | None = None) -> dict[str, Any]:
    """Run the full training stage and return a summary dict."""
    params = params or load_params()
    settings = get_settings()
    paths = get_paths()
    paths.ensure_dirs()

    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    mlflow.set_experiment(settings.mlflow_experiment)

    train_df = pd.read_parquet(paths.train_parquet)
    # customerID is dropped if present; keep feature columns only.
    X = train_df.drop(columns=[TARGET_COLUMN])
    if "customerID" in X.columns:
        X = X.drop(columns=["customerID"])
    y = train_df[TARGET_COLUMN].to_numpy()

    min_frequency = params.features.min_frequency
    feature_params = params.features

    git_sha = _git_sha()
    dataset_hash = _dataset_hash()

    comparison: list[dict[str, Any]] = []

    # --- Baseline: logistic regression -------------------------------------
    with mlflow.start_run(run_name="logistic-baseline") as run:
        pipeline = build_candidate("logistic", params.model, feature_params, min_frequency)
        metrics = _cv_metrics(pipeline, X, y, params)
        mlflow.log_params({"model": "logistic", **params.model.logistic.model_dump()})
        for key, value in metrics.items():
            mlflow.log_metric(key, value)
        _log_mlflow_common(params, git_sha, dataset_hash)
        comparison.append({"model": "logistic", **metrics})
        logger.info("logistic CV", extra=metrics)

    # --- LightGBM with Optuna tuning ---------------------------------------
    best_lgb_params: dict[str, Any] = {}
    best_score = -float("inf")

    def objective(trial: optuna.Trial) -> float:
        nonlocal best_lgb_params, best_score
        candidate_params = params.model.lightgbm.model_copy(
            update={
                "n_estimators": trial.suggest_int("n_estimators", 100, 600, step=50),
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
                "num_leaves": trial.suggest_int("num_leaves", 15, 63),
                "max_depth": trial.suggest_int("max_depth", -1, 12),
                "min_child_samples": trial.suggest_int("min_child_samples", 5, 60),
                "subsample": trial.suggest_float("subsample", 0.6, 1.0),
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
                "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 1.0, log=True),
                "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
            }
        )
        # class imbalance handling
        pos = float(y.sum())
        neg = float(len(y) - y.sum())
        candidate_params = candidate_params.model_copy(
            update={"scale_pos_weight": neg / max(pos, 1.0)}
        )

        lgb_params = candidate_params
        pipeline = build_candidate("lightgbm", _params_with_lgb(params, lgb_params).model, feature_params, min_frequency)

        with mlflow.start_run(run_name=f"lgb-trial-{trial.number}", nested=True):
            metrics = _cv_metrics(pipeline, X, y, params)
            mlflow.log_params(lgb_params.model_dump())
            for key, value in metrics.items():
                mlflow.log_metric(key, value)
            mlflow.set_tag("trial", str(trial.number))
        score = metrics["pr_auc_mean"]
        if score > best_score:
            best_score = score
            best_lgb_params = lgb_params.model_dump()
        return score

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    sampler = optuna.samplers.TPESampler(seed=params.model.optuna.seed)
    if params.model.optuna.pruner == "median":
        pruner: optuna.pruners.BasePruner = optuna.pruners.MedianPruner()
    elif params.model.optuna.pruner == "hyperband":
        pruner = optuna.pruners.HyperbandPruner()
    else:
        pruner = optuna.pruners.NopPruner()

    study = optuna.create_study(direction="maximize", sampler=sampler, pruner=pruner)
    study.optimize(
        objective,
        n_trials=params.model.optuna.n_trials,
        timeout=params.model.optuna.timeout,
        show_progress_bar=False,
    )

    # --- Tuned LightGBM CV for comparison ----------------------------------
    tuned_model_params = _params_with_lgb(params, _params_from_dict(params, best_lgb_params))
    with mlflow.start_run(run_name="lightgbm-tuned") as run:
        pipeline = build_candidate("lightgbm", tuned_model_params.model, feature_params, min_frequency)
        metrics = _cv_metrics(pipeline, X, y, params)
        mlflow.log_params({"model": "lightgbm", **best_lgb_params})
        for key, value in metrics.items():
            mlflow.log_metric(key, value)
        _log_mlflow_common(params, git_sha, dataset_hash)
        comparison.append({"model": "lightgbm-tuned", **metrics})
        logger.info("lightgbm tuned CV", extra=metrics)

    # --- Select best candidate ------------------------------------------------
    best_entry = max(comparison, key=lambda entry: entry["pr_auc_mean"])
    best_name = best_entry["model"]
    logger.info("best candidate", extra={"model": best_name, "pr_auc": best_entry["pr_auc_mean"]})

    # --- Train final uncalibrated pipeline on full training split -------------
    if best_name.startswith("lightgbm"):
        final_model_params = tuned_model_params.model
        final_name = "lightgbm"
    else:
        final_model_params = params.model
        final_name = "logistic"

    final_pipeline = build_candidate(final_name, final_model_params, feature_params, min_frequency)
    final_pipeline.fit(X, y)

    # Persist the uncalibrated pipeline temporarily so calibrate.py can load it.
    import joblib  # type: ignore[import-untyped]

    paths.models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(final_pipeline, paths.models_dir / "uncalibrated_pipeline.joblib")

    # --- Write comparison report --------------------------------------------
    comparison_path = paths.reports_dir / "model_comparison.json"
    comparison_path.parent.mkdir(parents=True, exist_ok=True)
    comparison_path.write_text(json.dumps(comparison, indent=2), encoding="utf-8")

    summary = {
        "best_model": best_name,
        "comparison": comparison,
        "best_params": best_lgb_params if best_name.startswith("lightgbm") else params.model.logistic.model_dump(),
        "git_sha": git_sha,
    }
    return summary


def _params_with_lgb(params: Params, lgb_params: Any) -> Params:
    from churn.config import ModelParams

    new_model = params.model.model_copy(update={"lightgbm": lgb_params})
    return params.model_copy(update={"model": new_model})


def _params_from_dict(params: Params, payload: dict[str, Any]) -> Any:
    from churn.config import LightGBMParams

    return LightGBMParams.model_validate(payload)


def main() -> None:
    params = load_params()
    summary = train(params)
    print(json.dumps({k: v for k, v in summary.items() if k != "comparison"}, indent=2))


if __name__ == "__main__":
    main()
