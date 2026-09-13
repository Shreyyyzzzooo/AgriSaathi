"""Route handlers for POST /api/simulate.

Concurrently fetches NASA POWER weather and Agmarknet prices using
asyncio.gather, then invokes the Monte Carlo engine for each selected crop.

Returns a SimulateResponse whose results[] entries match the CropResult /
CropStats schema in docs/api_contract.md, plus a weather_by_day[] array
formatted for the 3D PlotScene twin.

weather_by_day shape (per api_contract.md):
    [{day, rainfall_mm, temp_c, condition}]
    condition: "sunny" | "rainy" | "cloudy" | "stormy"
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from app.data_sources.agmarknet import CropPriceSeries, fetch_prices
from app.data_sources.icar_soil import get_crop
from app.data_sources.nasa_power import DailyWeather, fetch_weather, get_latlon
from app.models.schemas import (
    CropResult,
    CropStats,
    SimulateRequest,
    SimulateResponse,
    WeatherDay,
)
from app.session_store import get_session
from app.simulation.diversification import check_diversification
from app.simulation.monte_carlo import CropBenchmark, FarmerInput, simulate_crops

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["simulation"])


# ── Condition derivation thresholds ──────────────────────────────────────────

def _derive_condition(rainfall_mm: float, temp_avg_c: float) -> str:
    """Map raw weather values to the api_contract condition enum."""
    if rainfall_mm > 10.0:
        return "rainy"
    if temp_avg_c > 38.0:
        return "stormy"
    if rainfall_mm > 0.0:
        return "cloudy"
    return "sunny"


def _to_weather_day(dw: DailyWeather) -> WeatherDay:
    """Convert a DailyWeather dataclass to a WeatherDay Pydantic model."""
    return WeatherDay(
        day=dw.day_index,
        rainfall_mm=round(dw.rainfall_mm, 2),
        temp_c=round(dw.temp_avg_c, 2),
        condition=_derive_condition(dw.rainfall_mm, dw.temp_avg_c),
    )


# ── Async price fetch wrapper ─────────────────────────────────────────────────

async def _fetch_prices_async(location: str, crop_ids: list[str]) -> list[CropPriceSeries]:
    """Run the synchronous fetch_prices in a thread pool to avoid blocking."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, lambda: fetch_prices(location, crop_ids)
    )


# ── Route handler ────────────────────────────────────────────────────────────

@router.post("/simulate", response_model=SimulateResponse)
async def run_simulation(body: SimulateRequest) -> SimulateResponse:
    """Run Monte Carlo yield simulations for selected crops.

    Workflow:
        1. Validate session and retrieve farmer profile.
        2. Concurrently fetch NASA POWER weather + Agmarknet prices.
        3. Check diversification risk for each selected crop.
        4. Build CropBenchmark objects (ICAR + price + crash flag).
        5. Run vectorized simulate_crops().
        6. Assemble SimulateResponse with CropStats + weather_by_day.

    Args:
        body: SimulateRequest with session_id, selected_crops[], monte_carlo_runs.

    Returns:
        SimulateResponse with one CropResult per selected crop.

    Raises:
        404 if session_id is not found.
        422 if any selected crop_id is not in the ICAR reference cache.
    """
    # ── 1. Load farmer session ────────────────────────────────────────────────
    session = get_session(body.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{body.session_id}' not found.")

    location           = session["location"]
    soil_type          = session["soil_type"]
    water_availability = session["water_availability"]
    budget_inr         = session["budget_inr"]
    plot_size_ha       = session["plot_size_ha"]

    # ── 2. Resolve lat/lon for weather fetch ──────────────────────────────────
    try:
        lat, lon = await get_latlon(location)
    except KeyError:
        # Unknown city — use a central-India fallback
        lat, lon = 21.15, 79.09
        logger.warning("Unknown city '%s' — using Nagpur lat/lon as fallback.", location)

    # ── 3. Determine max duration across selected crops ───────────────────────
    icar_records: dict[str, dict[str, Any]] = {}
    for crop_id in body.selected_crops:
        record = get_crop(crop_id)
        if record is None:
            raise HTTPException(
                status_code=422,
                detail=f"Crop '{crop_id}' not found in ICAR reference cache.",
            )
        icar_records[crop_id] = record

    max_duration = max(r["duration_days"] for r in icar_records.values())

    # ── 4. Concurrently fetch weather + prices ────────────────────────────────
    weather_list, prices_list = await asyncio.gather(
        fetch_weather(lat, lon, duration_days=max_duration),
        _fetch_prices_async(location, body.selected_crops),
    )

    # Build price lookup dict
    price_map: dict[str, CropPriceSeries] = {p.crop_id: p for p in prices_list}

    # ── 5. Check diversification / crash risk ─────────────────────────────────
    crash_flags = check_diversification(body.selected_crops, location)

    # ── 6. Build CropBenchmark list ───────────────────────────────────────────
    farmer = FarmerInput(
        location=location,
        plot_size_ha=float(plot_size_ha),
        soil_type=soil_type,
        water_availability=water_availability,
        budget_inr=int(budget_inr),
    )

    benchmarks: list[CropBenchmark] = []
    for crop_id in body.selected_crops:
        rec   = icar_records[crop_id]
        price = price_map.get(crop_id)
        modal  = price.modal_price_quintal if price else rec.get("yield_mean_qtl_ha", 2000.0) * 60
        var    = price.price_variance if price else (modal * 0.05) ** 2

        benchmarks.append(CropBenchmark(
            crop_id=crop_id,
            name=rec["name"],
            season=rec["season"],
            duration_days=rec["duration_days"],
            yield_mean_qtl_ha=float(rec["yield_mean_qtl_ha"]),
            yield_std_qtl_ha=float(rec["yield_std_qtl_ha"]),
            cost_inr_ha=int(rec["cost_inr_ha"]),
            modal_price_inr_per_qtl=float(modal),
            price_variance=float(var),
            market_crash_risk=crash_flags.get(crop_id, {}).get("market_crash_risk", False),
        ))

    # ── 7. Run Monte Carlo engine ─────────────────────────────────────────────
    n_runs = body.monte_carlo_runs if body.monte_carlo_runs is not None else 200
    sim_results = simulate_crops(
        farmer_input=farmer,
        candidate_crops=benchmarks,
        weather_forecast=weather_list,
        num_simulations=n_runs,
    )

    # ── 8. Build API response ─────────────────────────────────────────────────
    crop_results: list[CropResult] = []
    for crop_id in body.selected_crops:
        rec = icar_records[crop_id]
        sim = sim_results[crop_id]

        # weather_by_day trimmed to this crop's duration_days
        duration     = rec["duration_days"]
        weather_slice = weather_list[:duration]
        weather_by_day = [_to_weather_day(d) for d in weather_slice]

        stats = CropStats(
            mean=sim.stats["mean"],
            p10=sim.stats["p10"],
            p50=sim.stats["p50"],
            p90=sim.stats["p90"],
            histogram_bins=sim.stats["histogram_bins"],
            histogram_counts=sim.stats["histogram_counts"],
        )

        crop_results.append(CropResult(
            crop_id=crop_id,
            stats=stats,
            weather_by_day=weather_by_day,
        ))

    return SimulateResponse(results=crop_results)
