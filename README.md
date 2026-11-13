# churn-mlops

> End-to-end MLOps project for **cost-optimized** telecom churn prediction.

Work in progress - the full README is written in Phase 14 with real measured
numbers.

## Quickstart

```bash
uv venv && uv pip install -e ".[dev]"   # or: make install
make repro                              # ingest -> train -> calibrate -> evaluate
make serve                              # http://127.0.0.1:8000/docs
```

## License

MIT - see [LICENSE](LICENSE).
