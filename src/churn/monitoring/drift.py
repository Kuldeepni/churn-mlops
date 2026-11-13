"""Population Stability Index and two-sample drift detection."""

from __future__ import annotations

import json
import math
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats  # type: ignore[import-untyped]

from churn.config import MonitoringParams, get_paths, get_settings, load_params
from churn.logging_config import get_logger

logger = get_logger(__name__)

EPSILON: float = 1e-6


def _psi_numeric(reference: Any, production: Any, bins: int = 10) -> float:
    """PSI using reference-quantile bins."""
    if len(reference) == 0 or len(production) == 0:
        return 0.0
    quantiles = np.linspace(0, 1, bins + 1)
    breakpoints = np.unique(np.quantile(reference, quantiles))
    if len(breakpoints) < 2:
        return 0.0
    ref_counts, _ = np.histogram(reference, bins=breakpoints)
    prod_counts, _ = np.histogram(production, bins=breakpoints)
    ref_pct = (ref_counts + EPSILON) / (len(reference) + EPSILON * len(ref_counts))
    prod_pct = (prod_counts + EPSILON) / (len(production) + EPSILON * len(prod_counts))
    return float(np.sum((prod_pct - ref_pct) * np.log(prod_pct / ref_pct)))


def _psi_categorical(reference: pd.Series, production: pd.Series) -> float:
    ref_freq = reference.astype(str).value_counts(normalize=True)
    prod_freq = production.astype(str).value_counts(normalize=True)
    categories = set(ref_freq.index) | set(prod_freq.index)
    psi = 0.0
    for cat in categories:
        r = float(ref_freq.get(cat, EPSILON))
        p = float(prod_freq.get(cat, EPSILON))
        r = max(r, EPSILON)
        p = max(p, EPSILON)
        psi += (p - r) * math.log(p / r)
    return float(psi)


def _ks(reference: Any, production: Any) -> tuple[float, float]:
    if len(reference) == 0 or len(production) == 0:
        return 0.0, 1.0
    result = stats.ks_2samp(reference, production)
    return float(result.statistic), float(result.pvalue)


def _chi2(reference: pd.Series, production: pd.Series) -> tuple[float, float]:
    ref_counts = reference.astype(str).value_counts()
    prod_counts = production.astype(str).value_counts()
    categories = list(set(ref_counts.index) | set(prod_counts.index))
    observed = np.array([prod_counts.get(c, 0) for c in categories], dtype=float)
    expected = np.array([ref_counts.get(c, 0) for c in categories], dtype=float)
    expected = expected / max(expected.sum(), 1) * max(observed.sum(), 1)
    # Guard against zero expected.
    mask = expected > 0
    if mask.sum() < 2:
        return 0.0, 1.0
    chi2_stat, p_value = stats.chisquare(observed[mask], f_exp=expected[mask])
    return float(chi2_stat), float(p_value)


def compute_drift(
    production: pd.DataFrame,
    reference_stats: dict[str, Any],
    params: MonitoringParams,
    score_column: str | None = None,
) -> dict[str, Any]:
    """Compare a production frame against the reference statistics.

    Returns a dict with per-feature results and an overall ``drift_detected`` flag.
    """
    results: list[dict[str, Any]] = []
    n_features = 0
    n_drifted = 0

    if len(production) < params.min_samples:
        return {
            "status": "skipped",
            "reason": f"too few samples ({len(production)} < {params.min_samples})",
            "n_samples": len(production),
            "features": [],
            "drifted_share": 0.0,
            "drift_detected": False,
        }

    for feature, ref in reference_stats.items():
        if feature not in production.columns:
            continue
        n_features += 1
        if ref.get("type") == "numeric":
            ref_values = np.asarray(ref["values"], dtype=float)
            prod_values = production[feature].astype(float).to_numpy()
            psi = _psi_numeric(ref_values, prod_values)
            ks_stat, ks_p = _ks(ref_values, prod_values)
            drifted = psi >= params.psi_threshold or ks_stat >= params.ks_threshold
            results.append(
                {
                    "feature": feature,
                    "type": "numeric",
                    "psi": psi,
                    "ks_statistic": ks_stat,
                    "ks_pvalue": ks_p,
                    "drifted": bool(drifted),
                }
            )
        else:
            # Reconstruct a pseudo reference series from frequencies for chi2.
            freqs = ref.get("frequencies", {})
            # Build a reference array of categories for PSI.
            ref_cats_list = []
            for cat, freq in freqs.items():
                count = max(1, int(round(freq * 1000)))
                ref_cats_list.extend([cat] * count)
            ref_cats = np.array(ref_cats_list)
            prod_series = production[feature].astype(str)
            psi = _psi_categorical(
                pd.Series(ref_cats) if len(ref_cats) else production[feature],
                prod_series,
            )
            _, chi_p = _chi2(
                pd.Series(ref_cats) if len(ref_cats) else prod_series,
                prod_series,
            )
            drifted = psi >= params.psi_threshold or chi_p < params.chi2_pvalue_threshold
            results.append(
                {
                    "feature": feature,
                    "type": "categorical",
                    "psi": psi,
                    "chi2_pvalue": chi_p,
                    "drifted": bool(drifted),
                }
            )
        if results[-1]["drifted"]:
            n_drifted += 1

    drifted_share = (n_drifted / n_features) if n_features else 0.0
    drift_detected = drifted_share > params.max_drifted_feature_share

    # Score drift (optional).
    score_drift = None
    if score_column is not None and score_column in production.columns:
        # No reference scores stored; skip unless provided.
        score_drift = None

    return {
        "status": "ok",
        "n_samples": len(production),
        "n_features": n_features,
        "n_drifted": n_drifted,
        "drifted_share": drifted_share,
        "drift_detected": bool(drift_detected),
        "threshold": params.max_drifted_feature_share,
        "features": results,
        "score_drift": score_drift,
    }


