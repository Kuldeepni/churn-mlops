"""Central configuration.

Two kinds of configuration exist in this project and they are deliberately kept
apart:

``Settings``
    Runtime/environment configuration (where the model bundle lives, log level,
    batch limits, ...). Overridable through environment variables or a ``.env``
    file. Anything that changes *how the service behaves* belongs here.

``Params``
    Experiment configuration stored in ``params.yaml``. This is the file that
    DVC tracks and that the training pipeline reads. Anything that changes *what
    the model learns* belongs here.

Every other module imports from this one; no path or magic number is defined
anywhere else.
"""

from __future__ import annotations

import functools
import os
from pathlib import Path
from typing import Any, Final, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_PARAMS_FILE: Final[str] = "params.yaml"
PROJECT_MARKER: Final[str] = "pyproject.toml"


def _discover_project_root() -> Path:
    """Locate the repository root.

    Resolution order:

    1. ``PROJECT_ROOT`` environment variable (used by Docker and by CI).
    2. The current working directory, if it contains a ``pyproject.toml``.
    3. Two levels above this file (``src/churn/config.py`` -> repository root).
    """
    env_root = os.environ.get("PROJECT_ROOT")
    if env_root:
        return Path(env_root).expanduser().resolve()

    cwd = Path.cwd().resolve()
    if (cwd / PROJECT_MARKER).is_file():
        return cwd

    package_root = Path(__file__).resolve().parents[2]
    if (package_root / PROJECT_MARKER).is_file():
        return package_root
    return cwd


PROJECT_ROOT: Final[Path] = _discover_project_root()


class Settings(BaseSettings):
    """Runtime configuration, overridable via environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_prefix="",
        case_sensitive=False,
    )

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_json: bool = True

    #: Directory containing the serving bundle (``pipeline.joblib`` etc.).
    model_dir: Path = Path("models")
    #: JSONL file where production predictions are appended.
    prediction_log: Path = Path("logs/predictions.jsonl")

    mlflow_tracking_uri: str = "sqlite:///mlflow.db"
    mlflow_experiment: str = "churn-classifier"
    mlflow_registry_model: str = "churn-classifier"

    max_batch_size: int = Field(default=100, ge=1, le=10_000)
    cors_origins: str = ""

    project_root: Path = _discover_project_root()

    @field_validator("model_dir", "prediction_log", mode="after")
    @classmethod
    def _make_absolute(cls, value: Path) -> Path:
        """Resolve relative paths against the project root."""
        if value.is_absolute():
            return value
        return (_discover_project_root() / value).resolve()

    @property
    def cors_origin_list(self) -> list[str]:
        """CORS origins parsed from the comma separated ``CORS_ORIGINS`` value."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@functools.lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached process-wide :class:`Settings` instance."""
    return Settings()


# ---------------------------------------------------------------------------
# params.yaml models
# ---------------------------------------------------------------------------


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class DataParams(_Base):
    url: str
    fallback_url: str | None = None
    min_rows: int = Field(default=7000, ge=1)
    expected_columns: int = Field(default=21, ge=1)
    download_timeout_seconds: float = Field(default=60.0, gt=0)
    download_retries: int = Field(default=3, ge=0)


class SplitParams(_Base):
    train_size: float = Field(default=0.6, gt=0, lt=1)
    val_size: float = Field(default=0.2, gt=0, lt=1)
    test_size: float = Field(default=0.2, gt=0, lt=1)
    churn_rate_tolerance: float = Field(default=0.05, gt=0, lt=1)

    @field_validator("train_size", "val_size", "test_size")
    @classmethod
    def _sums_to_one(cls, value: float) -> float:
        return value

    def validate_split_sizes(self) -> None:
        total = self.train_size + self.val_size + self.test_size
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"split sizes must sum to 1.0, got {total}")


class FeatureParams(_Base):
    min_frequency: int = Field(default=10, ge=1)
    tenure_bucket_edges: list[int] = Field(default_factory=lambda: [0, 12, 24, 48, 60])
    addon_services: list[str] = Field(
        default_factory=lambda: [
            "OnlineSecurity",
            "BackupDeviceProtection",
            "DeviceProtection",
            "TechSupport",
            "StreamingTV",
            "StreamingMovies",
        ]
    )


