from __future__ import annotations

import numpy as np
import pytest

from churn.config import ThresholdParams
from churn.models.threshold import expected_net_benefit, optimize_threshold


def _params() -> ThresholdParams:
    return ThresholdParams(
        customer_lifetime_value=100.0,
        retention_offer_cost=10.0,
        offer_success_rate=0.5,
        sweep_min=0.01,
        sweep_max=0.99,
        sweep_steps=99,
    )


def test_expected_net_benefit_hand_computed() -> None:
    # 1 churner, 1 non-churner; target both.
    y = np.array([1, 0])
    proba = np.array([0.9, 0.9])
    params = _params()
    # EV churner = 0.5*100 - 10 = 40; non-churner = -10; total = 30
    assert expected_net_benefit(y, proba, 0.5, params) == pytest.approx(30.0)


def test_optimizer_picks_correct_threshold() -> None:
    # Churners have high probability, non-churners low.
    y = np.array([1, 1, 0, 0, 0])
    proba = np.array([0.9, 0.8, 0.1, 0.2, 0.15])
    params = _params()
    threshold, summary = optimize_threshold(y, proba, params)
    assert threshold >= 0.5
    assert (
        summary["expected_net_benefit_per_1000"]
        >= summary["expected_net_benefit_per_1000_at_0.5"] - 1e-9
    )


def test_profit_at_chosen_ge_profit_at_half() -> None:
    rng = np.random.default_rng(0)
    y = rng.integers(0, 2, size=50)
    proba = rng.random(size=50)
    params = _params()
    threshold, summary = optimize_threshold(y, proba, params)
    assert (
        summary["expected_net_benefit_per_1000"]
        >= summary["expected_net_benefit_per_1000_at_0.5"] - 1e-9
    )
