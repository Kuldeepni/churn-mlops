"""Prometheus metrics for the serving API."""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

REQUEST_COUNT = Counter(
    "churn_api_requests_total",
    "Total HTTP requests handled by the API",
    labelnames=("method", "path", "status"),
)
REQUEST_LATENCY = Histogram(
    "churn_api_request_latency_seconds",
    "Request latency in seconds",
    labelnames=("method", "path"),
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)
PREDICTIONS_TOTAL = Counter(
    "churn_predictions_total",
    "Number of predictions produced",
    labelnames=("risk_band", "will_churn"),
)
PREDICTION_PROBABILITY = Histogram(
    "churn_prediction_probability",
    "Distribution of predicted churn probabilities",
    buckets=(0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0),
)
MODEL_INFO = Gauge(
    "churn_model_info",
    "Static information about the loaded model",
    labelnames=("version", "git_sha"),
)
MODEL_LOADED = Gauge("churn_model_loaded", "Whether a model bundle is currently loaded")


def update_model_info(version: str, git_sha: str) -> None:
    MODEL_INFO.labels(version=version, git_sha=git_sha).set(1)
    MODEL_LOADED.set(1)
