"""churn-mlops: cost-optimized telecom churn prediction with a full MLOps loop.

The package is intentionally layered so that each concern can be tested and
replaced independently:

``churn.data``
    Idempotent ingestion, schema validation, cleaning and leakage-safe splitting.
``churn.features``
    Feature engineering that lives *inside* the sklearn pipeline.
``churn.models``
    Candidate models, tuning, calibration, thresholding, explanation, registry.
``churn.monitoring``
    Population stability index / KS based drift detection and a traffic simulator.
``churn.api``
    FastAPI service that serves a self-contained model bundle.
"""

from __future__ import annotations

__version__ = "0.1.0"

__all__ = ["__version__"]
