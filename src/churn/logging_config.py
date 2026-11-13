"""Structured JSON logging.

Every module in the project uses ``logging.getLogger(__name__)``. The logging
setup happens exactly once, either implicitly on the first call to
:func:`get_logger` or explicitly through :func:`configure_logging`.

The output format is one JSON object per line so that log shippers (Loki,
CloudWatch, Datadog, ...) can parse it without additional regexes.
"""

from __future__ import annotations

import json
import logging
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

from churn.config import get_settings

_CONFIGURED = False

#: Attributes that ``logging`` adds to every record; they must not be duplicated.
_RESERVED_RECORD_KEYS = frozenset(
    {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "module",
        "msecs",
        "message",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "taskName",
        "thread",
        "threadName",
    }
)

#: Request scoped key/value pairs injected into every record emitted inside the block.
_LOG_CONTEXT: ContextVar[dict[str, Any] | None] = ContextVar("churn_log_context", default=None)


class JsonFormatter(logging.Formatter):
    """Render log records as single-line JSON documents."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        context = _LOG_CONTEXT.get()
        if context:
            payload.update(context)
        for key, value in record.__dict__.items():
            if key in _RESERVED_RECORD_KEYS or key.startswith("_"):
                continue
            payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


class ConsoleFormatter(logging.Formatter):
    """Human friendly formatter used when JSON logging is disabled."""

    def format(self, record: logging.LogRecord) -> str:
        base = f"{record.levelname:<8} {record.name:<38} {record.getMessage()}"
        extras = {
            key: value
            for key, value in record.__dict__.items()
            if key not in _RESERVED_RECORD_KEYS and not key.startswith("_")
        }
        if extras:
            base = f"{base} | {json.dumps(extras, default=str, ensure_ascii=False)}"
        return base


def configure_logging(force: bool = False) -> None:
    """Configure the root logger exactly once."""
    global _CONFIGURED  # noqa: PLW0603
    if _CONFIGURED and not force:
        return

    settings = get_settings()
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(JsonFormatter() if settings.log_json else ConsoleFormatter())

    root = logging.getLogger()
    for existing in list(root.handlers):
        root.removeHandler(existing)
    root.addHandler(handler)
    root.setLevel(settings.log_level)

    # Third party libraries are noisy at INFO level; keep the output readable.
    for noisy in ("uvicorn.access", "uvicorn.error", "mlflow", "dvc", "matplotlib", "shap"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a logger, configuring logging on first use."""
    configure_logging()
    return logging.getLogger(name)


@contextmanager
def log_context(**context: Any) -> Iterator[None]:
    """Attach ``context`` to every log record emitted inside the block.

    Example
    -------
    >>> with log_context(request_id="abc"):
    ...     logger.info("handled")
    """
    previous = _LOG_CONTEXT.get() or {}
    token = _LOG_CONTEXT.set({**previous, **context})
    try:
        yield
    finally:
        _LOG_CONTEXT.reset(token)
