"""Clean the raw frame: type coercion, normalisation and target encoding."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from churn.data.schema import (
    CATEGORICAL_COLUMNS,
    IDENTIFIER_COLUMN,
    NUMERIC_COLUMNS,
    TARGET_COLUMN,
    cleaned_schema,
    raw_schema,
)
from churn.logging_config import get_logger

logger = get_logger(__name__)


def _strip_strings(frame: pd.DataFrame) -> pd.DataFrame:
    """Strip leading/trailing whitespace from every string column."""
    result = frame.copy()
    for column in result.columns:
        if result[column].dtype == object:
            result[column] = result[column].astype(str).str.strip()
    return result


def clean(frame: pd.DataFrame) -> pd.DataFrame:
    """Return a cleaned, analysis ready frame.

    Cleaning rules (see docs/decisions.md):

    * ``TotalCharges`` contains blank strings for customers with ``tenure == 0``.
      These are converted to ``0.0``; any blank value for a customer with
      ``tenure > 0`` raises ``ValueError``.
    * ``Churn`` is mapped to ``0``/``1``.
    * ``SeniorCitizen`` is recoded from ``0``/``1`` to ``"No"``/``"Yes"`` so that
      it shares the categorical vocabulary used everywhere else.
    * Whitespace is stripped from string columns.
    * ``"No internet service"`` / ``"No phone service"`` values are kept as
      explicit categories rather than collapsed, so that the model can learn the
      structural absence of a service.
    """
    raw_schema().validate(frame, lazy=True)

    result = _strip_strings(frame)

    # --- TotalCharges -------------------------------------------------------
    raw_total = result["TotalCharges"].astype(str).str.strip()
    blank_mask = raw_total == ""  # noqa: E712
    tenure_zero_mask = result["tenure"].astype(int) == 0
    if (blank_mask & ~tenure_zero_mask).any():
        offending = result.loc[blank_mask & ~tenure_zero_mask, IDENTIFIER_COLUMN].tolist()
        raise ValueError(
            f"TotalCharges is blank for customers with tenure > 0: {offending[:5]}"
        )
    total_numeric = pd.to_numeric(raw_total.replace("", "0"), errors="raise")
    total_numeric = total_numeric.where(~(blank_mask & tenure_zero_mask), 0.0)
    # Customers with tenure == 0 and a blank charge contribute 0.0 by construction.
    total_numeric = total_numeric.astype(float)
    total_numeric.loc[blank_mask & tenure_zero_mask] = 0.0
    result["TotalCharges"] = total_numeric

    # --- SeniorCitizen recoding ---------------------------------------------
    result["SeniorCitizen"] = result["SeniorCitizen"].astype(int).map({0: "No", 1: "Yes"})
    if result["SeniorCitizen"].isna().any():
        raise ValueError("SeniorCitizen contains values other than 0 or 1")

    # --- Target encoding ----------------------------------------------------
    result[TARGET_COLUMN] = result[TARGET_COLUMN].map({"No": 0, "Yes": 1}).astype(int)

    # --- Numeric coercion ---------------------------------------------------
    result["tenure"] = result["tenure"].astype(int)
    result["MonthlyCharges"] = result["MonthlyCharges"].astype(float)

    # --- Validate the cleaned frame ----------------------------------------
    cleaned_schema().validate(result, lazy=True)

    logger.info(
        "cleaned dataset",
        extra={
            "rows": len(result),
            "churn_rate": float(result[TARGET_COLUMN].mean()),
            "blank_total_charges_fixed": int(blank_mask.sum()),
        },
    )
    return result


def main() -> None:
    import argparse

    from churn.config import get_paths

    parser = argparse.ArgumentParser(description="Clean the raw dataset")
    parser.add_argument("--input", type=str, default=None)
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    paths = get_paths()
    input_path = Path(args.input) if args.input else paths.raw_dir / "Telco-Customer-Churn.csv"
    output_path = Path(args.output) if args.output else paths.clean_parquet

    raw = pd.read_csv(input_path)
    cleaned = clean(raw)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_parquet(output_path, index=False)
    print(f"wrote {output_path} ({len(cleaned)} rows)")


if __name__ == "__main__":
    from pathlib import Path

    main()
