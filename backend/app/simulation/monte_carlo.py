"""Vectorized NumPy Monte Carlo simulation engine.

Entry point
-----------
    simulate_crops(
        farmer_input,
        candidate_crops,
        weather_forecast,
        num_simulations=500,
    ) -> dict[str, SimulationResult]

Simulation model per crop (fully vectorized — shape (N,) arrays)
----------------------------------------------------------------
1. Sample Mandi prices from a lognormal distribution:
       mu, sigma fitted from (modal_price, price_variance) via
       method-of-moments on the lognormal.

2. Sample yield base with weather volatility:
       cumulative_rainfall_perturb ~ Uniform(-25%, +25%) applied
       to the rain bonus.
       heatwave_freq_perturb       ~ Uniform(-0.05, +0.05) added
       to the heat_stress_fraction.

3. Apply the deterministic model (vectorized scalar ops):
       yield[N]   = base_yield * soil_mult * water_factor * heat_penalty[N]
       revenue[N] = yield[N] * mandi_price[N]
       profit[N]  = revenue[N] - input_cost

4. Budget enforcement:
       If crop.cost_inr_ha > farmer.budget_inr:
           budget_exceeded = True
           recommendation_rank_penalty applied (profit[N] *= 0.70)

5. Summary statistics:
       mean_profit, p10_profit, p50_profit, p90_profit
       loss_probability = fraction of runs where profit < 0
       histogram: 10-bin frequencies + bin edges (11 values) for Recharts

Output key contract (matches api_contract.md / CropStats schema)
----------------------------------------------------------------
Each SimulationResult carries:
    crop_id          str
    mean_profit      float   (INR/ha)
    p10_profit       float
    p50_profit       float
    p90_profit       float
    loss_probability float   (0.0 – 1.0)
    budget_exceeded  bool
    histogram        list[dict]  Recharts-ready: [{name, value, bin_start, bin_end}]
    stats            dict        CropStats-compatible subset for the /simulate response
        mean  → mean yield (qtl/ha)  — derived from profit via inverse price
        p10   → 10th-percentile profit
        p50   → 50th-percentile profit
        p90   → 90th-percentile profit
        histogram_bins → 11 bin edge floats (profit axis)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.simulation.crop_models import (
    heat_stress_penalty,
    soil_multiplier,
    water_stress_factor,
    compute_revenue,
    compute_profit,
)

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

_RAIN_BONUS_BASE: float = 0.10          # base bonus per unit rainy-day fraction
_STORM_PENALTY_BASE: float = 0.15       # base penalty per unit stormy-day fraction
_BUDGET_RANK_PENALTY: float = 0.70      # profit multiplier when budget exceeded
_MARKET_CRASH_DEPRESSION: float = 0.85  # price multiplier when crash risk active
_CRASH_THRESHOLD: float = 0.45          # fraction of district peers above which crash risk fires


# ── Output models ─────────────────────────────────────────────────────────────

@dataclass
class SimulationResult:
    crop_id: str
    mean_profit: float
    p10_profit: float
    p50_profit: float
    p90_profit: float
    loss_probability: float
    budget_exceeded: bool
    market_crash_risk: bool
    histogram: list[dict]       # Recharts-compatible
    stats: dict                 # CropStats-compatible subset (api_contract.md)
    recommendation_score: float # higher = better; used for ranking


# ── Farmer / crop input containers ───────────────────────────────────────────

@dataclass
class FarmerInput:
    location: str
    plot_size_ha: float
    soil_type: str
    water_availability: str
    budget_inr: int


@dataclass
class CropBenchmark:
    crop_id: str
    name: str
    season: str
    duration_days: int
    yield_mean_qtl_ha: float
    yield_std_qtl_ha: float
    cost_inr_ha: int
    modal_price_inr_per_qtl: float
    price_variance: float
    market_crash_risk: bool = False   # injected by diversification layer


# ── Public API ────────────────────────────────────────────────────────────────

def simulate_crops(
    farmer_input: FarmerInput,
    candidate_crops: list[CropBenchmark],
    weather_forecast: list[Any],          # list[DailyWeather] from data_sources
    num_simulations: int = 500,
    seed: int | None = None,
) -> dict[str, SimulationResult]:
    """Run *num_simulations* Monte Carlo iterations for every candidate crop.

    All per-crop work is fully vectorized (shape-(N,) NumPy arrays); no Python
    loops over simulation iterations.

    Args:
        farmer_input:      Farmer plot parameters.
        candidate_crops:   List of CropBenchmark objects (including price data).
        weather_forecast:  List of DailyWeather from the NASA POWER client.
        num_simulations:   Number of Monte Carlo runs per crop (1 – 500).
        seed:              Optional RNG seed for reproducibility (tests).

    Returns:
        Mapping from crop_id → SimulationResult.
    """
    rng = np.random.default_rng(seed)

    # ── Derived weather scalars (computed once, shared across crops) ──────────
    heat_frac, rain_frac, storm_frac = _weather_scalars(weather_forecast)

    results: dict[str, SimulationResult] = {}

    for crop in candidate_crops:
        result = _simulate_single_crop(
            crop=crop,
            farmer=farmer_input,
            heat_frac=heat_frac,
            rain_frac=rain_frac,
            storm_frac=storm_frac,
            num_simulations=num_simulations,
            rng=rng,
        )
        results[crop.crop_id] = result

    return results


# ── Internal helpers ──────────────────────────────────────────────────────────

def _weather_scalars(
    weather: list[Any],
) -> tuple[float, float, float]:
    """Derive (heat_fraction, rain_fraction, storm_fraction) from forecast.

    Handles both DailyWeather dataclasses (from data_sources) and plain dicts.
    """
    if not weather:
        return 0.0, 0.0, 0.0

    n = len(weather)

    def _get(day, attr: str, fallback=0.0):
        if hasattr(day, attr):
            return getattr(day, attr)
        if isinstance(day, dict):
            return day.get(attr, fallback)
        return fallback

    heat_count  = sum(1 for d in weather if _get(d, "heat_stress", False)
                      or _get(d, "temp_c", 25.0) > 35.0
                      or (_get(d, "temp_avg_c", 25.0) > 35.0))
    rain_count  = sum(1 for d in weather if _get(d, "rainfall_mm", 0.0) > 10.0)
    storm_count = sum(1 for d in weather
                      if _get(d, "condition", "sunny") == "stormy"
                      or (_get(d, "rainfall_mm", 0.0) > 10.0 and
                          _get(d, "temp_avg_c", 25.0) > 35.0))

    return heat_count / n, rain_count / n, storm_count / n


def _lognormal_params(modal: float, variance: float) -> tuple[float, float]:
    """Fit lognormal mu/sigma from modal price and variance (method of moments).

    We treat modal ≈ mean for the fitting approximation (acceptable when
    variance is small relative to the mean).
    """
    mean = modal
    std  = variance ** 0.5
    if std <= 0 or mean <= 0:
        # Degenerate case: return deterministic point distribution.
        return float(np.log(mean)), 1e-6
    cv2 = (std / mean) ** 2
    sigma2 = float(np.log(1.0 + cv2))
    mu     = float(np.log(mean) - 0.5 * sigma2)
    return mu, float(sigma2 ** 0.5)


def _simulate_single_crop(
    crop: CropBenchmark,
    farmer: FarmerInput,
    heat_frac: float,
    rain_frac: float,
    storm_frac: float,
    num_simulations: int,
    rng: np.random.Generator,
) -> SimulationResult:
    """Fully vectorized simulation for a single crop. Returns SimulationResult."""

    N = num_simulations

    # ── 1. Sample Mandi prices — lognormal ───────────────────────────────────
    mu, sigma = _lognormal_params(crop.modal_price_inr_per_qtl, crop.price_variance)
    prices: np.ndarray = rng.lognormal(mean=mu, sigma=sigma, size=N)  # shape (N,)

    # Apply market crash price depression
    if crop.market_crash_risk:
        prices = prices * _MARKET_CRASH_DEPRESSION

    # ── 2. Perturb weather volatility ─────────────────────────────────────────
    # Rain perturbation: ±25% of the rain_frac fed into the bonus
    rain_perturb:  np.ndarray = rng.uniform(-0.25, 0.25, size=N)
    # Heatwave freq perturbation: ±5 percentage points
    heat_perturb:  np.ndarray = rng.uniform(-0.05, 0.05, size=N)

    perturbed_heat_frac:  np.ndarray = np.clip(heat_frac  + heat_perturb,  0.0, 1.0)
    perturbed_rain_bonus: np.ndarray = _RAIN_BONUS_BASE  * rain_frac  * (1.0 + rain_perturb)
    perturbed_storm_pen:  np.ndarray = np.full(N, _STORM_PENALTY_BASE * storm_frac)

    # ── 3. Vectorized yield computation ──────────────────────────────────────
    s_mult  = soil_multiplier(farmer.soil_type)            # scalar
    w_fact  = water_stress_factor(farmer.water_availability) # scalar

    # heat_stress_penalty per run (vectorized)
    heat_penalty: np.ndarray = np.clip(
        1.0 - 0.30 * perturbed_heat_frac, 0.40, 1.00
    )

    # Base yield draw from normal distribution (±std from ICAR)
    base_yields: np.ndarray = rng.normal(
        loc=crop.yield_mean_qtl_ha,
        scale=crop.yield_std_qtl_ha,
        size=N,
    )
    base_yields = np.clip(base_yields, 0.0, None)

    # Weather modifier per run
    weather_modifier: np.ndarray = (
        1.0 + perturbed_rain_bonus - perturbed_storm_pen
    )
    weather_modifier = np.clip(weather_modifier, 0.50, 1.50)

    yields: np.ndarray = (
        base_yields * s_mult * w_fact * heat_penalty * weather_modifier
    )

    # ── 4. Revenue and profit (vectorized) ───────────────────────────────────
    revenue: np.ndarray = yields * prices
    profit:  np.ndarray = revenue - float(crop.cost_inr_ha)

    # ── 5. Budget enforcement ─────────────────────────────────────────────────
    budget_exceeded = crop.cost_inr_ha > farmer.budget_inr
    if budget_exceeded:
        profit = profit * _BUDGET_RANK_PENALTY

    # ── 6. Summary statistics ────────────────────────────────────────────────
    mean_p  = float(np.mean(profit))
    p10_p   = float(np.percentile(profit, 10))
    p50_p   = float(np.percentile(profit, 50))
    p90_p   = float(np.percentile(profit, 90))
    loss_pr = float(np.mean(profit < 0))

    # ── 7. Histogram (10 equal-width bins, 11 edges) ─────────────────────────
    counts, edges = np.histogram(profit, bins=10)
    # Recharts-ready list of dicts
    histogram: list[dict] = [
        {
            "name":      f"{edges[i]:.0f}–{edges[i+1]:.0f}",
            "value":     int(counts[i]),
            "bin_start": round(float(edges[i]),   2),
            "bin_end":   round(float(edges[i+1]), 2),
        }
        for i in range(len(counts))
    ]

    # ── 8. CropStats-compatible stats dict (api_contract.md) ─────────────────
    # The contract's "mean/p10/p50/p90/histogram_bins" are profit-axis values.
    # histogram_bins = 11 edge floats as required by CropStats validator.
    stats = {
        "mean":            round(mean_p,  2),
        "p10":             round(p10_p,   2),
        "p50":             round(p50_p,   2),
        "p90":             round(p90_p,   2),
        "histogram_bins":  [round(float(e), 2) for e in edges],  # 11 values
    }

    # ── 9. Recommendation score (higher = better) ─────────────────────────────
    rec_score = p50_p
    if budget_exceeded:
        rec_score *= 0.70
    if crop.market_crash_risk:
        rec_score *= 0.80

    return SimulationResult(
        crop_id=crop.crop_id,
        mean_profit=round(mean_p, 2),
        p10_profit=round(p10_p, 2),
        p50_profit=round(p50_p, 2),
        p90_profit=round(p90_p, 2),
        loss_probability=round(loss_pr, 4),
        budget_exceeded=budget_exceeded,
        market_crash_risk=crop.market_crash_risk,
        histogram=histogram,
        stats=stats,
        recommendation_score=round(rec_score, 2),
    )
