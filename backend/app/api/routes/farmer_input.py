"""Route handlers for /api/farmer.

Ingests farmer profile data, persists it as a named session in the SQLite
session store, and links the profile to the authenticated user's persistent record.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Request

from app.api.auth_deps import get_current_user, get_optional_user
from app.models.schemas import FarmerProfileResponse, FarmerRequest, FarmerResponse
from app.session_store import get_farmer_profile, save_session, upsert_farmer_profile

router = APIRouter(prefix="/api", tags=["farmer"])


@router.post("/farmer", response_model=FarmerResponse, status_code=200)
def create_farmer(
    body: FarmerRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
) -> FarmerResponse:
    """Register or update farmer plot details.

    1. Creates a legacy session_id for simulation/downstream APIs.
    2. If the user is authenticated, persists/upserts their farmer profile in SQLite.
    """
    session_id = str(uuid.uuid4())
    data = body.model_dump(exclude_none=True)
    save_session(session_id, data)

    saved_profile = None
    if current_user:
        saved_profile = upsert_farmer_profile(current_user["id"], data)

    return FarmerResponse(
        session_id=session_id,
        status="created",
        profile=saved_profile,
    )


@router.get("/farmer/profile", response_model=FarmerProfileResponse)
def get_current_farmer_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> FarmerProfileResponse:
    """Fetch the persistent farm profile for the currently authenticated user."""
    profile = get_farmer_profile(current_user["id"])
    if not profile:
        return FarmerProfileResponse(profile=None, message="No saved profile found")
    return FarmerProfileResponse(profile=profile, message="Profile retrieved successfully")


@router.put("/farmer/profile", response_model=FarmerProfileResponse)
def update_current_farmer_profile(
    body: FarmerRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> FarmerProfileResponse:
    """Upsert farm parameters directly for the authenticated user."""
    data = body.model_dump(exclude_none=True)
    profile = upsert_farmer_profile(current_user["id"], data)
    return FarmerProfileResponse(profile=profile, message="Profile saved successfully")
