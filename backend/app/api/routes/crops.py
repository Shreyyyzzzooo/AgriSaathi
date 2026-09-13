"""Route handlers for GET /api/crops.

Filters crops from icar_reference_cache.json based on the farmer's declared
soil type and water availability, then applies budget_flag logic per the
frozen API contract.

Budget flag logic (from docs/api_contract.md):
    within_budget : total_cost ≤ budget
    marginal      : budget < total_cost ≤ budget × 1.2
    over_budget   : total_cost > budget × 1.2

where total_cost = cost_inr_ha × plot_size_ha (defaults to 1.0).

Season prioritization:
    Current Indian season is determined from today's month:
      Kharif — June to October
      Rabi   — November to March
      Zaid   — March to May
    In-season crops are returned first; out-of-season crops follow.
"""

from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Query

from app.data_sources.icar_soil import list_crops
from app.models.schemas import CropCandidate

router = APIRouter(prefix="/api", tags=["crops"])

# Water compatibility matrix: farmer declaration → compatible ICAR water_req tiers
_WATER_COMPAT: dict[str, set[str]] = {
    "irrigated": {"low", "medium", "high"},
    "partial":   {"low", "medium"},
    "rainfed":   {"low"},
}

# Soil type normalisation: API enum → ICAR optimal_soil_types token
_SOIL_ALIAS: dict[str, str] = {
    "loamy": "loam",
    "clay":  "clay",
    "sandy": "sandy",
    "silt":  "loam",   # silt treated as loam-compatible
    "black": "black",
    # 12-class USDA names — map to coarse buckets
    "sandy_loam":       "sandy",
    "loamy_sand":       "sandy",
    "sand":             "sandy",
    "sandy_clay_loam":  "loam",
    "silty_clay":       "clay",
    "silty_clay_loam":  "loam",
    "silt_loam":        "loam",
    "clay_loam":        "clay",
}


def _current_season() -> str:
    """Determine the current Indian agricultural season from today's date.

    Returns:
        "kharif" | "rabi" | "zaid"
    """
    month = datetime.now().month
    if 6 <= month <= 10:
        return "kharif"
    elif month in (11, 12) or 1 <= month <= 3:
        return "rabi"
    else:   # April, May
        return "zaid"


@router.get("/crops", response_model=list[CropCandidate])
def get_crops(
    location: str = Query(..., description="Farmer location string, e.g. 'Nashik, Maharashtra'"),
    budget: int   = Query(..., description="Budget in whole INR rupees", ge=1),
    soil_type: str = Query("loamy", description="Soil type declared by farmer"),
    water_availability: str = Query("irrigated", description="Irrigation regime"),
    plot_size_ha: float = Query(1.0, description="Plot size in hectares", gt=0),
) -> list[CropCandidate]:
    """Return candidate crops filtered and prioritised for the farmer's parameters.

    Filters ICAR benchmarks by:
        1. Soil compatibility (optimal_soil_types must include the farmer's soil).
        2. Water compatibility (crop water_req must be reachable with the
           farmer's irrigation regime).

    Then tags each crop with a budget_flag based on total cost vs budget,
    where total_cost = cost_inr_ha × plot_size_ha.

    In-season crops (matching today's Indian agricultural season) are sorted
    first; out-of-season crops follow but are still included.

    Args:
        location: City/state string (informational only for this endpoint).
        budget: Farmer's budget in INR.
        soil_type: One of loamy | clay | sandy | silt.
        water_availability: One of irrigated | partial | rainfed.
        plot_size_ha: Plot size in hectares — used to compute total cost.

    Returns:
        Filtered list of CropCandidate objects.
        Order: in-season → out-of-season; within each group, within_budget → marginal → over_budget.
    """
    soil_token   = _SOIL_ALIAS.get(soil_type.lower(), soil_type.lower())
    water_compat = _WATER_COMPAT.get(water_availability.lower(), {"low", "medium", "high"})
    current_season = _current_season()

    in_season:  list[CropCandidate] = []
    out_season: list[CropCandidate] = []

    for crop in list_crops():
        # ── Soil filter ─────────────────────────────────────────────────────
        optimal_soils = [s.lower() for s in crop.get("optimal_soil_types", [])]
        if optimal_soils and soil_token not in optimal_soils:
            continue

        # ── Water filter ────────────────────────────────────────────────────
        crop_water = crop.get("water_req", "medium").lower()
        if crop_water not in water_compat:
            continue

        # ── Budget flag (total cost for entire plot) ─────────────────────────
        cost_per_ha  = crop.get("cost_inr_ha", 0)
        total_cost   = cost_per_ha * plot_size_ha
        if total_cost <= budget:
            flag = "within_budget"
        elif total_cost <= budget * 1.2:
            flag = "marginal"
        else:
            flag = "over_budget"

        candidate = CropCandidate(
            crop_id=crop["crop_id"],
            name=crop["name"],
            season=crop["season"],
            duration_days=crop["duration_days"],
            budget_flag=flag,
        )

        if crop["season"] == current_season:
            in_season.append(candidate)
        else:
            out_season.append(candidate)

    # Order within each group: within_budget → marginal → over_budget
    _order = {"within_budget": 0, "marginal": 1, "over_budget": 2}
    in_season.sort(key=lambda c: _order[c.budget_flag])
    out_season.sort(key=lambda c: _order[c.budget_flag])

    return in_season + out_season
