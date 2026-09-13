import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .agronomy_agent import generate_agronomy_plan
from app.session_store import get_session
from app.data_sources.icar_soil import get_crop

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agronomy", tags=["Agronomy Plan"])


class AgronomyPlanRequest(BaseModel):
    session_id: str
    crop_id: str
    lang: str = "en"


@router.post("/plan")
async def get_agronomy_plan(req: AgronomyPlanRequest) -> dict[str, Any]:
    session = get_session(req.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{req.session_id}' not found.")

    record = get_crop(req.crop_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Crop '{req.crop_id}' not found.")
        
    crop_name = record["name"]

    try:
        plan = generate_agronomy_plan(session, crop_name, req.lang)
        return plan
    except Exception as e:
        logger.exception("Failed to generate agronomy plan.")
        raise HTTPException(status_code=500, detail="Failed to generate agronomy plan. Please try again.")
