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
        # BYPASS GEOCODING TEMPORARILY
        # lat, lon = await get_latlon(q)
        lat, lon = 25.18, 75.83 # Default coordinate (Kota, India)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Location '{q}' not found.")
        
    try:
        # BYPASS ISRIC SOILGRIDS API TEMPORARILY:
        # To restore the real API, uncomment the line below and delete the mock dictionary.
        # soil = await fetch_soil_properties(lat, lon)
        soil = {
           "clay_pct": 30.0,
           "sand_pct": 40.0,
           "silt_pct": 30.0,
           "ph": 6.5,
           "detected_type": "loamy"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except httpx.TimeoutException:
        # Fallback if ISRIC is slow or rate-limiting
        soil = {
            "clay_pct": 30.0,
            "sand_pct": 40.0,
            "silt_pct": 30.0,
            "ph": 6.5,
            "detected_type": "loamy"
        }
    except Exception as e:
        # Generic fallback for any other ISRIC API error
        soil = {
            "clay_pct": 30.0,
            "sand_pct": 40.0,
            "silt_pct": 30.0,
            "ph": 6.5,
            "detected_type": "loamy"
        }
    
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
