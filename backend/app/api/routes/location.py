from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from app.data_sources.nasa_power import get_latlon
from app.data_sources.soilgrids import fetch_soil_properties

router = APIRouter(prefix="/api", tags=["location"])

class LocationInfoResponse(BaseModel):
    lat: float
    lon: float
    clay_pct: float
    sand_pct: float
    silt_pct: float
    ph: float
    detected_type: str
    detected_type_simple: str = "loamy"

@router.get("/location-info", response_model=LocationInfoResponse)
async def get_location_info(q: str):
    """Resolve location to lat/lon and fetch soil properties."""
    try:
        lat, lon = await get_latlon(q)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Location '{q}' not found.")
        
    try:
        soil = await fetch_soil_properties(lat, lon)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="ISRIC SoilGrids API timed out.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ISRIC SoilGrids API error: {str(e)}")
    
    return LocationInfoResponse(
        lat=lat,
        lon=lon,
        clay_pct=soil["clay_pct"],
        sand_pct=soil["sand_pct"],
        silt_pct=soil["silt_pct"],
        ph=soil["ph"],
        detected_type=soil["detected_type"],
        detected_type_simple=soil.get("detected_type_simple", "loamy")
    )
