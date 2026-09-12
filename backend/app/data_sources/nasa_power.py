"""NASA POWER Agroclimatology daily weather client.

Fetches PRECTOTCORR (rainfall), T2M_MAX, T2M_MIN, and ALLSKY_SFC_SW_DWN
(solar irradiance) for a given (latitude, longitude) pair over a 120-day
sowing window.

API endpoint:
    https://power.larc.nasa.gov/api/temporal/daily/point

Parameters requested:
    PRECTOTCORR     — Precipitation corrected (mm/day)
    T2M_MAX         — Maximum temperature at 2 m (°C)
    T2M_MIN         — Minimum temperature at 2 m (°C)
    ALLSKY_SFC_SW_DWN — All-sky surface shortwave downward irradiance (MJ/m²/day)

Retry / timeout:
    3 attempts with exponential back-off (1 s, 2 s, 4 s).
    Each attempt has a 3-second connect+read timeout.
    On final failure the fallback file is loaded transparently.

Fallback:
    backend/app/data_sources/cache/fallback_weather.json
    Contains realistic kharif-season records for central India.

Output model:
    DailyWeather(day_index, rainfall_mm, temp_avg_c, heat_stress, solar_mj_m2)
    heat_stress is True when temp_avg_c > 35 °C.
"""

from __future__ import annotations

import json
import logging
import asyncio
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import os
import httpx

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

_NASA_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
_PARAMETERS = "PRECTOTCORR,T2M_MAX,T2M_MIN,ALLSKY_SFC_SW_DWN"
_TIMEOUT_S = 3.0
_MAX_RETRIES = 3
_SOWING_WINDOW_DAYS = 120
_HEAT_STRESS_THRESHOLD_C = 35.0

_FALLBACK_FILE: Path = Path(__file__).parent / "cache" / "fallback_weather.json"


# ── Data model ───────────────────────────────────────────────────────────────

@dataclass
class DailyWeather:
    day_index: int
    rainfall_mm: float
    temp_avg_c: float
    heat_stress: bool
    solar_mj_m2: float


# ── Public API ───────────────────────────────────────────────────────────────

async def fetch_weather(
    lat: float,
    lon: float,
    duration_days: int = _SOWING_WINDOW_DAYS,
    start_date: date | None = None,
) -> list[DailyWeather]:
    """Fetch daily weather for *duration_days* starting from *start_date*.

    Falls back to ``fallback_weather.json`` if the network is unavailable or
    times out.

    Args:
        lat: Latitude in decimal degrees.
        lon: Longitude in decimal degrees.
        duration_days: Number of days to fetch (default 120).
        start_date: First day of the window; defaults to today.

    Returns:
        List of :class:`DailyWeather` with length == *duration_days*.
    """
    if start_date is None:
        # NASA POWER is a historical API, so querying the future (or current day) 
        # returns incomplete or no data. We fetch from exactly 1 year ago.
        start_date = date.today() - timedelta(days=365)
    end_date = start_date + timedelta(days=duration_days - 1)

    params = {
        "parameters": _PARAMETERS,
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": start_date.strftime("%Y%m%d"),
        "end": end_date.strftime("%Y%m%d"),
        "format": "JSON",
    }

    raw: dict[str, Any] | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
                resp = await client.get(_NASA_URL, params=params)
                resp.raise_for_status()
                raw = resp.json()
            break
        except Exception as exc:
            wait = 2 ** attempt
            logger.warning(
                "NASA POWER attempt %d/%d failed (%s). Retrying in %ds.",
                attempt + 1, _MAX_RETRIES, exc, wait,
            )
            if attempt < _MAX_RETRIES - 1:
                await asyncio.sleep(wait)

    if raw is None:
        logger.warning("NASA POWER unavailable — loading fallback weather data.")
        return _load_fallback(duration_days)

    return _parse_nasa_response(raw, duration_days)


async def get_latlon(location: str) -> tuple[float, float]:
    """Resolve a location string to (lat, lon) via Open-Meteo Geocoding API.
    Raises KeyError if the location cannot be found or API fails.
    """
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {
        "name": location,
        "count": 1,
        "language": "en",
        "format": "json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            
            if data and data.get("results") and len(data["results"]) > 0:
                result = data["results"][0]
                return float(result["latitude"]), float(result["longitude"])
            else:
                logger.warning("Geocoding failed for %s: No results from Open-Meteo", location)
                raise KeyError(f"Could not resolve location '{location}'")
    except Exception as exc:
        logger.error("Error during geocoding: %s", exc)
        raise KeyError(f"Error resolving location '{location}'")


# ── Internal helpers ─────────────────────────────────────────────────────────

def _parse_nasa_response(raw: dict[str, Any], duration_days: int) -> list[DailyWeather]:
    """Extract DailyWeather records from a NASA POWER JSON response."""
    props = raw.get("properties", {}).get("parameter", {})
    precip = props.get("PRECTOTCORR", {})
    t_max  = props.get("T2M_MAX", {})
    t_min  = props.get("T2M_MIN", {})
    solar  = props.get("ALLSKY_SFC_SW_DWN", {})

    days: list[DailyWeather] = []
    for i, key in enumerate(sorted(precip.keys())[:duration_days], start=1):
        rain  = float(precip.get(key, 0.0))
        tmax  = float(t_max.get(key, 30.0))
        tmin  = float(t_min.get(key, 20.0))
        sol   = float(solar.get(key, 15.0))
        tavg  = (tmax + tmin) / 2.0
        days.append(DailyWeather(
            day_index=i,
            rainfall_mm=max(0.0, rain),
            temp_avg_c=round(tavg, 2),
            heat_stress=tavg > _HEAT_STRESS_THRESHOLD_C,
            solar_mj_m2=round(sol, 2),
        ))
    return days


def _load_fallback(duration_days: int) -> list[DailyWeather]:
    """Load fallback weather records, cycling if duration > available records."""
    with _FALLBACK_FILE.open() as fh:
        records: list[dict] = json.load(fh)

    result: list[DailyWeather] = []
    n = len(records)
    for i in range(duration_days):
        r = records[i % n]
        tmax = r.get("temp_max_c", 32.0)
        tmin = r.get("temp_min_c", 22.0)
        tavg = (tmax + tmin) / 2.0
        result.append(DailyWeather(
            day_index=i + 1,
            rainfall_mm=float(r.get("rainfall_mm", 0.0)),
            temp_avg_c=round(tavg, 2),
            heat_stress=tavg > _HEAT_STRESS_THRESHOLD_C,
            solar_mj_m2=float(r.get("solar_mj_m2", 15.0)),
        ))
    return result
