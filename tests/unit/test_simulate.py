from __future__ import annotations


def test_simulate_traffic_basic() -> None:
    from churn.monitoring.simulate import simulate_traffic

    frame = simulate_traffic(n=50, shift=False, seed=1)
    assert len(frame) == 50
    assert "customerID" not in frame.columns


def test_simulate_traffic_shift() -> None:
    from churn.monitoring.simulate import simulate_traffic

    frame = simulate_traffic(n=50, shift=True, seed=1)
    assert len(frame) == 50
    assert (frame["Contract"] == "Month-to-month").any()
