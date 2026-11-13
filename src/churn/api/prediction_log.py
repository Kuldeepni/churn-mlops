"""Thread-safe JSONL prediction logger (background task, never blocks the response)."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from churn.config import get_settings
from churn.logging_config import get_logger

logger = get_logger(__name__)

_LOCK = threading.Lock()


def append_prediction_log(
    features: list[dict[str, Any]], predictions: list[dict[str, Any]], request_id: str | None
) -> None:
    """Append one record per instance to the configured JSONL file."""
    settings = get_settings()
    path: Path = settings.prediction_log
    path.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    lines = []
    for feat, pred in zip(features, predictions, strict=False):
        record = {
            "timestamp": timestamp,
            "request_id": request_id,
            "features": feat,
            "prediction": pred,
        }
        lines.append(json.dumps(record, default=str))
    try:
        with _LOCK, path.open("a", encoding="utf-8") as handle:
            for line in lines:
                handle.write(line + "\n")
    except Exception as exc:  # noqa: BLE001
        logger.warning("prediction log write failed", extra={"error": str(exc)})
