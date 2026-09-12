"""Tests for backend/app/simulation — Monte Carlo engine, crop models, diversification.

Assertions:
    1. 500 Monte Carlo runs complete in under 500 ms.
    2. Output keys strictly match api_contract.md (CropStats schema).
    3. histogram_bins always has exactly 11 values.
    4. p10 <= p50 <= p90.
    5. loss_probability in [0, 1].
    6. budget_exceeded flag set correctly.
    7. market_crash_risk flag fires when peer_pct > 45%.
    8. crop_models math identities hold.
    9. diversification returns expected crash flags from mock data.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import pytest


# ── Shared fixtures ───────────────────────────────────────────────────────────

@dataclass
class _MockWeatherDay:
    day_index: int
    rainfall_mm: float
    temp_avg_c: float
    heat_stress: bool
    solar_mj_m2: float = 15.0


def _make_weather(n: int = 120) -> list[_MockWeatherDay]:
    """Generate n synthetic weather days."""
    days = []
    for i in range(n):
        rain  = 8.0 if i % 7 == 0 else 0.0
        temp  = 37.0 if i % 10 == 0 else 28.0
        days.append(_MockWeatherDay(
            day_index=i + 1,
            rainfall_mm=rain,
            temp_avg_c=temp,
            heat_stress=temp > 35.0,
        ))
    return days


def _make_farmer(budget: int = 50000):
    from app.simulation.monte_carlo import FarmerInput
    return FarmerInput(
        location="Nashik, Maharashtra",
        plot_size_ha=2.5,
        soil_type="loamy",
        water_availability="irrigated",
        budget_inr=budget,
    )


def _make_crop(crop_id: str = "wheat_rabi", cost: int = 25000, crash: bool = False):
    from app.simulation.monte_carlo import CropBenchmark
    return CropBenchmark(
        crop_id=crop_id,
        name="Wheat",
        season="rabi",
        duration_days=120,
        yield_mean_qtl_ha=38.0,
        yield_std_qtl_ha=5.0,
        cost_inr_ha=cost,
        modal_price_inr_per_qtl=2275.0,
        price_variance=14400.0,   # std = 120
        market_crash_risk=crash,
    )


# ─────────────────────────────────────────────────────────────────────────────
# crop_models tests
# ─────────────────────────────────────────────────────────────────────────────

class TestCropModels:

    def test_soil_multiplier_loamy_is_reference(self):
        from app.simulation.crop_models import soil_multiplier
        assert soil_multiplier("loamy") == 1.00

    def test_soil_multiplier_sandy_less_than_loamy(self):
        from app.simulation.crop_models import soil_multiplier
        assert soil_multiplier("sandy") < soil_multiplier("loamy")

    def test_water_stress_irrigated_is_one(self):
        from app.simulation.crop_models import water_stress_factor
        assert water_stress_factor("irrigated") == 1.00

    def test_water_stress_rainfed_less_than_irrigated(self):
        from app.simulation.crop_models import water_stress_factor
        assert water_stress_factor("rainfed") < water_stress_factor("irrigated")

    def test_heat_penalty_zero_fraction_is_one(self):
        from app.simulation.crop_models import heat_stress_penalty
        assert heat_stress_penalty(0.0) == 1.00

    def test_heat_penalty_full_fraction_clamped_to_floor(self):
        from app.simulation.crop_models import heat_stress_penalty
        # 1.0 - 0.30*1.0 = 0.70 — above the floor; floor only activates for
        # pathological fractions > 2.0 that would otherwise go below 0.40.
        assert abs(heat_stress_penalty(1.0) - 0.70) < 1e-9
        # Verify the floor actually clamps a supra-1.0 fraction edge case
        assert heat_stress_penalty(10.0) == 0.40

    def test_heat_penalty_intermediate(self):
        from app.simulation.crop_models import heat_stress_penalty
        # 0.50 fraction → 1.0 - 0.30*0.50 = 0.85
        assert abs(heat_stress_penalty(0.50) - 0.85) < 1e-9

    def test_compute_yield_identity(self):
        from app.simulation.crop_models import compute_yield
        # With loamy + irrigated + 0 heat stress → yield == base_yield
        result = compute_yield(40.0, "loamy", "irrigated", 0.0)
        assert abs(result - 40.0) < 1e-9

    def test_compute_revenue(self):
        from app.simulation.crop_models import compute_revenue
        assert abs(compute_revenue(38.0, 2275.0) - 86450.0) < 0.01

    def test_compute_profit_positive(self):
        from app.simulation.crop_models import compute_profit
        assert compute_profit(86450.0, 25000.0) == pytest.approx(61450.0)

    def test_compute_profit_can_be_negative(self):
        from app.simulation.crop_models import compute_profit
        assert compute_profit(10000.0, 50000.0) == pytest.approx(-40000.0)

    def test_unknown_soil_type_falls_back_to_one(self):
        from app.simulation.crop_models import soil_multiplier
        assert soil_multiplier("volcanic") == 1.0

    def test_yield_formula_chain(self):
        """Yield = base × soil × water × heat; all factors < 1 when stressed."""
        from app.simulation.crop_models import compute_yield
        stressed = compute_yield(40.0, "sandy", "rainfed", 0.5)
        normal   = compute_yield(40.0, "loamy", "irrigated", 0.0)
        assert stressed < normal


# ─────────────────────────────────────────────────────────────────────────────
# Monte Carlo engine tests
# ─────────────────────────────────────────────────────────────────────────────

class TestMonteCarlo:

    def test_500_runs_complete_under_500ms(self):
        """Performance: 500 runs for one crop must finish in < 500 ms."""
        from app.simulation.monte_carlo import simulate_crops

        farmer  = _make_farmer()
        crops   = [_make_crop()]
        weather = _make_weather(120)

        start = time.perf_counter()
        simulate_crops(farmer, crops, weather, num_simulations=500, seed=42)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms < 500, f"Simulation took {elapsed_ms:.1f} ms — expected < 500 ms"

    def test_output_keys_match_api_contract(self):
        """stats dict must contain exactly: mean, p10, p50, p90, histogram_bins."""
        from app.simulation.monte_carlo import simulate_crops

        results = simulate_crops(
            _make_farmer(), [_make_crop()], _make_weather(), num_simulations=200, seed=1
        )
        result = results["wheat_rabi"]
        stats  = result.stats

        required_keys = {"mean", "p10", "p50", "p90", "histogram_bins"}
        assert set(stats.keys()) == required_keys

    def test_histogram_bins_has_eleven_values(self):
        """histogram_bins must have exactly 11 float values."""
        from app.simulation.monte_carlo import simulate_crops

        results = simulate_crops(
            _make_farmer(), [_make_crop()], _make_weather(), num_simulations=200, seed=2
        )
        bins = results["wheat_rabi"].stats["histogram_bins"]
        assert len(bins) == 11

    def test_percentile_ordering(self):
        """p10 <= p50 <= p90 must always hold."""
        from app.simulation.monte_carlo import simulate_crops

        results = simulate_crops(
            _make_farmer(), [_make_crop()], _make_weather(), num_simulations=300, seed=3
        )
        r = results["wheat_rabi"]
        assert r.p10_profit <= r.p50_profit
        assert r.p50_profit <= r.p90_profit

    def test_loss_probability_in_range(self):
        """loss_probability must be in [0, 1]."""
        from app.simulation.monte_carlo import simulate_crops

        results = simulate_crops(
            _make_farmer(), [_make_crop()], _make_weather(), num_simulations=200, seed=4
        )
        lp = results["wheat_rabi"].loss_probability
        assert 0.0 <= lp <= 1.0

    def test_budget_exceeded_false_when_within_budget(self):
        from app.simulation.monte_carlo import simulate_crops

        farmer  = _make_farmer(budget=50000)
        crop    = _make_crop(cost=25000)   # well within budget
        results = simulate_crops(farmer, [crop], _make_weather(), num_simulations=100, seed=5)
        assert results["wheat_rabi"].budget_exceeded is False

    def test_budget_exceeded_true_when_over_budget(self):
        from app.simulation.monte_carlo import simulate_crops

        farmer  = _make_farmer(budget=20000)
        crop    = _make_crop(cost=85000)   # sugarcane-level cost
        results = simulate_crops(farmer, [crop], _make_weather(), num_simulations=100, seed=6)
        assert results["wheat_rabi"].budget_exceeded is True

    def test_budget_exceeded_lowers_recommendation_score(self):
        """A crop with budget_exceeded should have lower rec score than same crop without."""
        from app.simulation.monte_carlo import simulate_crops

        weather = _make_weather()
        crop_ok   = _make_crop("crop_a", cost=10000)
        crop_over = _make_crop("crop_b", cost=10000)

        # Run with big budget (crop_a affordable)
        r_ok   = simulate_crops(_make_farmer(budget=50000), [crop_ok],   weather, seed=7)
        # Run with tiny budget (crop_b over budget)
        r_over = simulate_crops(_make_farmer(budget=5000),  [crop_over], weather, seed=7)

        assert r_ok["crop_a"].recommendation_score >= r_over["crop_b"].recommendation_score

    def test_multiple_crops_all_present_in_output(self):
        """Output must contain an entry for each candidate crop."""
        from app.simulation.monte_carlo import simulate_crops

        crops = [
            _make_crop("wheat_rabi",    cost=25000),
            _make_crop("cotton_kharif", cost=42000),
            _make_crop("maize_kharif",  cost=22000),
        ]
        results = simulate_crops(_make_farmer(), crops, _make_weather(), seed=8)
        assert set(results.keys()) == {"wheat_rabi", "cotton_kharif", "maize_kharif"}

    def test_market_crash_risk_flag_propagates(self):
        """market_crash_risk=True on CropBenchmark must appear in SimulationResult."""
        from app.simulation.monte_carlo import simulate_crops

        crop    = _make_crop(crash=True)
        results = simulate_crops(_make_farmer(), [crop], _make_weather(), seed=9)
        assert results["wheat_rabi"].market_crash_risk is True

    def test_recharts_histogram_format(self):
        """Each histogram entry must have name, value, bin_start, bin_end."""
        from app.simulation.monte_carlo import simulate_crops

        results = simulate_crops(
            _make_farmer(), [_make_crop()], _make_weather(), num_simulations=100, seed=10
        )
        hist = results["wheat_rabi"].histogram
        assert len(hist) == 10
        for entry in hist:
            assert "name"      in entry
            assert "value"     in entry
            assert "bin_start" in entry
            assert "bin_end"   in entry
            assert isinstance(entry["value"], int)

    def test_deterministic_with_seed(self):
        """Same seed must produce identical mean_profit values."""
        from app.simulation.monte_carlo import simulate_crops

        args = (_make_farmer(), [_make_crop()], _make_weather())
        r1 = simulate_crops(*args, num_simulations=100, seed=99)
        r2 = simulate_crops(*args, num_simulations=100, seed=99)
        assert r1["wheat_rabi"].mean_profit == r2["wheat_rabi"].mean_profit

    def test_empty_weather_does_not_crash(self):
        """Empty weather list should not raise — falls back to zero-fraction scalars."""
        from app.simulation.monte_carlo import simulate_crops

        results = simulate_crops(_make_farmer(), [_make_crop()], [], seed=11)
        assert "wheat_rabi" in results

    def test_500_runs_for_five_crops_under_2500ms(self):
        """Performance: 500 runs for 5 crops must finish in < 2500 ms."""
        from app.simulation.monte_carlo import simulate_crops, CropBenchmark

        crops = [
            CropBenchmark("wheat_rabi",    "Wheat",     "rabi",   120, 38.0, 5.0,  25000, 2275.0, 14400.0),
            CropBenchmark("cotton_kharif", "Cotton",    "kharif", 180, 18.0, 3.5,  42000, 6500.0, 230400.0),
            CropBenchmark("maize_kharif",  "Maize",     "kharif",  90, 50.0, 8.0,  22000, 1900.0, 32400.0),
            CropBenchmark("soybean_kharif","Soybean",   "kharif", 100, 22.0, 4.0,  28000, 4200.0, 102400.0),
            CropBenchmark("chickpea_rabi", "Chickpea",  "rabi",   110, 16.0, 2.8,  18000, 5400.0, 160000.0),
        ]

        start = time.perf_counter()
        simulate_crops(_make_farmer(), crops, _make_weather(), num_simulations=500, seed=42)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms < 2500, f"5-crop simulation took {elapsed_ms:.1f} ms — expected < 2500 ms"


# ─────────────────────────────────────────────────────────────────────────────
# Diversification tests
# ─────────────────────────────────────────────────────────────────────────────

class TestDiversification:

    def test_nagpur_cotton_triggers_crash_risk(self):
        """cotton_kharif in Nagpur has 52% peers → crash risk True."""
        from app.simulation.diversification import check_diversification

        result = check_diversification(["cotton_kharif"], "Nagpur, Maharashtra")
        assert result["cotton_kharif"]["market_crash_risk"] is True

    def test_nagpur_wheat_no_crash_risk(self):
        """wheat_rabi in Nagpur has only 12% peers → no crash risk."""
        from app.simulation.diversification import check_diversification

        result = check_diversification(["wheat_rabi"], "Nagpur, Maharashtra")
        assert result["wheat_rabi"]["market_crash_risk"] is False

    def test_ludhiana_wheat_triggers_crash_risk(self):
        """wheat_rabi in Ludhiana has 68% peers → crash risk True."""
        from app.simulation.diversification import check_diversification

        result = check_diversification(["wheat_rabi"], "Ludhiana, Punjab")
        assert result["wheat_rabi"]["market_crash_risk"] is True

    def test_indore_soybean_triggers_crash_risk(self):
        """soybean_kharif in Indore has 58% peers → crash risk True."""
        from app.simulation.diversification import check_diversification

        result = check_diversification(["soybean_kharif"], "Indore, Madhya Pradesh")
        assert result["soybean_kharif"]["market_crash_risk"] is True

    def test_unknown_crop_in_district_returns_false(self):
        """Crop not in district data → peer_pct = 0.0, crash risk False."""
        from app.simulation.diversification import check_diversification

        result = check_diversification(["onion_rabi"], "Nagpur, Maharashtra")
        assert result["onion_rabi"]["market_crash_risk"] is False
        assert result["onion_rabi"]["peer_pct"] == 0.0

    def test_crash_risk_sets_depression_factor(self):
        """When crash risk is True, price_depression_factor must be < 1.0."""
        from app.simulation.diversification import check_diversification, PRICE_DEPRESSION_FACTOR

        result = check_diversification(["cotton_kharif"], "Nagpur, Maharashtra")
        assert result["cotton_kharif"]["price_depression_factor"] == PRICE_DEPRESSION_FACTOR
        assert result["cotton_kharif"]["price_depression_factor"] < 1.0

    def test_no_crash_sets_depression_factor_one(self):
        """When no crash risk, price_depression_factor must be 1.0."""
        from app.simulation.diversification import check_diversification

        result = check_diversification(["wheat_rabi"], "Nagpur, Maharashtra")
        assert result["wheat_rabi"]["price_depression_factor"] == 1.0

    def test_multiple_crops_all_in_result(self):
        """Result must contain an entry for every requested crop."""
        from app.simulation.diversification import check_diversification

        crops = ["cotton_kharif", "wheat_rabi", "maize_kharif"]
        result = check_diversification(crops, "Nagpur, Maharashtra")
        assert set(result.keys()) == set(crops)

    def test_peer_pct_in_range(self):
        """peer_pct must be in [0.0, 1.0] for all crops."""
        from app.simulation.diversification import check_diversification

        result = check_diversification(
            ["cotton_kharif", "soybean_kharif", "wheat_rabi"],
            "Nagpur, Maharashtra",
        )
        for crop_id, info in result.items():
            assert 0.0 <= info["peer_pct"] <= 1.0, f"{crop_id} peer_pct out of range"

    def test_planting_data_file_exists_and_valid(self):
        """mock_district_planting_data.json must be loadable JSON with ≥5 records."""
        import json
        from app.simulation.diversification import _PLANTING_DATA_FILE

        assert _PLANTING_DATA_FILE.exists()
        records = json.loads(_PLANTING_DATA_FILE.read_text())
        assert isinstance(records, list)
        assert len(records) >= 5
