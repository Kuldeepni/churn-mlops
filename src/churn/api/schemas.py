"""Pydantic v2 request/response schemas for the serving API.

The categorical enums are imported from :mod:`churn.data.schema` so that the
API and the data pipeline share a single source of truth.
"""

from __future__ import annotations

from typing import Any, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field

from churn.data.schema import (
    CONTRACT_VALUES,
    GENDER_VALUES,
    INTERNET_VALUES,
    MULTIPLE_LINES_VALUES,
    PAYMENT_VALUES,
    SERVICE_VALUES,
    YES_NO_VALUES,
)

# Build Literal types from the canonical value lists.
GenderLiteral: TypeAlias = Literal[tuple(GENDER_VALUES)]  # type: ignore[valid-type]
YesNoLiteral: TypeAlias = Literal[tuple(YES_NO_VALUES)]  # type: ignore[valid-type]
InternetLiteral: TypeAlias = Literal[tuple(INTERNET_VALUES)]  # type: ignore[valid-type]
MultipleLinesLiteral: TypeAlias = Literal[tuple(MULTIPLE_LINES_VALUES)]  # type: ignore[valid-type]
ContractLiteral: TypeAlias = Literal[tuple(CONTRACT_VALUES)]  # type: ignore[valid-type]
PaymentLiteral: TypeAlias = Literal[tuple(PAYMENT_VALUES)]  # type: ignore[valid-type]
ServiceLiteral: TypeAlias = Literal[tuple(SERVICE_VALUES)]  # type: ignore[valid-type]


class CustomerFeatures(BaseModel):
    """A single customer's features (mirrors the training schema)."""

    gender: GenderLiteral
    SeniorCitizen: YesNoLiteral = Field(description="Whether the customer is a senior citizen")
    Partner: YesNoLiteral
    Dependents: YesNoLiteral
    tenure: int = Field(ge=0, le=100)
    PhoneService: YesNoLiteral
    MultipleLines: MultipleLinesLiteral
    InternetService: InternetLiteral
    OnlineSecurity: ServiceLiteral
    OnlineBackup: ServiceLiteral
    DeviceProtection: ServiceLiteral
    TechSupport: ServiceLiteral
    StreamingTV: ServiceLiteral
    StreamingMovies: ServiceLiteral
    Contract: ContractLiteral
    PaperlessBilling: YesNoLiteral
    PaymentMethod: PaymentLiteral
    MonthlyCharges: float = Field(gt=0)
    TotalCharges: float = Field(ge=0)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "gender": "Female",
                "SeniorCitizen": "No",
                "Partner": "Yes",
                "Dependents": "No",
                "tenure": 12,
                "PhoneService": "Yes",
                "MultipleLines": "No",
                "InternetService": "Fiber optic",
                "OnlineSecurity": "No",
                "OnlineBackup": "Yes",
                "DeviceProtection": "No",
                "TechSupport": "No",
                "StreamingTV": "Yes",
                "StreamingMovies": "Yes",
                "Contract": "Month-to-month",
                "PaperlessBilling": "Yes",
                "PaymentMethod": "Electronic check",
                "MonthlyCharges": 89.1,
                "TotalCharges": 1069.2,
            }
        },
    )


class PredictRequest(BaseModel):
    instances: list[CustomerFeatures] = Field(min_length=1)

    @property
    def batch_size(self) -> int:
        return len(self.instances)


class TopFactor(BaseModel):
    feature: str
    impact: float
    direction: Literal["increases_churn", "decreases_churn"]


class Prediction(BaseModel):
    churn_probability: float = Field(ge=0.0, le=1.0)
    will_churn: bool
    risk_band: Literal["low", "medium", "high"]
    top_factors: list[TopFactor] = Field(default_factory=list)


class PredictResponse(BaseModel):
    predictions: list[Prediction]
    model_version: str
    threshold: float
    request_id: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


class ReadyResponse(BaseModel):
    ready: bool
    model_version: str | None = None
    reason: str | None = None


class ModelInfoResponse(BaseModel):
    version: str
    git_sha: str
    trained_at: str
    metrics: dict[str, Any]
    threshold: float
    feature_count: int
