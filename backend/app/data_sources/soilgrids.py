"""ISRIC SoilGrids REST API client."""
from __future__ import annotations

import logging
import httpx
import asyncio
from typing import Any

logger = logging.getLogger(__name__)

_SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
_TIMEOUT_S = 20.0

async def _query_isric(lat: float, lon: float) -> tuple[float, float, float, float]:
    """Helper to query ISRIC for a specific coordinate and return (clay, sand, silt, ph)."""
    params = [
        ("lon", str(lon)),
        ("lat", str(lat)),
        ("property", "clay"),
        ("property", "sand"),
        ("property", "silt"),
        ("property", "phh2o"),
        ("depth", "0-5cm"),
        ("value", "mean"),
    ]
    
    async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
        resp = await client.get(_SOILGRIDS_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        
    layers = data.get("properties", {}).get("layers", [])
    result = {}
    for layer in layers:
        name = layer.get("name")
        depths = layer.get("depths", [])
        if depths and depths[0].get("values"):
            mean_val = depths[0]["values"].get("mean")
            if mean_val is not None:
                result[name] = mean_val
                
    clay_pct = result.get("clay", 0) / 10.0
    sand_pct = result.get("sand", 0) / 10.0
    silt_pct = result.get("silt", 0) / 10.0
    ph = result.get("phh2o", 0) / 10.0
    
    return clay_pct, sand_pct, silt_pct, ph


async def fetch_soil_properties(lat: float, lon: float) -> dict[str, Any]:
    """Fetch soil properties, jittering by ~3km if the coordinate hits an urban/water mask."""
    # Jitter offsets (approx 6.6km): North, South, East, West, NE, NW, SE, SW
    d = 0.06
    offsets = [
        (d, 0), (-d, 0), (0, d), (0, -d),
        (d, d), (-d, -d), (d, -d), (-d, d)
    ]
    
    # Try center first
    clay_pct, sand_pct, silt_pct, ph = await _query_isric(lat, lon)
    
    if clay_pct == 0 and sand_pct == 0 and silt_pct == 0 and ph == 0:
        # Center is null (urban/water). Try the 8 neighbors concurrently!
        tasks = [_query_isric(lat + dlat, lon + dlon) for dlat, dlon in offsets]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for res in results:
            if isinstance(res, Exception):
                continue
            c, s, si, p = res
            if not (c == 0 and s == 0 and si == 0 and p == 0):
                clay_pct, sand_pct, silt_pct, ph = c, s, si, p
                logger.info("Coordinate hit urban mask. Found valid soil in jittered neighbor.")
                break
            
    if clay_pct == 0 and sand_pct == 0 and silt_pct == 0 and ph == 0:
        raise ValueError("No soil data available for this coordinate (likely an urban center or water body).")
        
    # Basic classification based on USDA soil triangle simplified to 4 buckets
    soil_type = "loamy"
    if clay_pct >= 40:
        soil_type = "clay"
    elif sand_pct >= 50:
        soil_type = "sandy"
    elif silt_pct >= 40:
        soil_type = "silt"
        
    return {
        "clay_pct": round(clay_pct, 1),
        "sand_pct": round(sand_pct, 1),
        "silt_pct": round(silt_pct, 1),
        "ph": round(ph, 1),
        "detected_type": soil_type
    }
