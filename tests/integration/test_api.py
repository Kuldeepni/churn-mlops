from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BUNDLE = Path("models/pipeline.joblib")


@pytest.fixture
def client():
    if not BUNDLE.is_file():
        pytest.skip("model bundle not built; run `make repro` first")
    from churn.api.main import app

    with TestClient(app) as c:
        yield c


def test_health(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_ready(client: TestClient) -> None:
    r = client.get("/ready")
    assert r.status_code == 200
    assert r.json()["ready"] is True


def test_predict_valid(client: TestClient) -> None:
    payload = {
        "instances": [
            {
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
        ]
    }
    r = client.post("/predict", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert len(body["predictions"]) == 1
    p = body["predictions"][0]
    assert 0.0 <= p["churn_probability"] <= 1.0
    assert p["risk_band"] in {"low", "medium", "high"}


def test_predict_invalid(client: TestClient) -> None:
    r = client.post("/predict", json={"instances": [{"tenure": -5}]})
    assert r.status_code == 422


def test_predict_batch_limit(client: TestClient) -> None:
    inst = {
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
    r = client.post("/predict", json={"instances": [inst] * 10000})
    assert r.status_code in (422, 413)


def test_metrics_endpoint(client: TestClient) -> None:
    client.get("/health")
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "churn_api_requests_total" in r.text


def test_predict_explain_off(client: TestClient) -> None:
    payload = {
        "instances": [
            {
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
        ]
    }
    r = client.post("/predict?explain=false", json=payload)
    assert r.status_code == 200
    assert r.json()["predictions"][0]["top_factors"] == []
