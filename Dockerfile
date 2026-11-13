# Dockerfile
FROM python:3.11-slim AS builder

WORKDIR /build
COPY requirements.lock ./
RUN python -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.lock

FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PROJECT_ROOT=/app

WORKDIR /app

RUN useradd --create-home --uid 1000 appuser

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY src/ ./src/
COPY models/ ./models/
COPY params.yaml ./

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read())" || exit 1

LABEL org.opencontainers.image.source="https://github.com/churn-mlops/churn-mlops" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.revision="main"

CMD ["uvicorn", "churn.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