class LogisticParams(_Base):
    C: float = Field(default=1.0, gt=0)
    class_weight: Literal["balanced", "none"] = "balanced"
    max_iter: int = Field(default=2000, ge=1)


class LightGBMParams(_Base):
    n_estimators: int = Field(default=400, ge=1)
    learning_rate: float = Field(default=0.05, gt=0)
    num_leaves: int = Field(default=31, ge=2)
    max_depth: int = Field(default=-1, ge=-1)
    min_child_samples: int = Field(default=20, ge=1)
    subsample: float = Field(default=0.9, gt=0, le=1)
    subsample_freq: int = Field(default=1, ge=0)
    colsample_bytree: float = Field(default=0.9, gt=0, le=1)
    reg_alpha: float = Field(default=0.0, ge=0)
    reg_lambda: float = Field(default=1.0, ge=0)
    scale_pos_weight: float = Field(default=1.0, gt=0)
    random_state: int = 42


class OptunaParams(_Base):
    n_trials: int = Field(default=20, ge=1)
    timeout: int = Field(default=600, ge=1)
    seed: int = 42
    pruner: Literal["median", "hyperband", "nop"] = "median"


class ModelParams(_Base):
    cv_folds: int = Field(default=5, ge=2)
    candidates: list[Literal["logistic", "lightgbm"]] = Field(default=["logistic", "lightgbm"])
    logistic: LogisticParams = Field(default_factory=LogisticParams)
    lightgbm: LightGBMParams = Field(default_factory=LightGBMParams)
    optuna: OptunaParams = Field(default_factory=OptunaParams)


class CalibrationParams(_Base):
    methods: list[Literal["isotonic", "sigmoid"]] = Field(default=["isotonic", "sigmoid"])


class ThresholdParams(_Base):
    customer_lifetime_value: float = Field(default=1200.0, ge=0)
    retention_offer_cost: float = Field(default=60.0, ge=0)
    offer_success_rate: float = Field(default=0.35, ge=0, le=1)
    sweep_min: float = Field(default=0.01, ge=0.0, le=1.0)
    sweep_max: float = Field(default=0.99, ge=0.0, le=1.0)
    sweep_steps: int = Field(default=99, ge=2)

    @property
    def expected_value_if_churner(self) -> float:
        """Expected net benefit of targeting a customer who churns."""
        return self.offer_success_rate * self.customer_lifetime_value - self.retention_offer_cost

    @property
    def expected_value_if_not_churner(self) -> float:
        """Expected net benefit of targeting a customer who does not churn."""
        return -self.retention_offer_cost


class EvaluationParams(_Base):
    min_pr_auc: float = Field(default=0.55, ge=0.0, le=1.0)
    min_recall: float = Field(default=0.40, ge=0.0, le=1.0)
    bootstrap_iterations: int = Field(default=1000, ge=100)


class MonitoringParams(_Base):
    psi_threshold: float = Field(default=0.2, ge=0.0)
    ks_threshold: float = Field(default=0.15, ge=0.0)
    chi2_pvalue_threshold: float = Field(default=0.01, gt=0.0, lt=1.0)
    max_drifted_feature_share: float = Field(default=0.3, gt=0.0, le=1.0)
    min_samples: int = Field(default=200, ge=10)
    score_psi_threshold: float = Field(default=0.2, ge=0.0)


class ApiParams(_Base):
    risk_band_high: float = Field(default=0.55, gt=0.0, le=1.0)
    risk_band_low: float = Field(default=0.25, ge=0.0, le=1.0)
    top_factors: int = Field(default=3, ge=1, le=20)


