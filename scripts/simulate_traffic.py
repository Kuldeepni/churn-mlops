"""Send simulated traffic to a running churn-mlops API."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from churn.config import get_paths
from churn.monitoring.simulate import simulate_traffic


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulate production traffic")
    parser.add_argument("--n", type=int, default=200)
    parser.add_argument("--shift", action="store_true", help="Apply a distribution shift")
    parser.add_argument("--url", type=str, default="http://127.0.0.1:8000")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    frame = simulate_traffic(n=args.n, shift=args.shift, seed=args.seed)

    paths = get_paths()
    paths.logs_dir.mkdir(parents=True, exist_ok=True)
    drift_input = paths.logs_dir / "production_inputs.parquet"
    frame.to_parquet(drift_input, index=False)

    records = frame.to_dict(orient="records")
    for r in records:
        for k, v in list(r.items()):
            if pd.isna(v):
                r[k] = None
            elif isinstance(v, (np.integer,)):
                r[k] = int(v)
            elif isinstance(v, (np.floating,)):
                r[k] = float(v)

    batch_size = 100
    total = 0
    with httpx.Client(timeout=60.0) as client:
        for i in range(0, len(records), batch_size):
            batch = records[i : i + batch_size]
            response = client.post(f"{args.url}/predict?explain=false", json={"instances": batch})
            response.raise_for_status()
            total += len(batch)
            print(f"sent batch {i // batch_size + 1}: {len(batch)} rows -> {response.status_code}")

    print(f"total sent: {total} (shift={args.shift})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
