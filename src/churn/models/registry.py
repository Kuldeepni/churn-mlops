"""MLflow model registry promotion using aliases."""

from __future__ import annotations

from typing import Any

import json
import logging
from pathlib import Path
from typing import Any

import pandas as pd
import mlflow
from mlflow import MlflowClient
from mlflow.models import infer_signature

from churn.config import get_settings, load_params
from churn.logging_config import get_logger

logger = get_logger(__name__)


def register_model(
    pipeline: Any,
    X_example: pd.DataFrame,
    metrics: dict[str, Any],
    params: Any,
    git_sha: str,
    validation_pr_auc: float,
    current_champion_pr_auc: float | None,
) -> str:
    """Register the calibrated model and assign an alias (champion/challenger)."""
    settings = get_settings()
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    model_name = settings.mlflow_registry_model
    try:
        client.create_registered_model(model_name)
    except Exception:  # noqa: BLE001 - model may already exist
        pass

    with mlflow.start_run(run_name="registry") as run:
        signature = infer_signature(X_example, pipeline.predict_proba(X_example)[:, 1])
        model_info = mlflow.sklearn.log_model(
            sk_model=pipeline,
            artifact_path="model",
            signature=signature,
            input_example=X_example.head(3),
            registered_model_name=model_name,
        )
        run_id = run.info.run_id

    # Determine version number.
    versions = client.search_model_versions(f"name='{model_name}'")
    latest = max(versions, key=lambda v: int(v.version)) if versions else None
    version = latest.version if latest else "1"

    # Promotion decision.
    promotes = current_champion_pr_auc is None or validation_pr_auc > current_champion_pr_auc
    alias = "champion" if promotes else "challenger"
    try:
        client.set_registered_model_alias(model_name, alias, version)
    except Exception as exc:  # noqa: BLE001
        logger.warning("could not set alias", extra={"error": str(exc)})

    # Attach useful tags.
    try:
        client.set_model_version_tag(model_name, version, "git_sha", git_sha)
        client.set_model_version_tag(model_name, version, "validation_pr_auc", f"{validation_pr_auc:.6f}")
    except Exception as exc:  # noqa: BLE001
        logger.warning("could not tag model version", extra={"error": str(exc)})

    logger.info("model registered", extra={"model_name": model_name, "version": version, "alias": alias})
    return version
