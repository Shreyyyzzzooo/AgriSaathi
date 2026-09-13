"""ICAR soil and crop reference data — local cache lookup.

Purely local: reads ``data/icar_reference_cache.json`` which is bundled with
the repository and never fetched from a network.

Provides baseline agronomic benchmarks for 35+ crops across all three Indian
agricultural seasons (Kharif, Rabi, Zaid):
  - Cereals: Rice, Wheat, Maize, Bajra, Jowar, Ragi
  - Pulses: Arhar, Moong, Urad, Gram, Lentil, Peas
  - Oilseeds: Groundnut, Mustard, Sesame, Soybean, Sunflower
  - Cash Crops: Cotton, Turmeric, Ginger
  - Vegetables: Potato, Onion, Garlic, Tomato, Okra, Bitter Gourd, Cabbage, Cauliflower, Coriander
  - Fruits: Banana, Papaya, Pomegranate, Grapes, Muskmelon, Watermelon

Each record contains:
    crop_id             str     e.g. "cotton_kharif"
    name                str     display name
    season              str     "rabi" | "kharif" | "zaid"
    duration_days       int     harvest duration in days
    yield_min_qtl_ha    float   minimum expected yield (quintals/ha)
    yield_max_qtl_ha    float   maximum expected yield (quintals/ha)
    yield_mean_qtl_ha   float   mean yield for simulation
    yield_std_qtl_ha    float   std deviation for Monte Carlo draws
    cost_inr_ha         int     approximate input cost (INR/ha)
    water_req           str     "low" | "medium" | "high"
    water_req_mm_season int     water requirement (mm/season)
    optimal_soil_types  list    e.g. ["black", "clay", "loam"]
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Resolved relative to this file so it works regardless of CWD.
_CACHE_FILE: Path = (
    Path(__file__).parent.parent.parent  # → backend/
    / "data"
    / "icar_reference_cache.json"
)

# Module-level cache — loaded once on first access.
_cache: dict[str, dict[str, Any]] | None = None


def _load() -> dict[str, dict[str, Any]]:
    """Load (and memoize) the ICAR reference JSON."""
    global _cache
    if _cache is None:
        with _CACHE_FILE.open(encoding="utf-8") as fh:
            _cache = json.load(fh)
    return _cache


# ── Public API ───────────────────────────────────────────────────────────────

def get_crop(crop_id: str) -> dict[str, Any] | None:
    """Return the ICAR benchmark record for *crop_id*, or None if not found.

    Args:
        crop_id: Identifier such as ``"wheat_rabi"`` or ``"cotton_kharif"``.

    Returns:
        Dict with agronomic benchmarks, or ``None``.
    """
    return _load().get(crop_id)


def list_crops() -> list[dict[str, Any]]:
    """Return all ICAR crop benchmark records as a list."""
    return list(_load().values())


def get_optimal_crops_for_soil(soil_type: str) -> list[dict[str, Any]]:
    """Return crops whose ``optimal_soil_types`` includes *soil_type*.

    Args:
        soil_type: One of ``"clay"``, ``"loam"``, ``"sandy"``, ``"black"``.

    Returns:
        Filtered list of crop benchmark dicts.
    """
    return [
        crop for crop in _load().values()
        if soil_type.lower() in [s.lower() for s in crop.get("optimal_soil_types", [])]
    ]
