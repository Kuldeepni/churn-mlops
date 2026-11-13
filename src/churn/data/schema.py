"""Data validation schema shared by the ingestion and the serving API.

The enums defined here are the **single source of truth** for allowed
categorical values. Both the Pandera schema (used during ingestion) and the
Pydantic schemas (used by the API) import from this module.
"""

from __future__ import annotations

import enum
from typing import Final

import pandera as pa
from pandera import Column, DataFrameSchema

# ---------------------------------------------------------------------------
# Canonical categorical values (single source of truth)
# ---------------------------------------------------------------------------


class Gender(str, enum.Enum):
    female = "Female"
    male = "Male"


class YesNo(str, enum.Enum):
    yes = "Yes"
    no = "No"


class SeniorCitizen(str, enum.Enum):
    """SeniorCitizen is stored as an integer (0/1) in the raw CSV.

    We deliberately cast it to a "Yes"/"No" string so that it shares the
    ``YesNo`` vocabulary used by the API and the rest of the schema. This keeps
    the feature store / API input consistent and avoids a mixed type column.
    """

    yes = "Yes"
    no = "No"


class InternetService(str, enum.Enum):
    dsl = "DSL"
    fiber = "Fiber optic"
    no = "No"


class MultipleLines(str, enum.Enum):
    yes = "Yes"
    no = "No"
    no_phone = "No phone service"


class Contract(str, enum.Enum):
    month_to_month = "Month-to-month"
    one_year = "One year"
    two_year = "Two year"


class PaymentMethod(str, enum.Enum):
    electronic_check = "Electronic check"
    mailed_check = "Mailed check"
    bank_transfer = "Bank transfer (automatic)"
    credit_card = "Credit card (automatic)"


class ChurnLabel(str, enum.Enum):
    yes = "Yes"
    no = "No"


# Allowed values as plain lists (convenient for pandera / sklearn).
GENDER_VALUES: Final[list[str]] = [e.value for e in Gender]
YES_NO_VALUES: Final[list[str]] = [e.value for e in YesNo]
SENIOR_VALUES: Final[list[str]] = [e.value for e in SeniorCitizen]
INTERNET_VALUES: Final[list[str]] = [e.value for e in InternetService]
MULTIPLE_LINES_VALUES: Final[list[str]] = [e.value for e in MultipleLines]
CONTRACT_VALUES: Final[list[str]] = [e.value for e in Contract]
PAYMENT_VALUES: Final[list[str]] = [e.value for e in PaymentMethod]
CHURN_VALUES: Final[list[str]] = [e.value for e in ChurnLabel]

# Columns that use the "Yes/No/No internet service" vocabulary.
SERVICE_COLUMNS: Final[list[str]] = [
    "OnlineSecurity",
    "OnlineBackup",
    "DeviceProtection",
    "TechSupport",
    "StreamingTV",
    "StreamingMovies",
]
SERVICE_VALUES: Final[list[str]] = ["Yes", "No", "No internet service"]

# All categorical feature columns (excluding the target and customerID).
CATEGORICAL_COLUMNS: Final[list[str]] = [
    "gender",
    "SeniorCitizen",
    "Partner",
    "Dependents",
    "PhoneService",
    "MultipleLines",
    "InternetService",
    "OnlineSecurity",
    "OnlineBackup",
    "DeviceProtection",
    "TechSupport",
    "StreamingTV",
    "StreamingMovies",
    "Contract",
    "PaperlessBilling",
    "PaymentMethod",
]

NUMERIC_COLUMNS: Final[list[str]] = ["tenure", "MonthlyCharges", "TotalCharges"]

IDENTIFIER_COLUMN: Final[str] = "customerID"
TARGET_COLUMN: Final[str] = "Churn"


# ---------------------------------------------------------------------------
# Pandera schema for the *raw* frame
# ---------------------------------------------------------------------------


