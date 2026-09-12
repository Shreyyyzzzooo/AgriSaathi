"""District peer planting analysis — diversification and market-crash risk.

Reads ``data/mock_district_planting_data.json`` to determine what fraction
of farmers in the same district are planting each candidate crop.

Market-crash rule
-----------------
If > 45 % of district peers are planting the same crop, that crop receives:
    market_crash_risk = True
    price_depression_factor applied to all simulated prices (0.85 ×)

The 45 % threshold and depression factor are configurable via module-level
constants so they can be overridden in tests.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

CRASH_THRESHOLD: float = 0.45          # > 45 % triggers the alert
PRICE_DEPRESSION_FACTOR: float = 0.85  # applied to simulated prices

_PLANTING_DATA_FILE: Path = (
    Path(__file__).parent.parent.parent  # → backend/
    / "data"
    / "mock_district_planting_data.json"
)

# Hardcoded city → district mapping (reuses geocode cities from nasa_power).
_CITY_TO_DISTRICT: dict[str, str] = {
    "nashik":       "Nashik",
    "pune":         "Pune",
    "nagpur":       "Nagpur",
    "aurangabad":   "Aurangabad",
    "ludhiana":     "Ludhiana",
    "amritsar":     "Amritsar",
    "indore":       "Indore",
    "bhopal":       "Bhopal",
    "jabalpur":     "Jabalpur",
    "jaipur":       "Jaipur",
    "jodhpur":      "Jodhpur",
    "hyderabad":    "Hyderabad",
    "warangal":     "Warangal",
    "bangalore":    "Bangalore",
    "davangere":    "Davangere",
    "ahmedabad":    "Ahmedabad",
    "junagadh":     "Junagadh",
    "kanpur":       "Kanpur",
    "lucknow":      "Lucknow",
    "patna":        "Patna",
}


# ── Module-level cache ────────────────────────────────────────────────────────

_planting_cache: list[dict] | None = None


def _load_planting_data() -> list[dict]:
    """Load (and memoize) the district planting data JSON."""
    global _planting_cache
    if _planting_cache is None:
        with _PLANTING_DATA_FILE.open(encoding="utf-8") as fh:
            _planting_cache = json.load(fh)
    return _planting_cache


# ── Public API ────────────────────────────────────────────────────────────────

def get_district(location: str) -> str:
    """Resolve a location string to a district name."""
    city = location.split(",")[0].strip().lower()
    return _CITY_TO_DISTRICT.get(city, city.title())


def check_diversification(
    crop_ids: list[str],
    location: str,
) -> dict[str, dict]:
    """Check each crop for market-crash risk given district peer planting data.

    Args:
        crop_ids: List of crop IDs to assess.
        location: Farmer's city/district location string.

    Returns:
        Dict mapping crop_id → {"market_crash_risk": bool, "peer_pct": float}
        peer_pct is the fraction of district farmers planting that crop.
    """
    district = get_district(location)
    records  = _load_planting_data()

    # Build lookup: crop_id → pct_farmers_planting for the district
    peer_pcts: dict[str, float] = {}
    for row in records:
        if row.get("district", "").lower() == district.lower():
            cid = row.get("crop_id", "")
            peer_pcts[cid] = float(row.get("pct_farmers_planting", 0.0))

    result: dict[str, dict] = {}
    for crop_id in crop_ids:
        pct = peer_pcts.get(crop_id, 0.0)
        crash_risk = pct > CRASH_THRESHOLD
        if crash_risk:
            logger.warning(
                "Market-crash risk for '%s' in %s: %.0f%% of peers planting.",
                crop_id, district, pct * 100,
            )
        result[crop_id] = {
            "market_crash_risk": crash_risk,
            "peer_pct":          round(pct, 4),
            "price_depression_factor": PRICE_DEPRESSION_FACTOR if crash_risk else 1.0,
        }

    return result
