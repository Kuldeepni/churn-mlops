from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def _reset_project_root(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROJECT_ROOT", str(Path.cwd()))
    from churn.config import get_paths, get_settings

    get_paths.cache_clear()
    get_settings.cache_clear()
