"""Route handlers for GET /api/market-prices and /api/market-prices/locations

Fetches real market prices from Agmarknet filtered by State and District.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.data_sources.agmarknet import fetch_market_prices, get_available_locations
from app.models.schemas import (
    MarketLocationsResponse,
    MarketPriceLocation,
    MarketPriceRecord,
    MarketPriceResponse,
    MarketPriceTrendPoint,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["market_prices"])


@router.get("/market-prices/locations", response_model=MarketLocationsResponse)
async def get_market_locations() -> MarketLocationsResponse:
    """Return available states and active reporting districts from Agmarknet."""
    try:
        locations = await asyncio.to_thread(get_available_locations)
        return MarketLocationsResponse(locations=locations)
    except Exception as e:
        logger.error(f"Error fetching market locations: {e}")
        raise HTTPException(status_code=500, detail="Unable to load market locations.")


@router.get("/market-prices", response_model=MarketPriceResponse)
async def get_market_prices(
    state: str,
    district: Optional[str] = "All"
) -> MarketPriceResponse:
    """Get real mandi prices and trends for a specific state and district."""
    if not state:
        raise HTTPException(status_code=400, detail="State is a required parameter.")

    selected_district = district or "All"

    try:
        prices, notice, raw_trends = await asyncio.to_thread(
            fetch_market_prices, state, selected_district
        )
    except Exception as e:
        logger.error(f"Error fetching market prices for {state}, {district}: {e}")
        raise HTTPException(status_code=500, detail="Unable to load market prices at this time.")

    records = [
        MarketPriceRecord(
            crop=p.crop,
            market=p.market,
            arrival_date=p.arrival_date,
            min_price=p.min_price,
            max_price=p.max_price,
            modal_price=p.modal_price,
            variety=p.variety,
            grade=p.grade,
            district=p.district,
        )
        for p in prices
    ]

    trend_models: dict[str, list[MarketPriceTrendPoint]] = {}
    for crop_name, points in raw_trends.items():
        trend_models[crop_name] = [
            MarketPriceTrendPoint(
                date=pt["date"],
                price=pt["price"],
                min_price=pt["min_price"],
                max_price=pt["max_price"],
            )
            for pt in points
        ]

    return MarketPriceResponse(
        source="Agmarknet",
        location=MarketPriceLocation(state=state, district=selected_district),
        notice=notice,
        prices=records,
        trends=trend_models,
    )
