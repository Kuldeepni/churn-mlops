from __future__ import annotations

from pathlib import Path

import pytest

from churn.monitoring.drift import run_drift_check


def test_run_drift_check_no_data(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROJECT_ROOT", str(tmp_path))
    monkeypatch.setenv("MLFLOW_TRACKING_URI", f"file:{tmp_path}/mlruns")
    from churn.config import get_paths as _gp
    from churn.config import get_settings as _gs

    _gp.cache_clear()
    _gs.cache_clear()
    paths = _gp()
    paths.ensure_dirs()
    import shutil

    shutil.copy("params.yaml", paths.root / "params.yaml")
    # No production data -> skipped.
    report = run_drift_check()
    assert report["status"] == "skipped"
    _gp.cache_clear()
    _gs.cache_clear()
