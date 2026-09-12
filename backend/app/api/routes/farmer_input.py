"""Route handlers for POST /api/farmer.

Ingests farmer profile data, persists it as a named session in the SQLite
session store, and returns a UUID session_id for use in subsequent requests.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.models.schemas import FarmerRequest, FarmerResponse
from app.session_store import save_session

router = APIRouter(prefix="/api", tags=["farmer"])


@router.post("/farmer", response_model=FarmerResponse, status_code=200)
def create_farmer(body: FarmerRequest) -> FarmerResponse:
    """Register a new farmer session.

    Stores the full farmer profile keyed by a freshly-minted UUID.
    Returns the session_id for all subsequent API calls.

    Args:
        body: Farmer plot parameters (location, soil, water, budget, plot size).

    Returns:
        FarmerResponse with session_id (UUID v4) and status "created".
    """
    session_id = str(uuid.uuid4())
    save_session(session_id, body.model_dump())
    return FarmerResponse(session_id=session_id, status="created")
