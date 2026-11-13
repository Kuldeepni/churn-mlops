"""FastAPI application entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import ValidationError

from churn.api import metrics as api_metrics
from churn.api import model_store, prediction_log, schemas
from churn.api.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from churn.config import get_settings, load_params
from churn.logging_config import configure_logging, get_logger

logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:  # noqa: ANN201
    configure_logging()
    try:
        model_store.load_bundle()
        state = model_store.get_state()
        if state.get("metadata"):
            api_metrics.update_model_info(
                version=str(state["metadata"].get("version", "unknown")),
                git_sha=str(state["metadata"].get("git_sha", "unknown")),
            )
    except Exception as exc:  # noqa: BLE001
        logger.error("model bundle failed to load at startup", extra={"error": str(exc)})
    yield
    # No teardown needed; the bundle is process-local.


app = FastAPI(
    title="churn-mlops",
    version="0.1.0",
    description="Cost-optimized telecom churn prediction service.",
    lifespan=lifespan,
)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

cors_origins = settings.cors_origin_list
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError) -> Any:  # noqa: ANN201
    return _error_response(request, 422, "validation_error", str(exc))


def _error_response(request: Request, status: int, code: str, detail: str) -> Any:  # noqa: ANN201
    from fastapi.responses import JSONResponse

    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=status,
        content={"error": code, "detail": detail, "request_id": request_id},
        headers={"X-Request-ID": request_id} if request_id else {},
    )


@app.get("/health", response_model=schemas.HealthResponse, tags=["health"])
async def health() -> schemas.HealthResponse:
    return schemas.HealthResponse()


@app.get("/ready", response_model=schemas.ReadyResponse, tags=["health"])
async def ready() -> schemas.ReadyResponse:
    state = model_store.get_state()
    if not model_store.is_ready():
        return schemas.ReadyResponse(ready=False, reason=state.get("reason"))
    return schemas.ReadyResponse(ready=True, model_version=str(state["metadata"].get("version")))


@app.get("/model-info", response_model=schemas.ModelInfoResponse, tags=["model"])
async def model_info() -> schemas.ModelInfoResponse:
    state = model_store.get_state()
    if not model_store.is_ready():
        raise HTTPException(status_code=503, detail="model not loaded")
    metadata = state["metadata"]
    return schemas.ModelInfoResponse(
        version=str(metadata.get("version")),
        git_sha=str(metadata.get("git_sha")),
        trained_at=str(metadata.get("trained_at")),
        metrics=metadata.get("metrics", {}),
        threshold=float(state["threshold"]),
        feature_count=len(metadata.get("feature_list", [])),
    )


@app.post("/predict", response_model=schemas.PredictResponse, tags=["prediction"])
async def predict(
    request: Request,
    payload: schemas.PredictRequest,
    background_tasks: BackgroundTasks,
    explain: bool = True,
) -> schemas.PredictResponse:
    import pandas as pd

    settings_local = get_settings()
    if len(payload.instances) > settings_local.max_batch_size:
        raise HTTPException(
            status_code=422,
            detail=f"batch size {len(payload.instances)} exceeds MAX_BATCH_SIZE={settings_local.max_batch_size}",
        )

    if not model_store.is_ready():
        raise HTTPException(status_code=503, detail="model not loaded")

    state = model_store.get_state()
    threshold = float(state["threshold"])

    features_df = pd.DataFrame([inst.model_dump() for inst in payload.instances])

    proba = model_store.predict_proba(features_df)
    params = load_params().api

    predictions: list[schemas.Prediction] = []
    for i, p in enumerate(proba):
        band = model_store.risk_band(float(p))
        factors_list = []
        if explain:
            factors_raw = model_store.top_factors(features_df.iloc[[i]], k=params.top_factors)
            if factors_raw and factors_raw[0]:
                factors_list = [schemas.TopFactor(**f) for f in factors_raw[0]]
        will_churn = bool(p >= threshold)
        predictions.append(
            schemas.Prediction(
                churn_probability=float(p),
                will_churn=will_churn,
                risk_band=band,
                top_factors=factors_list,
            )
        )
        api_metrics.PREDICTIONS_TOTAL.labels(
            risk_band=band, will_churn=str(will_churn).lower()
        ).inc()
        api_metrics.PREDICTION_PROBABILITY.observe(float(p))

    # Background prediction log.
    background_tasks.add_task(
        prediction_log.append_prediction_log,
        features=[inst.model_dump() for inst in payload.instances],
        predictions=[pred.model_dump() for pred in predictions],
        request_id=getattr(request.state, "request_id", None),
    )

    request_id = getattr(request.state, "request_id", None)
    response = schemas.PredictResponse(
        predictions=predictions,
        model_version=str(state["metadata"].get("version")),
        threshold=threshold,
        request_id=request_id,
    )

    return response


@app.get("/metrics", tags=["monitoring"])
async def metrics() -> PlainTextResponse:
    return PlainTextResponse(generate_latest().decode("utf-8"), media_type=CONTENT_TYPE_LATEST)
