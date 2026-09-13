"""Agmarknet mandi price client.

Fetches recent modal prices and price variance for target crops in a given
district from the Agmarknet open commodity price API.

Primary endpoint:
    https://api.data.gov.in/resource/... (official Mandi prices via API key)

Fallback:
    backend/app/data_sources/cache/fallback_mandi_prices.json
    Loaded automatically on any HTTP error, timeout, or missing API key.

Output model:
    CropPriceSeries(crop_id, modal_price_quintal, price_variance)

Environment:
    AGMARKNET_API_KEY — optional; fallback used if absent.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

_API_KEY_ENV = "AGMARKNET_API_KEY"
_BASE_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
_TIMEOUT_S = 3.0


_FALLBACK_FILE: Path = Path(__file__).parent / "cache" / "fallback_mandi_prices.json"

# Map location city → state name used by Agmarknet
_CITY_TO_STATE: dict[str, str] = {
    "nashik": "Maharashtra",     "pune": "Maharashtra",
    "nagpur": "Maharashtra",     "aurangabad": "Maharashtra",
    "ludhiana": "Punjab",        "amritsar": "Punjab",
    "indore": "Madhya Pradesh",  "bhopal": "Madhya Pradesh",
    "jabalpur": "Madhya Pradesh","jaipur": "Rajasthan",
    "jodhpur": "Rajasthan",      "hyderabad": "Telangana",
    "warangal": "Telangana",     "bangalore": "Karnataka",
    "davangere": "Karnataka",    "ahmedabad": "Gujarat",
    "junagadh": "Gujarat",       "kanpur": "Uttar Pradesh",
    "lucknow": "Uttar Pradesh",  "patna": "Bihar",
}


# ── Data model ───────────────────────────────────────────────────────────────

@dataclass
class CropPriceSeries:
    crop_id: str
    modal_price_quintal: float
    price_variance: float


# ── Public API ───────────────────────────────────────────────────────────────

def fetch_prices(location: str, crop_ids: list[str] | None = None) -> list[CropPriceSeries]:
    """Fetch mandi prices for *crop_ids* at *location*.

    Falls back to ``fallback_mandi_prices.json`` on any HTTP error or if
    ``AGMARKNET_API_KEY`` is not set.

    Args:
        location: City-level location string, e.g. ``"Nashik, Maharashtra"``.
        crop_ids: Optional list of crop IDs to filter; returns all if None.

    Returns:
        List of :class:`CropPriceSeries` objects.
    """
    api_key = os.getenv(_API_KEY_ENV)
    if api_key is None:
        logger.warning("AGMARKNET_API_KEY not set — using fallback mandi prices.")
        return _load_fallback(crop_ids)

    state = _location_to_state(location)
    try:
        prices = _fetch_live(state, crop_ids)
    except Exception as exc:
        logger.warning("Agmarknet API error (%s) — falling back to cached prices.", exc)
        prices = _load_fallback(crop_ids)

    return prices


# ── Internal helpers ─────────────────────────────────────────────────────────

def _fetch_live(state: str, crop_ids: list[str] | None) -> list[CropPriceSeries]:
    """Call the live data.gov.in API.  Raises on any HTTP error."""
    params: dict = {
        "api-key": os.getenv(_API_KEY_ENV),
        "format": "json",
        "filters[state]": state,
        "limit": 100
    }

    with httpx.Client(timeout=_TIMEOUT_S) as client:
        resp = client.get(_BASE_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        records = data.get("records", [])

    result = []
    # Simplified mapping for demo purposes
    for row in records:
        comm = str(row.get("commodity", "")).lower()
        price = float(row.get("modal_price", 0) or 0)
        if price > 0:
            result.append(
                CropPriceSeries(
                    crop_id=comm.replace(" ", "_"),
                    modal_price_quintal=price,
                    price_variance=200.0, # Placeholder variance
                )
            )
            
    # If the live API returns empty for this state, raise to trigger fallback
    if not result:
        raise ValueError(f"No mandi prices found for state {state}")
        
    return result


def _load_fallback(crop_ids: list[str] | None) -> list[CropPriceSeries]:
    """Load the fallback mandi prices JSON and optionally filter by crop_ids."""
    with _FALLBACK_FILE.open() as fh:
        records: list[dict] = json.load(fh)

    result = [
        CropPriceSeries(
            crop_id=r["crop_id"],
            modal_price_quintal=float(r["modal_price_quintal"]),
            price_variance=float(r["price_variance"]),
        )
        for r in records
    ]

    if crop_ids is not None:
        wanted = set(crop_ids)
        result = [p for p in result if p.crop_id in wanted]

    return result


def _location_to_state(location: str) -> str:
    """Resolve a location string to a state name for Agmarknet filtering."""
    city = location.split(",")[0].strip().lower()
    return _CITY_TO_STATE.get(city, "Maharashtra")
