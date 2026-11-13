from __future__ import annotations

import shutil
from pathlib import Path

import pandas as pd
import pytest

from churn.config import load_params
from churn.data.clean import clean
from churn.data.split import split


@pytest.mark.slow
def test_end_to_end_pipeline(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROJECT_ROOT", str(tmp_path))
    monkeypatch.setenv("MLFLOW_TRACKING_URI", f"file:{tmp_path}/mlruns")
    from churn.config import get_paths as _gp
    from churn.config import get_settings

    _gp.cache_clear()
    get_settings.cache_clear()
    pass
    paths = _gp()
    paths.ensure_dirs()

    # params.yaml is required by load_params().

    shutil.copy("params.yaml", paths.root / "params.yaml")

    # Build a small dataset from the fixture.
    raw = pd.read_csv("tests/fixtures/telco_sample.csv")
    cleaned = clean(raw)
    train, val, test = split(cleaned, seed=42)
    train.to_parquet(paths.train_parquet, index=False)
    val.to_parquet(paths.val_parquet, index=False)
    test.to_parquet(paths.test_parquet, index=False)
    # Copy raw manifest-ish: write a manifest so ingest isn't needed.
    paths.raw_dir.mkdir(parents=True, exist_ok=True)
    raw.to_csv(paths.raw_dir / "Telco-Customer-Churn.csv", index=False)

    params = load_params()
    # Speed up optuna.
    params = params.model_copy(
        update={
            "model": params.model.model_copy(
                update={
                    "optuna": params.model.optuna.model_copy(update={"n_trials": 2, "timeout": 120})
                }
            )
        }
    )

    from churn.models import train as train_mod

    train_mod.train(params)

    from churn.models import calibrate as cal_mod

    cal_mod.calibrate(params)

    from churn.models import threshold as thr_mod

    thr_mod.run_threshold_optimization(params)

    from churn.models import bundle as bundle_mod

    bundle_mod.main() if False else None
    import json

    calibrated = __import__("joblib").load(paths.models_dir / "calibrated_pipeline.joblib")
    base = __import__("joblib").load(paths.models_dir / "uncalibrated_pipeline.joblib")
    threshold_payload = json.loads((paths.reports_dir / "threshold.json").read_text())
    metrics = {}
    if (paths.reports_dir / "metrics.json").is_file():
        metrics = json.loads((paths.reports_dir / "metrics.json").read_text())
    train_df = pd.read_parquet(paths.train_parquet)
    bundle_mod.export_bundle(
        calibrated, base, threshold_payload["threshold"], metrics, params, train_df, "testsha"
    )

    assert (paths.models_dir / "pipeline.joblib").is_file()
    assert (paths.models_dir / "metadata.json").is_file()

    # Cleanup cache
    _gp.cache_clear()
