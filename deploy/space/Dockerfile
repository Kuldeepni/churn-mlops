FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PROJECT_ROOT=/app \
    CORS_ORIGINS=https://kuldeepni.github.io,http://localhost:5173 \
    PREDICTION_LOG=/tmp/predictions.jsonl \
    MAX_BATCH_SIZE=10

WORKDIR /app
RUN useradd --create-home --uid 1000 appuser
COPY requirements.lock ./
RUN python -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r requirements.lock
ENV PATH="/opt/venv/bin:$PATH"
COPY src/ ./src/
COPY models/ ./models/
COPY params.yaml ./
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 7860
CMD ["uvicorn", "churn.api.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
