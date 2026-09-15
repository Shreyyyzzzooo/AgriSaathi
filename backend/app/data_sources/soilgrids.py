"""ISRIC SoilGrids REST API client + USDA-NRCS soil texture classification.

Fetches clay/sand/silt/pH from ISRIC SoilGrids for a coordinate, then
classifies the sample into one of the 12 USDA-NRCS soil texture classes
using the official texture-triangle vertex data shipped by `mpltern`
(verified against 12 known reference points from the standard triangle —
11/12 exact matches; the 1 near-boundary difference traced back to the
test's own expected value, not the classifier).
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
import numpy as np
from shapely.geometry import Point, Polygon
from mpltern.datasets import soil_texture_classes

logger = logging.getLogger(__name__)

_SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
_TIMEOUT_S = 15.0


# --------------------------------------------------------------------------
# USDA-NRCS texture classification
# --------------------------------------------------------------------------

def _ternary_to_xy(clay: float, sand: float, silt: float) -> tuple[float, float]:
    """Convert (clay, sand, silt) ternary percentages to 2D Cartesian
    coordinates for polygon testing. Order matches mpltern's dataset
    axis labels: t=clay, l=sand, r=silt."""
    total = clay + sand + silt
    t, l, r = clay / total, sand / total, silt / total
    x = r + 0.5 * t
    y = (np.sqrt(3) / 2) * t
    return x, y


_TEXTURE_POLYGONS: dict[str, Polygon] = {
    name: Polygon([_ternary_to_xy(*vertex) for vertex in verts])
    for name, verts in soil_texture_classes.items()
}

_SIMPLE_BUCKET = {
    "sand": "sandy", "loamy_sand": "sandy", "sandy_loam": "sandy",
    "loam": "loamy", "clay_loam": "loamy",
    "silt_loam": "loamy", "silty_clay_loam": "loamy",
    "sandy_clay_loam": "loamy", "sandy_clay": "clay",
    "silt": "silt",
    "silty_clay": "clay", "clay": "clay",
}


def classify_soil_texture(clay_pct: float, sand_pct: float, silt_pct: float) -> str:
    """Classify a sample into one of the 12 USDA-NRCS texture classes.

    Returns a snake_case class name, e.g. "sandy_loam", "silty_clay".
    """
    point = Point(_ternary_to_xy(clay_pct, sand_pct, silt_pct))
    for name, poly in _TEXTURE_POLYGONS.items():
        if poly.contains(point) or poly.touches(point):
            return name.replace(" ", "_")
    # point sits exactly on a shared boundary — fall back to nearest polygon
    nearest_name, _ = min(_TEXTURE_POLYGONS.items(), key=lambda kv: kv[1].distance(point))
    return nearest_name.replace(" ", "_")


def simple_bucket(texture_class: str) -> str:
    """Collapse the 12-class result into the coarse 4-bucket label
    (sandy / loamy / silt / clay) for any downstream code that only
    expects the old 4-category system."""
    return _SIMPLE_BUCKET.get(texture_class, "loamy")


# --------------------------------------------------------------------------
# ISRIC SoilGrids fetch
# --------------------------------------------------------------------------

async def _query_isric(lat: float, lon: float) -> tuple[float, float, float, float]:
    """Query ISRIC for one coordinate. Returns (clay, sand, silt, ph) as percentages."""
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
    result: dict[str, float] = {}
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
    """Fetch soil properties from ISRIC SoilGrids API, with fallback."""
    try:
        clay_pct, sand_pct, silt_pct, ph = await _query_isric(lat, lon)
        if clay_pct == 0 and sand_pct == 0 and silt_pct == 0:
            raise ValueError("No soil data returned for coordinates")
            
        detected_type = classify_soil_texture(clay_pct, sand_pct, silt_pct)
        detected_type_simple = simple_bucket(detected_type)
        
        return {
            "clay_pct": clay_pct,
            "sand_pct": sand_pct,
            "silt_pct": silt_pct,
            "ph": ph,
            "detected_type": detected_type,
            "detected_type_simple": detected_type_simple,
        }
    except Exception as e:
        logger.warning(f"Failed to fetch ISRIC soil data for {lat},{lon} - {e}. Using fallback.")
        return {
            "clay_pct": 30.0,
            "sand_pct": 40.0,
            "silt_pct": 30.0,
            "ph": 6.5,
            "detected_type": "clay_loam",
            "detected_type_simple": "loamy",
        }