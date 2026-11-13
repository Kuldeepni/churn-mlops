# ---------------------------------------------------------------------------
# churn-mlops - self documenting Makefile.
# Run `make help` to see every target.
#
# The Makefile is written to work with both POSIX shells and Windows cmd
# (no `rm`, `grep` or `awk` dependencies), because the project is developed on
# Windows and runs in Linux CI/Docker.
# ---------------------------------------------------------------------------

.DEFAULT_GOAL := help

# --- Interpreter -----------------------------------------------------------
ifeq ($(OS),Windows_NT)
VENV_BIN := .venv/Scripts
else
VENV_BIN := .venv/bin
endif
PYTHON := $(VENV_BIN)/python
PYTHON_BOOT := python
UV := uv

.PHONY: help install lock data train evaluate repro test test-fast lint format \
        typecheck precommit serve simulate drift clean docker-build docker-up \
        docker-down docker-smoke notebooks check

help: ## Show this help
	@$(PYTHON_BOOT) scripts/make_help.py

# --- Setup -----------------------------------------------------------------
install: ## Create .venv and install the project with dev extras
	$(PYTHON_BOOT) -m venv .venv
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -e ".[dev]"

lock: ## Regenerate requirements.lock from pyproject.toml
	$(UV) pip compile pyproject.toml --extra dev --python-version 3.11 -o requirements.lock

# --- Data ------------------------------------------------------------------
data: ## Download the raw dataset and build the train/val/test splits
	$(PYTHON) -m churn.data.ingest
	$(PYTHON) -m churn.data.split

# --- Modelling -------------------------------------------------------------
train: ## Train, calibrate and evaluate the model (DVC pipeline)
	$(PYTHON) -m churn.models.train
	$(PYTHON) -m churn.models.calibrate

evaluate: ## Evaluate on the test split and enforce the quality gate
	$(PYTHON) -m churn.evaluate

repro: ## Reproduce the full DVC pipeline end to end
	$(PYTHON) -m dvc repro

# --- Quality ---------------------------------------------------------------
test: ## Run the test suite with coverage
	$(PYTHON) -m pytest --cov=churn --cov-report=term-missing --cov-report=xml

test-fast: ## Run the test suite without the slow markers
	$(PYTHON) -m pytest -m "not slow" -q

lint: ## Run ruff (check + format check)
	$(PYTHON) -m ruff check src tests scripts
	$(PYTHON) -m ruff format --check src tests scripts

format: ## Auto-format the code with ruff
	$(PYTHON) -m ruff check --fix src tests scripts
	$(PYTHON) -m ruff format src tests scripts

typecheck: ## Run mypy in strict mode over src/churn
	$(PYTHON) -m mypy --config-file pyproject.toml src/churn

precommit: ## Run all pre-commit hooks on the working tree
	$(PYTHON) -m pre_commit run --all-files

check: lint typecheck test ## Run lint + typecheck + tests

notebooks: ## Execute the EDA notebook with saved outputs
	$(PYTHON) -m jupyter nbconvert --to notebook --execute --inplace notebooks/01_eda.ipynb

web-data: ## Export real pipeline outputs as JSON for the frontend
	$(PYTHON) scripts/export_frontend_data.py

deploy-space: ## Deploy the API to Hugging Face Spaces (requires HF_TOKEN)
	bash scripts/deploy_space.sh

# --- Serving ----------------------------------------------------------------
serve: ## Start the FastAPI service on http://127.0.0.1:8000
	$(PYTHON) -m uvicorn churn.api.main:app --host 127.0.0.1 --port 8000 --reload

simulate: ## Send simulated traffic to a running API (use SIM_ARGS=--shift)
	$(PYTHON) scripts/simulate_traffic.py $(SIM_ARGS)

drift: ## Compare logged production traffic against the training reference
	$(PYTHON) -m churn.monitoring.drift

# --- Docker ----------------------------------------------------------------
docker-build: ## Build the production API image
	docker build -t churn-mlops:local .

docker-up: ## Start the compose stack (api + mlflow)
	docker compose up -d --build

docker-down: ## Stop the compose stack
	docker compose down -v

docker-smoke: ## Smoke test a locally built image
	docker run --rm -d --name churn-smoke -p 8010:8000 churn-mlops:local
	docker exec churn-smoke python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read().decode())"
	docker rm -f churn-smoke

# --- Housekeeping -----------------------------------------------------------
clean: ## Remove caches and generated artifacts (keeps the raw download cache)
	@$(PYTHON_BOOT) -c "import shutil, pathlib; [shutil.rmtree(p, ignore_errors=True) for p in ['.pytest_cache', '.mypy_cache', '.ruff_cache', 'htmlcov', 'data/interim', 'data/processed', 'reports', 'models']]; [p.unlink(missing_ok=True) for p in ['.coverage', 'coverage.xml']]; print('cleaned')"
