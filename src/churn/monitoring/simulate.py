"""Generate synthetic production traffic from the test split."""

from __future__ import annotations

import numpy as np
import pandas as pd

from churn.data.schema import TARGET_COLUMN
from churn.logging_config import get_logger

logger = get_logger(__name__)


def simulate_traffic(
    n: int = 200,
    shift: bool = False,
    seed: int = 42,
    test_path: str | None = None,
) -> pd.DataFrame:
    """Sample ``n`` rows from the test split, optionally perturbing distributions.

    ``shift=True`` mimics a distribution shift: higher MonthlyCharges, more
    month-to-month contracts, shorter tenure. This is used to demonstrate drift
    detection.
    """
    from churn.config import get_paths

    paths = get_paths()
    path = test_path or str(paths.test_parquet)
    test_df = pd.read_parquet(path)

    rng = np.random.default_rng(seed)
    sample = (
        test_df.sample(n=min(n, len(test_df)), replace=True, random_state=seed)
        .reset_index(drop=True)
        .copy()
    )

    if shift:
        # Increase monthly charges.
        sample["MonthlyCharges"] = sample["MonthlyCharges"].astype(float) * rng.uniform(
            1.15, 1.35, size=len(sample)
        )
        # Push contracts toward month-to-month.
        mask = rng.random(len(sample)) < 0.5
        sample.loc[mask, "Contract"] = "Month-to-month"
        # Shorten tenure.
        sample["tenure"] = (
            (sample["tenure"].astype(int) * rng.uniform(0.5, 0.8, size=len(sample)))
            .astype(int)
            .clip(lower=0)
        )
        # Recompute TotalCharges roughly.
        sample["TotalCharges"] = (
            sample["MonthlyCharges"].astype(float) * sample["tenure"].astype(float)
        ).round(2)
        logger.info("generated shifted traffic", extra={"n": len(sample)})

    return sample.drop(columns=[TARGET_COLUMN, "customerID"], errors="ignore")
