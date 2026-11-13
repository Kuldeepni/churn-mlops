"""Load and serve the model bundle from disk."""

from __future__ import annotations

import json
from typing import Any

import joblib  # type: ignore[import-untyped]
import pandas as pd

from churn.config import get_settings
from churn.logging_config import get_logger

logger = get_logger(__name__)

_STATE: dict[str, Any] = {
    "ready": False,
    "pipeline": None,
    "base_pipeline": None,
    "explainer": None,
    "threshold": None,
    "metadata": None,
    "reference_stats": None,
    "reason": None,
}


def _schema_hash() -> str:
    from churn.models.bundle import _schema_hash as bundle_schema_hash

    return bundle_schema_hash()


def load_bundle() -> None:
    """Load the serving bundle into the in-process state. Raises on failure."""
    global _STATE  # noqa: PLW0603
    settings = get_settings()
    model_dir = settings.model_dir
    try:
        pipeline = joblib.load(model_dir / "pipeline.joblib")
        base_pipeline = joblib.load(model_dir / "base_pipeline.joblib")
        threshold_payload = json.loads((model_dir / "threshold.json").read_text(encoding="utf-8"))
        metadata = json.loads((model_dir / "metadata.json").read_text(encoding="utf-8"))
        reference_stats = json.loads(
            (model_dir / "reference_stats.json").read_text(encoding="utf-8")
        )

        # Schema hash check: code and bundle must agree.
        if metadata.get("schema_hash") != _schema_hash():
            raise RuntimeError("schema hash mismatch between code and bundle; rebuild the bundle")

        from churn.models.explain import build_explainer

        explainer = None
        try:
            explainer = build_explainer(base_pipeline)
        except Exception as exc:  # noqa: BLE001
            logger.warning("explainer unavailable", extra={"error": str(exc)})

        _STATE = {
            "ready": True,
            "pipeline": pipeline,
            "base_pipeline": base_pipeline,
            "explainer": explainer,
            "threshold": float(threshold_payload["threshold"]),
            "metadata": metadata,
            "reference_stats": reference_stats,
            "reason": None,
        }
        logger.info("model bundle loaded", extra={"version": metadata.get("version")})
    except Exception as exc:  # noqa: BLE001
        _STATE = {
            "ready": False,
            "pipeline": None,
            "base_pipeline": None,
            "explainer": None,
            "threshold": None,
            "metadata": None,
            "reference_stats": None,
            "reason": str(exc),
        }
        logger.error("failed to load model bundle", extra={"error": str(exc)})
        raise


def is_ready() -> bool:
    return bool(_STATE["ready"])


def get_state() -> dict[str, Any]:
    return _STATE


def predict_proba(features_df: pd.DataFrame) -> Any:
    if not is_ready():
        raise RuntimeError("model not loaded")
    return _STATE["pipeline"].predict_proba(features_df)[:, 1]


def risk_band(probability: float, params: Any = None) -> str:
    from churn.config import load_params

    params = params or load_params().api
    if probability < params.risk_band_low:
        return "low"
    if probability < params.risk_band_high:
        return "medium"
    return "high"


def top_factors(df: pd.DataFrame, k: int = 3) -> Any:
    explainer = _STATE.get("explainer")
    if explainer is None:
        return [[] for _ in range(len(df))]
    try:
        return explainer.top_factors(df, k=k)
    except Exception as exc:  # noqa: BLE001
        logger.warning("explanation failed", extra={"error": str(exc)})
        return [[] for _ in range(len(df))]