class Params(_Base):
    """Fully validated view of ``params.yaml``."""

    seed: int = 42
    data: DataParams
    split: SplitParams = Field(default_factory=SplitParams)
    features: FeatureParams = Field(default_factory=FeatureParams)
    model: ModelParams = Field(default_factory=ModelParams)
    calibration: CalibrationParams = Field(default_factory=CalibrationParams)
    threshold: ThresholdParams = Field(default_factory=ThresholdParams)
    evaluation: EvaluationParams = Field(default_factory=EvaluationParams)
    monitoring: MonitoringParams = Field(default_factory=MonitoringParams)
    api: ApiParams = Field(default_factory=ApiParams)

    @field_validator("split")
    @classmethod
    def _check_split_sizes(cls, value: SplitParams) -> SplitParams:
        value.validate_split_sizes()
        return value

    @field_validator("api")
    @classmethod
    def _check_risk_bands(cls, value: ApiParams) -> ApiParams:
        if value.risk_band_low >= value.risk_band_high:
            raise ValueError("api.risk_band_low must be smaller than api.risk_band_high")
        return value


def params_path(path: str | Path | None = None) -> Path:
    """Return the resolved path of ``params.yaml``."""
    if path is None:
        return _discover_project_root() / DEFAULT_PARAMS_FILE
    candidate = Path(path)
    return (
        candidate if candidate.is_absolute() else (_discover_project_root() / candidate).resolve()
    )


def load_params(path: str | Path | None = None) -> Params:
    """Load and validate ``params.yaml``."""
    resolved = params_path(path)
    if not resolved.is_file():
        raise FileNotFoundError(f"params file not found: {resolved}")
    raw: dict[str, Any] = yaml.safe_load(resolved.read_text(encoding="utf-8")) or {}
    return Params.model_validate(raw)


# ---------------------------------------------------------------------------
# Canonical project paths
# ---------------------------------------------------------------------------


class Paths:
    """Canonical locations of every artifact the project produces.

    All paths are derived from :data:`PROJECT_ROOT` so that the same code works
    from a source checkout, a container image or a CI runner.
    """

    def __init__(self, root: Path | None = None) -> None:
        self.root = (root or _discover_project_root()).resolve()

    @property
    def params_file(self) -> Path:
        return self.root / DEFAULT_PARAMS_FILE

    @property
    def raw_dir(self) -> Path:
        return self.root / "data" / "raw"

    @property
    def interim_dir(self) -> Path:
        return self.root / "data" / "interim"

    @property
    def processed_dir(self) -> Path:
        return self.root / "data" / "processed"

    @property
    def reports_dir(self) -> Path:
        return self.root / "reports"

    @property
    def figures_dir(self) -> Path:
        return self.root / "docs" / "figures"

    @property
    def models_dir(self) -> Path:
        return self.root / "models"

    @property
    def logs_dir(self) -> Path:
        return self.root / "logs"

    @property
    def mlruns_dir(self) -> Path:
        return self.root / "mlruns"

    @property
    def train_parquet(self) -> Path:
        return self.processed_dir / "train.parquet"

    @property
    def val_parquet(self) -> Path:
        return self.processed_dir / "val.parquet"

    @property
    def test_parquet(self) -> Path:
        return self.processed_dir / "test.parquet"

    @property
    def clean_parquet(self) -> Path:
        return self.interim_dir / "clean.parquet"

    @property
    def manifest_json(self) -> Path:
        return self.raw_dir / "manifest.json"

    @property
    def metrics_json(self) -> Path:
        return self.reports_dir / "metrics.json"

    @property
    def drift_json(self) -> Path:
        return self.reports_dir / "drift.json"

    @property
    def drift_markdown(self) -> Path:
        return self.reports_dir / "drift_report.md"

    @property
    def comparison_json(self) -> Path:
        return self.reports_dir / "model_comparison.json"

    @property
    def threshold_json(self) -> Path:
        return self.reports_dir / "threshold.json"

    def ensure_dirs(self) -> None:
        """Create every writable directory used by the pipeline."""
        for directory in (
            self.raw_dir,
            self.interim_dir,
            self.processed_dir,
            self.reports_dir,
            self.figures_dir,
            self.models_dir,
            self.logs_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)


@functools.lru_cache(maxsize=1)
def get_paths() -> Paths:
    """Return the cached :class:`Paths` instance."""
    return Paths()
