"""Idempotent dataset ingestion with retries, cache and a manifest."""

from __future__ import annotations

import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Final

import pandas as pd
import requests
from pydantic import BaseModel, ConfigDict

from churn.config import DataParams, load_params
from churn.logging_config import get_logger

logger = get_logger(__name__)

_MANIFEST_NAME: Final[str] = "manifest.json"
_CHECKSUM_ALGORITHM: Final[str] = "sha256"


class Manifest(BaseModel):
    model_config = ConfigDict(frozen=True)

    source_url: str
    sha256: str
    row_count: int
    column_count: int
    downloaded_at: str


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _fetch_with_retries(url: str, destination: Path, params: DataParams) -> None:
    """Download ``url`` to ``destination`` with exponential backoff."""
    last_error: Exception | None = None
    for attempt in range(params.download_retries + 1):
        try:
            response = requests.get(url, timeout=params.download_timeout_seconds)
            response.raise_for_status()
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(response.content)
            logger.info(
                "dataset downloaded",
                extra={"url": url, "attempt": attempt, "bytes": len(response.content)},
            )
            return
        except requests.RequestException as exc:
            last_error = exc
            wait = 2**attempt
            logger.warning(
                "download attempt failed",
                extra={"url": url, "attempt": attempt, "wait_seconds": wait, "error": str(exc)},
            )
            if attempt < params.download_retries:
                time.sleep(wait)
    assert last_error is not None
    raise RuntimeError(f"failed to download {url} after {params.download_retries + 1} attempts") from last_error


def _read_manifest(manifest_path: Path) -> Manifest | None:
    if not manifest_path.is_file():
        return None
    try:
        return Manifest.model_validate(json.loads(manifest_path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, ValueError):
        return None


def ingest(params: DataParams | None = None) -> Any:
    """Download the dataset if needed and write ``manifest.json``.

    Returns the path to the raw CSV. The function is idempotent: when the file
    already exists with a matching checksum it is not re-downloaded.
    """
    params = params or load_params().data
    paths = _paths_from_params()
    paths.raw_dir.mkdir(parents=True, exist_ok=True)
    destination = paths.raw_dir / "Telco-Customer-Churn.csv"
    manifest_path = paths.raw_dir / _MANIFEST_NAME

    manifest = _read_manifest(manifest_path)
    if destination.is_file() and manifest is not None and manifest.sha256 == _sha256(destination):
        logger.info("dataset cache hit", extra={"path": str(destination)})
        return destination

    urls = [params.url]
    if params.fallback_url and params.fallback_url != params.url:
        urls.append(params.fallback_url)

    last_error: Exception | None = None
    for url in urls:
        try:
            _fetch_with_retries(url, destination, params)
            last_error = None
            break
        except RuntimeError as exc:
            last_error = exc
            logger.warning("primary source failed, trying fallback", extra={"url": url, "error": str(exc)})
    if last_error is not None:
        raise last_error

    # Validate minimum row count before declaring success.
    frame = pd.read_csv(destination)
    if len(frame) < params.min_rows:
        raise RuntimeError(
            f"downloaded dataset has only {len(frame)} rows, expected at least {params.min_rows}"
        )
    if len(frame.columns) != params.expected_columns:
        logger.warning(
            "unexpected column count",
            extra={"expected": params.expected_columns, "actual": len(frame.columns)},
        )

    new_manifest = Manifest(
        source_url=params.url,
        sha256=_sha256(destination),
        row_count=len(frame),
        column_count=len(frame.columns),
        downloaded_at=datetime.now(timezone.utc).isoformat(),
    )
    manifest_path.write_text(new_manifest.model_dump_json(indent=2), encoding="utf-8")
    logger.info(
        "manifest written",
        extra={"rows": new_manifest.row_count, "columns": new_manifest.column_count},
    )
    return destination


def _paths_from_params() -> Any:  # noqa: F821
    from churn.config import get_paths

    return get_paths()


def main() -> None:
    from churn.config import load_params

    params = load_params().data
    destination = ingest(params)
    print(destination)


if __name__ == "__main__":
    main()