def raw_schema() -> DataFrameSchema:
    """Schema describing the dataset exactly as it is downloaded."""
    return DataFrameSchema(  # type: ignore[no-untyped-call]
        columns={
            IDENTIFIER_COLUMN: Column(str, checks=pa.Check.str_length(min_value=1), nullable=False),
            "gender": Column(str, checks=pa.Check.isin(GENDER_VALUES), nullable=False),
            "SeniorCitizen": Column(int, checks=pa.Check.isin([0, 1]), nullable=False),
            "Partner": Column(str, checks=pa.Check.isin(YES_NO_VALUES), nullable=False),
            "Dependents": Column(str, checks=pa.Check.isin(YES_NO_VALUES), nullable=False),
            "tenure": Column(int, checks=[pa.Check.ge(0), pa.Check.le(100)], nullable=False),
            "PhoneService": Column(str, checks=pa.Check.isin(YES_NO_VALUES), nullable=False),
            "MultipleLines": Column(str, checks=pa.Check.isin(MULTIPLE_LINES_VALUES), nullable=False),
            "InternetService": Column(str, checks=pa.Check.isin(INTERNET_VALUES), nullable=False),
            "OnlineSecurity": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "OnlineBackup": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "DeviceProtection": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "TechSupport": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "StreamingTV": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "StreamingMovies": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "Contract": Column(str, checks=pa.Check.isin(CONTRACT_VALUES), nullable=False),
            "PaperlessBilling": Column(str, checks=pa.Check.isin(YES_NO_VALUES), nullable=False),
            "PaymentMethod": Column(str, checks=pa.Check.isin(PAYMENT_VALUES), nullable=False),
            "MonthlyCharges": Column(float, checks=pa.Check.gt(0), nullable=False),
            # TotalCharges may be blank for tenure == 0 customers; validated after cleaning.
            "TotalCharges": Column(object, nullable=True),
            TARGET_COLUMN: Column(str, checks=pa.Check.isin(CHURN_VALUES), nullable=False),
        },
        strict=True,
        coerce=False,
    )


def cleaned_schema() -> DataFrameSchema:
    """Schema describing the cleaned frame (TotalCharges numeric, Churn mapped to 0/1)."""
    return DataFrameSchema(  # type: ignore[no-untyped-call]
        columns={
            IDENTIFIER_COLUMN: Column(str, checks=pa.Check.str_length(min_value=1), nullable=False, unique=True),
            "gender": Column(str, checks=pa.Check.isin(GENDER_VALUES), nullable=False),
            "SeniorCitizen": Column(str, checks=pa.Check.isin(SENIOR_VALUES), nullable=False),
            "Partner": Column(str, checks=pa.Check.isin(YES_NO_VALUES), nullable=False),
            "Dependents": Column(str, checks=pa.Check.isin(YES_NO_VALUES), nullable=False),
            "tenure": Column(int, checks=[pa.Check.ge(0), pa.Check.le(100)], nullable=False),
            "PhoneService": Column(str, checks=pa.Check.isin(YES_NO_VALUES), nullable=False),
            "MultipleLines": Column(str, checks=pa.Check.isin(MULTIPLE_LINES_VALUES), nullable=False),
            "InternetService": Column(str, checks=pa.Check.isin(INTERNET_VALUES), nullable=False),
            "OnlineSecurity": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "OnlineBackup": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "DeviceProtection": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "TechSupport": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "StreamingTV": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "StreamingMovies": Column(str, checks=pa.Check.isin(SERVICE_VALUES), nullable=False),
            "Contract": Column(str, checks=pa.Check.isin(CONTRACT_VALUES), nullable=False),
            "PaperlessBilling": Column(str, checks=pa.Check.isin(YES_NO_VALUES), nullable=False),
            "PaymentMethod": Column(str, checks=pa.Check.isin(PAYMENT_VALUES), nullable=False),
            "MonthlyCharges": Column(float, checks=pa.Check.gt(0), nullable=False),
            "TotalCharges": Column(float, checks=pa.Check.ge(0), nullable=False),
            "Churn": Column(int, checks=pa.Check.isin([0, 1]), nullable=False),
        },
        strict=True,
        coerce=False,
    )
