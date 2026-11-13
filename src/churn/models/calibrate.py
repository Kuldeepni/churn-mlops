"""Probability calibration of the fitted pipeline on the validation split."""

from __future__ import annotations

from typing import Any

import json
import logging
from pathlib import Path

import joblib  # type: ignore[import-untyped]
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
from sklearn.metrics import brier_score_loss

from churn.config import Params, get_paths, load_params
from churn.data.schema import TARGET_COLUMN
from churn.logging_config import get_logger

logger = get_logger(__name__)


def calibrate(params: Params | None = None) -> dict[str, Any]:
    """Calibrate the uncalibrated pipeline and persist the better calibrator.

    Compares isotonic vs sigmoid on the validation split by Brier score and
    keeps the better one.
    """
    params = params or load_params()
    paths = get_paths()
    paths.ensure_dirs()

    uncalibrated_path = paths.models_dir / "uncalibrated_pipeline.joblib"
    if not uncalibrated_path.is_file():
        raise FileNotFoundError(f"uncalibrated pipeline not found: {uncalibrated_path}")

    pipeline = joblib.load(uncalibrated_path)

    val_df = pd.read_parquet(paths.val_parquet)
    X_val = val_df.drop(columns=[TARGET_COLUMN])
    if "customerID" in X_val.columns:
        X_val = X_val.drop(columns=["customerID"])
    y_val = val_df[TARGET_COLUMN].to_numpy()

    methods = params.calibration.methods
    scores: dict[str, float] = {}
    calibrators: dict[str, object] = {}
    for method in methods:
        calibrated = CalibratedClassifierCV(
            FrozenEstimator(pipeline),
            method=method,
            cv=None,
        )
        calibrated.fit(X_val, y_val)
        proba = calibrated.predict_proba(X_val)[:, 1]
        scores[method] = float(brier_score_loss(y_val, proba))
        calibrators[method] = calibrated
        logger.info("calibration candidate", extra={"method": method, "brier": scores[method]})

    best_method = min(scores, key=lambda m: scores[m])
    best_calibrator = calibrators[best_method]

    # Persist the chosen calibrator as the serving pipeline.
    joblib.dump(best_calibrator, paths.models_dir / "calibrated_pipeline.joblib")

    # Uncalibrated Brier for reporting.
    uncalibrated_proba = pipeline.predict_proba(X_val)[:, 1]
    uncalibrated_brier = float(brier_score_loss(y_val, uncalibrated_proba))
    calibrated_brier = scores[best_method]

    report = {
        "chosen_method": best_method,
        "brier_uncalibrated": uncalibrated_brier,
        "brier_calibrated": calibrated_brier,
        "all_methods": scores,
    }
    threshold_path = paths.reports_dir / "calibration.json"
    threshold_path.parent.mkdir(parents=True, exist_ok=True)
    threshold_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    logger.info("calibration complete", extra=report)
    return report


def main() -> None:
    params = load_params()
    report = calibrate(params)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
