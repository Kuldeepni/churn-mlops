#!/usr/bin/env bash
set -euo pipefail

if [ -z "${HF_TOKEN:-}" ]; then
  echo "HF_TOKEN not set; skipping Space deployment."
  exit 0
fi

python - <<'PY'
import os
from huggingface_hub import HfApi, create_repo
api = HfApi(token=os.environ["HF_TOKEN"])
user = api.whoami()["name"]
repo_id = f"{user}/churn-mlops-api"
try:
    create_repo(repo_id, repo_type="space", space_sdk="docker", token=os.environ["HF_TOKEN"], exist_ok=True)
except Exception as e:
    print("create_repo:", e)
print("Space:", repo_id)
PY
echo "Deployment staging not fully automated; push models/ and src/ manually or via CI."