def run_drift_check(params: MonitoringParams | None = None) -> dict[str, Any]:
    params = params or load_params().monitoring
    paths = get_paths()
    paths.ensure_dirs()

    ref_path = paths.models_dir / "reference_stats.json"
    if not ref_path.is_file():
        logger.warning("reference stats missing; skipping drift check")
        report = {
            "status": "skipped",
            "reason": "reference stats missing",
            "drift_detected": False,
            "features": [],
            "drifted_share": 0.0,
            "n_samples": 0,
        }
        (paths.reports_dir / "drift.json").write_text(
            json.dumps(report, indent=2), encoding="utf-8"
        )
        return report
    reference_stats = json.loads(ref_path.read_text(encoding="utf-8"))

    # Production data = appended prediction log inputs. Fall back to a synthetic
    # sample file if the log is empty (useful for demos and tests).
    production_path = paths.logs_dir / "production_inputs.parquet"
    if production_path.is_file():
        production = pd.read_parquet(production_path)
    else:
        # Try JSONL prediction log.
        log_path = get_settings().prediction_log
        if log_path.is_file():
            records = [
                json.loads(line)
                for line in log_path.read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            if records:
                features = [r.get("features", r) for r in records]
                production = pd.DataFrame(features)
            else:
                production = pd.DataFrame()
        else:
            production = pd.DataFrame()

    if production.empty:
        logger.warning("no production data available; skipping drift check")
        report = {
            "status": "skipped",
            "reason": "no production data",
            "drift_detected": False,
            "features": [],
            "drifted_share": 0.0,
        }
        (paths.reports_dir / "drift.json").write_text(
            json.dumps(report, indent=2), encoding="utf-8"
        )
        return report

    # Align columns to reference.
    production = production[[c for c in reference_stats if c in production.columns]]

    report = compute_drift(production, reference_stats, params)

    # Human readable markdown summary.
    md_lines = [
        "# Drift report",
        "",
        f"- samples: {report.get('n_samples')}",
        f"- drifted features: {report.get('n_drifted', 0)}/{report.get('n_features', 0)}",
        f"- drifted share: {report.get('drifted_share', 0):.3f}",
        f"- drift detected: {report.get('drift_detected')}",
        "",
        "## Per feature",
        "",
    ]
    for feat in report.get("features") or []:  # type: ignore
        md_lines.append(
            f"- **{feat['feature']}** ({feat['type']}): drifted={feat['drifted']} psi={feat.get('psi', 0):.4f}"
        )
    paths.drift_markdown.write_text("\n".join(md_lines), encoding="utf-8")
    (paths.reports_dir / "drift.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    logger.info(
        "drift check complete",
        extra={"drifted": report.get("n_drifted"), "detected": report.get("drift_detected")},
    )
    if report.get("drift_detected"):
        raise SystemExit(2)
    return report


def main() -> None:
    try:
        run_drift_check()
    except SystemExit as exc:
        print(f"drift detected (exit {exc.code})")
        raise


if __name__ == "__main__":
    main()
