"""Leakage-safe stratified train/validation/test splitting."""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from churn.config import SplitParams, load_params
from churn.data.schema import IDENTIFIER_COLUMN, TARGET_COLUMN
from churn.logging_config import get_logger

logger = get_logger(__name__)


def split(
    frame: pd.DataFrame,
    params: SplitParams | None = None,
    seed: int = 42,
    tolerance: float | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split ``frame`` into (train, val, test) with stratification on ``Churn``.

    The split is performed in two stages so that the test set is created first
    (and never touched by anything else), followed by the validation split.
    """
    params = params or SplitParams()
    tolerance = tolerance if tolerance is not None else params.churn_rate_tolerance

    if params.train_size + params.val_size + params.test_size != 1.0:
        # Allow tiny floating point differences; re-normalise defensively.
        pass
    params.validate_split_sizes()

    # Stage 1: carve out the test set.
    train_val, test = train_test_split(
        frame,
        test_size=params.test_size,
        stratify=frame[TARGET_COLUMN],
        random_state=seed,
    )
    # Stage 2: split the remainder into train / val.
    relative_val = params.val_size / (params.train_size + params.val_size)
    train, val = train_test_split(
        train_val,
        test_size=relative_val,
        stratify=train_val[TARGET_COLUMN],
        random_state=seed,
    )

    # Integrity assertions.
    train_ids = set(train[IDENTIFIER_COLUMN])
    val_ids = set(val[IDENTIFIER_COLUMN])
    test_ids = set(test[IDENTIFIER_COLUMN])
    assert not (train_ids & val_ids), "customerID overlap between train and val"
    assert not (train_ids & test_ids), "customerID overlap between train and test"
    assert not (val_ids & test_ids), "customerID overlap between val and test"

    overall_rate = float(frame[TARGET_COLUMN].mean())
    for name, part in (("train", train), ("val", val), ("test", test)):
        rate = float(part[TARGET_COLUMN].mean())
        if abs(rate - overall_rate) > tolerance:
            raise ValueError(
                f"{name} churn rate {rate:.4f} deviates from overall {overall_rate:.4f} "
                f"by more than {tolerance}"
            )

    logger.info(
        "split complete",
        extra={
            "train": len(train),
            "val": len(val),
            "test": len(test),
            "train_rate": float(train[TARGET_COLUMN].mean()),
            "val_rate": float(val[TARGET_COLUMN].mean()),
            "test_rate": float(test[TARGET_COLUMN].mean()),
        },
    )
    return train.reset_index(drop=True), val.reset_index(drop=True), test.reset_index(drop=True)


def main() -> None:
    import argparse

    from churn.config import get_paths, load_params

    parser = argparse.ArgumentParser(description="Split the cleaned dataset")
    parser.add_argument("--input", type=str, default=None)
    parser.add_argument("--train", type=str, default=None)
    parser.add_argument("--val", type=str, default=None)
    parser.add_argument("--test", type=str, default=None)
    args = parser.parse_args()

    paths = get_paths()
    params = load_params()

    input_path = Path(args.input) if args.input else paths.clean_parquet
    frame = pd.read_parquet(input_path)
    train, val, test = split(frame, params=params.split, seed=params.seed)

    train_path = Path(args.train) if args.train else paths.train_parquet
    val_path = Path(args.val) if args.val else paths.val_parquet
    test_path = Path(args.test) if args.test else paths.test_parquet
    for path, part in ((train_path, train), (val_path, val), (test_path, test)):
        path.parent.mkdir(parents=True, exist_ok=True)
        part.to_parquet(path, index=False)
        print(f"wrote {path} ({len(part)} rows)")


if __name__ == "__main__":
    from pathlib import Path

    main()
