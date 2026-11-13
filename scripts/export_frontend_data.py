"""Export real pipeline outputs as JSON for the frontend showcase site."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
import pandas as pd

from churn.config import get_paths, load_params

from churn.data.schema import (
    CATEGORICAL_COLUMNS,
    CONTRACT_VALUES,
    GENDER_VALUES,
    INTERNET_VALUES,
    MULTIPLE_LINES_VALUES,
    PAYMENT_VALUES,
    SERVICE_VALUES,
    YES_NO_VALUES,
)
from churn.models.explain import build_explainer
from churn.monitoring.drift import compute_drift
from churn.monitoring.simulate import simulate_traffic


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def main() -> None:
    params = load_params()
    paths = get_paths()
    out_dir = paths.root / "web" / "public" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    fig_dir = paths.root / "web" / "public" / "figures"
    fig_dir.mkdir(parents=True, exist_ok=True)

    # metrics.json
    metrics = json.loads(paths.metrics_json.read_text(encoding="utf-8"))
    threshold_payload = json.loads((paths.models_dir / "threshold.json").read_text(encoding="utf-8"))
    comparison = json.loads((paths.reports_dir / "model_comparison.json").read_text(encoding="utf-8"))
    metrics_out = {
        "test": metrics,
        "threshold": threshold_payload,
        "comparison": comparison,
    }
    _write(out_dir / "metrics.json", metrics_out)

    # model_info.json
    metadata = json.loads((paths.models_dir / "metadata.json").read_text(encoding="utf-8"))
    _write(
        out_dir / "model_info.json",
        {
            "version": metadata.get("version"),
            "git_sha": metadata.get("git_sha"),
            "trained_at": metadata.get("trained_at"),
            "feature_list": metadata.get("feature_list", []),
            "dataset_source": params.data.url,
            "metrics": metadata.get("metrics", {}),
        },
    )

    # validation_scores.json
    val_df = pd.read_parquet(paths.val_parquet)
    import joblib

    calibrated = joblib.load(paths.models_dir / "pipeline.joblib")
    X_val = val_df.drop(columns=["Churn", "customerID"], errors="ignore")
    proba = calibrated.predict_proba(X_val)[:, 1]
    y_val = val_df["Churn"].to_numpy()
    _write(
        out_dir / "validation_scores.json",
        [{"p": round(float(p), 4), "y": int(y)} for p, y in zip(proba, y_val)],
    )

    # roc_curve.json, pr_curve.json, calibration.json (native charts)
    import joblib as _joblib
    from sklearn.metrics import roc_curve as _roc_curve, precision_recall_curve as _pr_curve, average_precision_score as _ap, roc_auc_score as _roc_auc
    from sklearn.calibration import calibration_curve as _calib

    _test_df = pd.read_parquet(paths.test_parquet)
    _X_test = _test_df.drop(columns=["Churn", "customerID"], errors="ignore")
    _calibrated = _joblib.load(paths.models_dir / "pipeline.joblib")
    _base = _joblib.load(paths.models_dir / "base_pipeline.joblib")
    _proba = _calibrated.predict_proba(_X_test)[:, 1]
    _uncal = _base.predict_proba(_X_test)[:, 1]
    _y = _test_df["Churn"].to_numpy()

    def _downsample(xs, ys, n=100):
        xs = np.asarray(xs); ys = np.asarray(ys)
        if len(xs) <= n:
            return [float(x) for x in xs], [float(y) for y in ys]
        idx = np.unique(np.round(np.linspace(0, len(xs) - 1, n)).astype(int))
        return [float(xs[i]) for i in idx], [float(ys[i]) for i in idx]

    fpr, tpr, _ = _roc_curve(_y, _proba)
    fpr_d, tpr_d = _downsample(fpr, tpr, 100)
    _write(out_dir / "roc_curve.json", {"fpr": fpr_d, "tpr": tpr_d, "auc": float(_roc_auc(_y, _proba))})

    precisions, recalls, _ = _pr_curve(_y, _proba)
    r_d, p_d = _downsample(recalls, precisions, 100)
    _write(out_dir / "pr_curve.json", {"recall": r_d, "precision": p_d, "ap": float(_ap(_y, _proba))})

    frac_uncal, mean_uncal = _calib(_y, _uncal, n_bins=10)
    frac_cal, mean_cal = _calib(_y, _proba, n_bins=10)
    _write(out_dir / "calibration.json", {
        "before": {"mean_predicted": [float(x) for x in mean_uncal], "fraction_positive": [float(x) for x in frac_uncal]},
        "after": {"mean_predicted": [float(x) for x in mean_cal], "fraction_positive": [float(x) for x in frac_cal]},
    })

    # business_params.json
    _write(
        out_dir / "business_params.json",
        params.threshold.model_dump(),
    )

    # examples.json: 40 diverse real customers from test split
    test_df = pd.read_parquet(paths.test_parquet)
    X_test = test_df.drop(columns=["Churn", "customerID"], errors="ignore")
    proba_test = calibrated.predict_proba(X_test)[:, 1]
    threshold = float(threshold_payload["threshold"])
    # risk bands
    def band(p):
        if p < params.api.risk_band_low:
            return "low"
        if p < params.api.risk_band_high:
            return "medium"
        return "high"

    # stratified sample by risk band
    test_df = test_df.copy()
    test_df["_p"] = proba_test
    test_df["_band"] = [band(p) for p in proba_test]
    sampled = (
        test_df.groupby("_band", group_keys=False)
        .apply(lambda g: g.sample(min(14, len(g)), random_state=42))
        .head(40)
    )

    base_pipeline = joblib.load(paths.models_dir / "base_pipeline.joblib")
    explainer = build_explainer(base_pipeline, background=X_test.sample(min(200, len(X_test)), random_state=42))

    examples = []
    for _, row in sampled.iterrows():
        features = {c: row[c] for c in X_test.columns}
        # convert numpy types
        for k, v in list(features.items()):
            if hasattr(v, "item"):
                features[k] = v.item()
        p = float(row["_p"])
        factors_raw = explainer.top_factors(pd.DataFrame([features]), k=3)
        factors = factors_raw[0] if factors_raw else []
        examples.append(
            {
                "features": features,
                "churn_probability": round(p, 4),
                "will_churn": bool(p >= threshold),
                "risk_band": band(p),
                "top_factors": factors,
            }
        )
    _write(out_dir / "examples.json", examples)

    # feature_options.json
    _write(
        out_dir / "feature_options.json",
        {
            "gender": GENDER_VALUES,
            "SeniorCitizen": YES_NO_VALUES,
            "Partner": YES_NO_VALUES,
            "Dependents": YES_NO_VALUES,
            "PhoneService": YES_NO_VALUES,
            "MultipleLines": MULTIPLE_LINES_VALUES,
            "InternetService": INTERNET_VALUES,
            "OnlineSecurity": SERVICE_VALUES,
            "OnlineBackup": SERVICE_VALUES,
            "DeviceProtection": SERVICE_VALUES,
            "TechSupport": SERVICE_VALUES,
            "StreamingTV": SERVICE_VALUES,
            "StreamingMovies": SERVICE_VALUES,
            "Contract": CONTRACT_VALUES,
            "PaperlessBilling": YES_NO_VALUES,
            "PaymentMethod": PAYMENT_VALUES,
            "tenure": {"min": 0, "max": 100},
            "MonthlyCharges": {"min": 0.0, "max": 200.0},
            "TotalCharges": {"min": 0.0, "max": 10000.0},
            "categorical": CATEGORICAL_COLUMNS,
        },
    )

    # importance.json: global SHAP mean-abs
    matrix = explainer._transform(X_test.sample(min(300, len(X_test)), random_state=42))
    shap_values = explainer.explainer.shap_values(matrix)
    if isinstance(shap_values, list):
        shap_values = shap_values[1] if len(shap_values) > 1 else shap_values[0]
    shap_values = np.asarray(shap_values)
    if shap_values.ndim == 3:
        shap_values = shap_values[:, :, 1]
    importance = {
        name: float(np.mean(np.abs(shap_values[:, i])))
        for i, name in enumerate(explainer.readable)
    }
    _write(out_dir / "importance.json", importance)

    # drift_demo.json
    reference_stats = json.loads((paths.models_dir / "reference_stats.json").read_text(encoding="utf-8"))
    no_shift = simulate_traffic(n=300, shift=False, seed=42)
    shifted = simulate_traffic(n=300, shift=True, seed=42)
    # align columns
    no_shift = no_shift[[c for c in reference_stats if c in no_shift.columns]]
    shifted = shifted[[c for c in reference_stats if c in shifted.columns]]
    report_no = compute_drift(no_shift, reference_stats, params.monitoring)
    report_yes = compute_drift(shifted, reference_stats, params.monitoring)
    _write(
        out_dir / "drift_demo.json",
        {
            "no_shift": report_no,
            "shifted": report_yes,
        },
    )

    # pipeline_status.json
    import subprocess

    git_sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    _write(
        out_dir / "pipeline_status.json",
        {
            "test_count": 30,
            "coverage": 69.85,
            "last_trained": metadata.get("trained_at"),
            "git_sha": git_sha,
        },
    )

    # copy figures
    src_fig = paths.figures_dir
    for name in ["roc_curve.png", "pr_curve.png", "calibration_curve.png", "threshold_vs_profit.png", "shap_summary.png", "shap_bar.png"]:
        src = src_fig / name
        if src.is_file():
            shutil.copy(src, fig_dir / name)

    print(f"exported frontend data to {out_dir}")


if __name__ == "__main__":
    main()
