"""Test-set evaluation, bootstrap confidence intervals and quality gate."""

from __future__ import annotations

import json
import sys
from typing import Any

import joblib  # type: ignore[import-untyped]
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

from churn.config import Params, get_paths, load_params
from churn.data.schema import TARGET_COLUMN
from churn.logging_config import get_logger
from churn.models.explain import build_explainer

logger = get_logger(__name__)


def _bootstrap_ci(
    y_true: Any, proba: Any, metric_fn: Any, n_iter: int, seed: int
) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    n = len(y_true)
    values: list[float] = []
    for _ in range(n_iter):
        idx = rng.integers(0, n, size=n)
        try:
            values.append(metric_fn(y_true[idx], proba[idx]))
        except ValueError:
            continue
    arr = np.asarray(values)
    return float(np.percentile(arr, 2.5)), float(np.percentile(arr, 97.5))


def evaluate(params: Params | None = None) -> dict[str, Any]:
    params = params or load_params()
    paths = get_paths()
    paths.ensure_dirs()

    calibrated = joblib.load(paths.models_dir / "pipeline.joblib")
    base = joblib.load(paths.models_dir / "base_pipeline.joblib")

    test_df = pd.read_parquet(paths.test_parquet)
    X_test = test_df.drop(columns=[TARGET_COLUMN])
    if "customerID" in X_test.columns:
        X_test = X_test.drop(columns=["customerID"])
    y_test = test_df[TARGET_COLUMN].to_numpy()

    proba = calibrated.predict_proba(X_test)[:, 1]

    threshold_payload = json.loads(
        (paths.models_dir / "threshold.json").read_text(encoding="utf-8")
    )
    threshold = float(threshold_payload["threshold"])

    pred = (proba >= threshold).astype(int)

    roc_auc = float(roc_auc_score(y_test, proba))
    pr_auc = float(average_precision_score(y_test, proba))
    precision = float(precision_score(y_test, pred, zero_division=0))
    recall = float(recall_score(y_test, pred, zero_division=0))
    f1 = float(f1_score(y_test, pred, zero_division=0))
    brier = float(brier_score_loss(y_test, proba))

    # Uncalibrated Brier for before/after comparison.
    uncalibrated_proba = base.predict_proba(X_test)[:, 1]
    brier_uncalibrated = float(brier_score_loss(y_test, uncalibrated_proba))

    # Net benefit.

    tp = params.threshold
    net_benefit = 0.0
    for yt, p in zip(y_test, pred, strict=False):
        if p == 0:
            continue
        if yt == 1:
            net_benefit += tp.expected_value_if_churner
        else:
            net_benefit += tp.expected_value_if_not_churner
    net_per_1000 = net_benefit * (1000.0 / len(y_test))

    # Bootstrap CIs.
    pr_ci = _bootstrap_ci(
        y_test, proba, average_precision_score, params.evaluation.bootstrap_iterations, params.seed
    )
    net_fn = lambda yt, pr: (  # noqa: E731
        sum(
            (tp.expected_value_if_churner if y == 1 else tp.expected_value_if_not_churner)
            for y, p in zip(yt, (pr >= threshold).astype(int), strict=False)
            if p == 1
        )
        * (1000.0 / len(yt))
    )
    net_ci = _bootstrap_ci(
        y_test,
        proba,
        net_fn,
        params.evaluation.bootstrap_iterations,
        params.seed + 1,
    )

    # Confusion matrix.
    cm = confusion_matrix(y_test, pred).tolist()

    # Subgroup analysis.
    subgroup_results: dict[str, dict[str, Any]] = {}
    for col in ("gender", "SeniorCitizen"):
        if col not in test_df.columns:
            continue
        subgroup_results[col] = {}
        for value in sorted(test_df[col].astype(str).unique()):
            mask = (test_df[col].astype(str) == value).to_numpy()
            if mask.sum() == 0:
                continue
            subgroup_results[col][value] = {
                "n": int(mask.sum()),
                "recall": float(recall_score(y_test[mask], pred[mask], zero_division=0)),
                "precision": float(precision_score(y_test[mask], pred[mask], zero_division=0)),
                "churn_rate": float(y_test[mask].mean()),
            }

    # Figures.
    fig_dir = paths.figures_dir
    fig_dir.mkdir(parents=True, exist_ok=True)

    # ROC curve
    fpr, tpr, _ = roc_curve(y_test, proba)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(fpr, tpr, label=f"ROC-AUC = {roc_auc:.3f}")
    ax.plot([0, 1], [0, 1], "k--", alpha=0.4)
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.set_title("ROC curve (test set)")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_dir / "roc_curve.png", dpi=120)
    plt.close(fig)

    # PR curve
    precisions, recalls, _ = precision_recall_curve(y_test, proba)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(recalls, precisions, label=f"PR-AUC = {pr_auc:.3f}")
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title("Precision-Recall curve (test set)")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_dir / "pr_curve.png", dpi=120)
    plt.close(fig)

    # Calibration curve (before vs after)
    from sklearn.calibration import calibration_curve

    frac_pos_uncal, mean_pred_uncal = calibration_curve(y_test, uncalibrated_proba, n_bins=10)
    frac_pos_cal, mean_pred_cal = calibration_curve(y_test, proba, n_bins=10)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(mean_pred_uncal, frac_pos_uncal, "s-", label="uncalibrated")
    ax.plot(mean_pred_cal, frac_pos_cal, "o-", label="calibrated")
    ax.plot([0, 1], [0, 1], "k--", alpha=0.4)
    ax.set_xlabel("Mean predicted probability")
    ax.set_ylabel("Fraction of positives")
    ax.set_title("Calibration curve (test set)")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_dir / "calibration_curve.png", dpi=120)
    plt.close(fig)

    # Confusion matrix
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.imshow(cm, cmap="Blues")
    for i in range(2):
        for j in range(2):
            ax.text(j, i, cm[i][j], ha="center", va="center", color="black")
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(["pred 0", "pred 1"])
    ax.set_yticklabels(["true 0", "true 1"])
    ax.set_title("Confusion matrix (test set)")
    fig.tight_layout()
    fig.savefig(fig_dir / "confusion_matrix.png", dpi=120)
    plt.close(fig)

    # SHAP figures
    try:
        explainer = build_explainer(
            base, background=X_test.sample(min(200, len(X_test)), random_state=params.seed)
        )
        matrix = explainer._transform(
            X_test.sample(min(300, len(X_test)), random_state=params.seed)
        )
        shap_values = explainer.explainer.shap_values(matrix)
        if isinstance(shap_values, list):
            shap_values = shap_values[1] if len(shap_values) > 1 else shap_values[0]
        shap_values = np.asarray(shap_values)
        if shap_values.ndim == 3:
            shap_values = shap_values[:, :, 1]

        shap.summary_plot(
            shap_values, matrix, feature_names=explainer.readable, show=False, max_display=15
        )
        plt.tight_layout()
        plt.savefig(fig_dir / "shap_summary.png", dpi=120, bbox_inches="tight")
        plt.close()

        shap.summary_plot(
            shap_values,
            matrix,
            feature_names=explainer.readable,
            plot_type="bar",
            show=False,
            max_display=15,
        )
        plt.tight_layout()
        plt.savefig(fig_dir / "shap_bar.png", dpi=120, bbox_inches="tight")
        plt.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("SHAP figures skipped", extra={"error": str(exc)})

    metrics = {
        "roc_auc": roc_auc,
        "pr_auc": pr_auc,
        "pr_auc_ci": [pr_ci[0], pr_ci[1]],
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "brier": brier,
        "brier_uncalibrated": brier_uncalibrated,
        "threshold": threshold,
        "net_benefit_per_1000": net_per_1000,
        "net_benefit_per_1000_ci": [net_ci[0], net_ci[1]],
        "confusion_matrix": cm,
        "subgroups": subgroup_results,
        "n_test": int(len(y_test)),
    }
    paths.metrics_json.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    logger.info("evaluation complete", extra={"pr_auc": pr_auc, "recall": recall})

    # Quality gate.
    gate_passed = pr_auc >= params.evaluation.min_pr_auc and recall >= params.evaluation.min_recall
    if not gate_passed:
        logger.error(
            "quality gate FAILED",
            extra={
                "pr_auc": pr_auc,
                "min_pr_auc": params.evaluation.min_pr_auc,
                "recall": recall,
                "min_recall": params.evaluation.min_recall,
            },
        )
        print(
            f"QUALITY GATE FAILED: pr_auc={pr_auc:.4f} (min {params.evaluation.min_pr_auc}) "
            f"recall={recall:.4f} (min {params.evaluation.min_recall})"
        )
        sys.exit(1)
    print(
        f"QUALITY GATE PASSED: pr_auc={pr_auc:.4f} recall={recall:.4f} "
        f"threshold={threshold:.2f} net_benefit_per_1000={net_per_1000:.0f}"
    )
    return metrics


def main() -> None:
    params = load_params()
    evaluate(params)


if __name__ == "__main__":
    main()
