"""Cost-based decision threshold optimization."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib  # type: ignore[import-untyped]
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from churn.config import Params, ThresholdParams, get_paths, load_params
from churn.data.schema import TARGET_COLUMN
from churn.logging_config import get_logger

logger = get_logger(__name__)


def expected_net_benefit(
    y_true: Any,
    proba: Any,
    threshold: float,
    params: ThresholdParams,
) -> float:
    """Total expected net benefit (in money) of targeting customers above ``threshold``.

    For a targeted customer:
      * churner  -> ``offer_success_rate * CLV - offer_cost``
      * non-churner -> ``-offer_cost``
    Untargeted customers contribute 0.
    """
    targeted = proba >= threshold
    benefit = 0.0
    for yt, is_targeted in zip(y_true, targeted):
        if not is_targeted:
            continue
        if yt == 1:
            benefit += params.expected_value_if_churner
        else:
            benefit += params.expected_value_if_not_churner
    return float(benefit)


def optimize_threshold(
    y_true: Any,
    proba: Any,
    params: ThresholdParams,
) -> tuple[float, dict[str, Any]]:
    """Sweep thresholds and return the one maximizing expected net benefit."""
    thresholds = np.linspace(params.sweep_min, params.sweep_max, params.sweep_steps)
    curve: list[dict[str, float]] = []
    best_threshold = float(thresholds[0])
    best_benefit = -float("inf")
    n = len(y_true)
    scale = 1000.0 / max(n, 1)

    for threshold in thresholds:
        benefit = expected_net_benefit(y_true, proba, float(threshold), params)
        per_1000 = benefit * scale
        curve.append({"threshold": float(threshold), "net_benefit": benefit, "per_1000": per_1000})
        if benefit >= best_benefit:
            best_benefit = benefit
            best_threshold = float(threshold)

    # Baselines for the report.
    target_all_benefit = expected_net_benefit(y_true, np.ones_like(proba), 0.0, params)
    target_none_benefit = 0.0
    threshold_half_benefit = expected_net_benefit(y_true, proba, 0.5, params)

    summary = {
        "chosen_threshold": best_threshold,
        "expected_net_benefit_per_1000": best_benefit * scale,
        "expected_net_benefit_per_1000_at_0.5": threshold_half_benefit * scale,
        "expected_net_benefit_per_1000_target_all": target_all_benefit * scale,
        "expected_net_benefit_per_1000_target_none": target_none_benefit,
        "n_customers": n,
        "curve": curve,
    }
    return best_threshold, summary


def run_threshold_optimization(params: Params | None = None) -> dict[str, Any]:
    params = params or load_params()
    paths = get_paths()
    paths.ensure_dirs()

    calibrated_pipeline = joblib.load(paths.models_dir / "calibrated_pipeline.joblib")
    val_df = pd.read_parquet(paths.val_parquet)
    X_val = val_df.drop(columns=[TARGET_COLUMN])
    if "customerID" in X_val.columns:
        X_val = X_val.drop(columns=["customerID"])
    y_val = val_df[TARGET_COLUMN].to_numpy()
    proba = calibrated_pipeline.predict_proba(X_val)[:, 1]

    threshold, summary = optimize_threshold(y_val, proba, params.threshold)

    # Plot threshold vs profit.
    fig, ax = plt.subplots(figsize=(8, 5))
    xs = [entry["threshold"] for entry in summary["curve"]]
    ys = [entry["per_1000"] for entry in summary["curve"]]
    ax.plot(xs, ys, color="#1f77b4", linewidth=2)
    ax.axvline(threshold, color="#d62728", linestyle="--", label=f"chosen = {threshold:.2f}")
    ax.axvline(0.5, color="#7f7f7f", linestyle=":", label="0.5")
    ax.set_xlabel("Decision threshold")
    ax.set_ylabel("Expected net benefit per 1,000 customers")
    ax.set_title("Cost-based threshold selection")
    ax.legend()
    ax.grid(alpha=0.3)
    figure_path = paths.figures_dir / "threshold_vs_profit.png"
    figure_path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(figure_path, dpi=120)
    plt.close(fig)

    # Persist threshold.json (used by the serving bundle).
    threshold_payload = {
        "threshold": threshold,
        "cost_params": params.threshold.model_dump(),
        "validation_summary": {k: v for k, v in summary.items() if k != "curve"},
    }
    (paths.reports_dir / "threshold.json").write_text(json.dumps(threshold_payload, indent=2), encoding="utf-8")
    (paths.reports_dir / "threshold_curve.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    logger.info("threshold optimized", extra={"threshold": threshold, "per_1000": summary["expected_net_benefit_per_1000"]})
    return summary


def main() -> None:
    params = load_params()
    summary = run_threshold_optimization(params)
    print(json.dumps({k: v for k, v in summary.items() if k != "curve"}, indent=2))


if __name__ == "__main__":
    main()
