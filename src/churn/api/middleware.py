"""Request ID, structured logging and error handling middleware."""

from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from churn.logging_config import get_logger, log_context

logger = get_logger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception:  # noqa: BLE001
            logger.exception(
                "unhandled error", extra={"request_id": request_id, "path": request.url.path}
            )
            return JSONResponse(
                status_code=500,
                content={"error": "internal_server_error", "request_id": request_id},
                headers={"X-Request-ID": request_id},
            )
        finally:
            latency_ms = (time.perf_counter() - start) * 1000.0
            # Prometheus metrics (best effort; never fail the request).
            try:
                from churn.api import metrics as api_metrics

                api_metrics.REQUEST_COUNT.labels(
                    method=request.method, path=request.url.path, status=str(status_code)
                ).inc()
                api_metrics.REQUEST_LATENCY.labels(
                    method=request.method, path=request.url.path
                ).observe(latency_ms / 1000.0)
            except Exception:  # noqa: BLE001
                pass
            with log_context(request_id=request_id):
                logger.info(
                    "request handled",
                    extra={
                        "method": request.method,
                        "path": request.url.path,
                        "status": status_code,
                        "latency_ms": round(latency_ms, 2),
                    },
                )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response
