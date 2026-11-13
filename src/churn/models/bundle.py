"""Export a self-contained serving bundle (no MLflow dependency at serve time)."""

from __future__ import annotations

from typing import Any

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib  # type: ignore[import-untyped]
import numpy as np
import pandas as pd

from churn.config import Params, get_paths, load_params
from churn.data.schema import TARGET_COLUMN
from churn.features import FeatureEngineer
from churn.logging_config import get_logger
from churn.models.explain import build_explainer

logger = get_logger(__name__)


def _schema_hash() -> str:
    """Hash of the canonical schema enums (used to detect code/data drift)."""
    from churn.data import schema as schema_module

    payload = {
        name: getattr(schema_module, name)
        for name in dir(schema_module)
        if name.endswith("_VALUES") or name.endswith("_COLUMNS")
    }
    # Convert non-serialisable objects (lists are fine).
    serialisable = {key: (value if not callable(value) else str(value)) for key, value in payload.items()}
    return hashlib.sha256(json.dumps(serialisable, sort_keys=True, default=str).encode()).hexdigest()


def _reference_stats(train_df: pd.DataFrame) -> dict[str, Any]:
    """Per-feature distributions used by the drift detector."""
    stats: dict[str, Any] = {}
    for column in train_df.columns:
        if column in (TARGET_COLUMN, "customerID"):
            continue
        series = train_df[column]
        if pd.api.types.is_numeric_dtype(series):
            stats[column] = {
                "type": "numeric",
                "values": series.astype(float).tolist()[:5000],  # cap for size
                "mean": float(series.mean()),
                "std": float(series.std(ddof=0)),
                "min": float(series.min()),
                "max": float(series.max()),
            }
        else:
            counts = series.astype(str).value_counts(normalize=True).to_dict()
            stats[column] = {
                "type": "categorical",
                "frequencies": {str(k): float(v) for k, v in counts.items()},
            }
    return stats


def export_bundle(
    calibrated_pipeline: Any,
    base_pipeline: Any,
    threshold: float,
    metrics: dict[str, Any],
    params: Params,
    train_df: pd.DataFrame,
    git_sha: str,
) -> Path:
    """Write the serving bundle to ``models/`` and return its directory."""
    paths = get_paths()
    paths.models_dir.mkdir(parents=True, exist_ok=True)

    joblib.dump(calibrated_pipeline, paths.models_dir / "pipeline.joblib")
    joblib.dump(base_pipeline, paths.models_dir / "base_pipeline.joblib")

    threshold_payload = json.loads((paths.reports_dir / "threshold.json").read_text(encoding="utf-8"))
    (paths.models_dir / "threshold.json").write_text(json.dumps(threshold_payload, indent=2), encoding="utf-8")

    metadata = {
        "version": "0.1.0",
        "git_sha": git_sha,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
        "threshold": threshold,
        "feature_list": list(train_df.drop(columns=[TARGET_COLUMN, "customerID"], errors="ignore").columns),
        "schema_hash": _schema_hash(),
        "params": params.model_dump(),
    }
    (paths.models_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    stats = _reference_stats(train_df.drop(columns=[TARGET_COLUMN], errors="ignore"))
    (paths.models_dir / "reference_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")

    logger.info("bundle exported", extra={"dir": str(paths.models_dir)})
    return paths.models_dir


def main() -> None:
    import argparse

    from churn.config import load_params
    from churn.models.calibrate import calibrate
    from churn.models.threshold import run_threshold_optimization

    args = None
    params = load_params()
    paths = get_paths()

    calibrated = joblib.load(paths.models_dir / "calibrated_pipeline.joblib")
    base = joblib.load(paths.models_dir / "uncalibrated_pipeline.joblib")
    threshold_payload = json.loads((paths.reports_dir / "threshold.json").read_text(encoding="utf-8"))
    threshold = threshold_payload["threshold"]

    metrics_path = paths.reports_dir / "metrics.json"
    metrics = json.loads(metrics_path.read_text(encoding="utf-8")) if metrics_path.is_file() else {}

    train_df = pd.read_parquet(paths.train_parquet)
    git_sha = "unknown"
    try:
        import subprocess

        git_sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip() or "unknown"
    except Exception:  # noqa: BLE001
        pass

    export_bundle(calibrated, base, threshold, metrics, params, train_df, git_sha)
    print(f"bundle written to {paths.models_dir}")


if __name__ == "__main__":
    import joblib  # type: ignore[import-untyped]

    main()
