"""Route handlers for GET /api/crops.

Filters crops from icar_reference_cache.json based on the farmer's declared
soil type and water availability, then applies budget_flag logic per the
frozen API contract.

Budget flag logic (from docs/api_contract.md):
    within_budget : cost_inr_ha ≤ budget
    marginal      : budget < cost_inr_ha ≤ budget × 1.2
    over_budget   : cost_inr_ha > budget × 1.2
"""

from __future__ import annotations

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
}


@router.get("/crops", response_model=list[CropCandidate])
def get_crops(
    location: str = Query(..., description="Farmer location string, e.g. 'Nashik, Maharashtra'"),
    budget: int   = Query(..., description="Budget in whole INR rupees", ge=1),
    soil_type: str = Query("loamy", description="Soil type declared by farmer"),
    water_availability: str = Query("irrigated", description="Irrigation regime"),
) -> list[CropCandidate]:
    """Return candidate crops filtered for the farmer's soil, water, and budget.

    Filters ICAR benchmarks by:
        1. Soil compatibility (optimal_soil_types must include the farmer's soil).
        2. Water compatibility (crop water_req must be reachable with the
           farmer's irrigation regime).

    Then tags each crop with a budget_flag based on cost_inr_ha vs budget.

    Args:
        location: City/state string (informational only for this endpoint).
        budget: Farmer's budget in INR.
        soil_type: One of loamy | clay | sandy | silt.
        water_availability: One of irrigated | partial | rainfed.

    Returns:
        Filtered list of CropCandidate objects, ordered within_budget first.
    """
    soil_token   = _SOIL_ALIAS.get(soil_type.lower(), soil_type.lower())
    water_compat = _WATER_COMPAT.get(water_availability.lower(), {"low", "medium", "high"})

    candidates: list[CropCandidate] = []
    for crop in list_crops():
        # ── Soil filter ─────────────────────────────────────────────────────
        optimal_soils = [s.lower() for s in crop.get("optimal_soil_types", [])]
        if optimal_soils and soil_token not in optimal_soils:
            continue

        # ── Water filter ────────────────────────────────────────────────────
        crop_water = crop.get("water_req", "medium").lower()
        if crop_water not in water_compat:
            continue

        # ── Budget flag ─────────────────────────────────────────────────────
        cost = crop.get("cost_inr_ha", 0)
        if cost <= budget:
            flag = "within_budget"
        elif cost <= budget * 1.2:
            flag = "marginal"
        else:
            flag = "over_budget"

        candidates.append(CropCandidate(
            crop_id=crop["crop_id"],
            name=crop["name"],
            season=crop["season"],
            duration_days=crop["duration_days"],
            budget_flag=flag,
        ))

    # Order: within_budget → marginal → over_budget
    _order = {"within_budget": 0, "marginal": 1, "over_budget": 2}
    candidates.sort(key=lambda c: _order[c.budget_flag])
    return candidates
