import os
import shutil
from pathlib import Path

from huggingface_hub import HfApi, create_repo

TOKEN = os.environ["HF_TOKEN"]
api = HfApi(token=TOKEN)
user = api.whoami()["name"]
repo_id = f"{user}/churn-mlops-api"
print("user:", user)

create_repo(repo_id, repo_type="space", space_sdk="docker", token=TOKEN, exist_ok=True)
print("space created:", repo_id)

# Stage directory
stage = Path("deploy/_stage")
if stage.exists():
    shutil.rmtree(stage)
stage.mkdir(parents=True)

# Copy deploy/space contents
for f in Path("deploy/space").iterdir():
    if f.is_file():
        shutil.copy(f, stage / f.name)

# Copy src, models, params, requirements.lock
shutil.copytree("src", stage / "src")
shutil.copytree("models", stage / "models")
shutil.copy("params.yaml", stage / "params.yaml")
shutil.copy("requirements.lock", stage / "requirements.lock")

# Upload
api.upload_folder(folder_path=str(stage), repo_id=repo_id, repo_type="space", token=TOKEN)
print("uploaded. Space URL: https://" + repo_id.replace("/", "-") + ".hf.space")
