"""Deterministic yield / revenue / profit model functions.

Mathematical model
------------------

Yield (quintals / ha):
    yield_qtl_ha = base_yield * soil_multiplier * water_stress_factor * heat_stress_penalty

Revenue (INR / ha):
    revenue_inr_ha = yield_qtl_ha * mandi_price_inr_per_qtl

Profit (INR / ha):
    profit_inr_ha = revenue_inr_ha - input_cost_inr_ha

Multiplier lookup tables
------------------------

soil_multiplier
    Maps the farmer's declared soil type to a yield scalar.
    Values are calibrated against ICAR district trial data.

    "loamy"  → 1.00  (reference)
    "clay"   → 0.92
    "sandy"  → 0.82
    "silt"   → 0.95
    "black"  → 1.05  (cotton-optimised vertisol)

water_stress_factor
    Encodes how well the irrigation regime meets crop demand.

    "irrigated" → 1.00  (full demand met)
    "partial"   → 0.85  (occasional deficit)
    "rainfed"   → 0.68  (fully rain-dependent)

heat_stress_penalty
    A continuous function of the fraction of days in the season
    where temp_avg_c > 35 °C (heat_stress == True).

    penalty = 1.0 - 0.30 * heat_stress_fraction
    Clamped to [0.40, 1.00].

All functions are pure and side-effect free — suitable for use
inside vectorized NumPy loops.
"""

from __future__ import annotations

# ── Look-up tables ────────────────────────────────────────────────────────────

SOIL_MULTIPLIER: dict[str, float] = {
    "loamy": 1.00,
    "clay":  0.92,
    "sandy": 0.82,
    "silt":  0.95,
    "black": 1.05,
}

WATER_STRESS_FACTOR: dict[str, float] = {
    "irrigated": 1.00,
    "partial":   0.85,
    "rainfed":   0.68,
}

# Coefficient: each 1 % of heat-stressed days costs 0.30 % of yield.
_HEAT_PENALTY_COEFFICIENT: float = 0.30
_HEAT_PENALTY_FLOOR: float = 0.40
_HEAT_PENALTY_CEIL: float = 1.00


# ── Public functions ──────────────────────────────────────────────────────────

def soil_multiplier(soil_type: str) -> float:
    """Return the yield multiplier for *soil_type*.

    Falls back to 1.0 for any unrecognised soil type (safe default).
    """
    return SOIL_MULTIPLIER.get(soil_type.lower(), 1.0)


def water_stress_factor(water_availability: str) -> float:
    """Return the water-stress yield scalar for *water_availability*."""
    return WATER_STRESS_FACTOR.get(water_availability.lower(), 0.85)


def heat_stress_penalty(heat_stress_fraction: float) -> float:
    """Return the heat-stress yield penalty scalar.

    Args:
        heat_stress_fraction: Fraction of growing-season days with
            temp_avg_c > 35 °C (0.0 – 1.0).

    Returns:
        Scalar in [0.40, 1.00].
    """
    penalty = 1.0 - _HEAT_PENALTY_COEFFICIENT * heat_stress_fraction
    return max(_HEAT_PENALTY_FLOOR, min(_HEAT_PENALTY_CEIL, penalty))


def compute_yield(
    base_yield_qtl_ha: float,
    soil_type: str,
    water_availability: str,
    heat_stress_fraction: float,
) -> float:
    """Deterministic yield formula.

    yield = base_yield * soil_multiplier * water_stress_factor * heat_stress_penalty

    Args:
        base_yield_qtl_ha: Expected mean yield from ICAR benchmarks (qtl/ha).
        soil_type: Farmer-declared soil type string.
        water_availability: Farmer-declared irrigation regime string.
        heat_stress_fraction: Fraction of season days above 35 °C.

    Returns:
        Adjusted yield in quintals per hectare.
    """
    return (
        base_yield_qtl_ha
        * soil_multiplier(soil_type)
        * water_stress_factor(water_availability)
        * heat_stress_penalty(heat_stress_fraction)
    )


def compute_revenue(yield_qtl_ha: float, mandi_price_inr_per_qtl: float) -> float:
    """Revenue = Yield × Mandi price.

    Args:
        yield_qtl_ha: Adjusted yield in quintals per hectare.
        mandi_price_inr_per_qtl: Simulated/observed modal price (INR / qtl).

    Returns:
        Revenue in INR per hectare.
    """
    return yield_qtl_ha * mandi_price_inr_per_qtl


def compute_profit(revenue_inr_ha: float, input_cost_inr_ha: float) -> float:
    """Profit = Revenue − Input cost.

    Args:
        revenue_inr_ha: Revenue in INR per hectare.
        input_cost_inr_ha: Cultivation cost in INR per hectare.

    Returns:
        Profit (may be negative) in INR per hectare.
    """
    return revenue_inr_ha - input_cost_inr_ha
