"""Authentication endpoints for AgriSaathi.

Handles:
- POST /api/auth/register (Create new user + token)
- POST /api/auth/login (Verify password + return token)
- GET  /api/auth/me (Get current authenticated user info)
- POST /api/auth/logout (Invalidate session token)
- PUT  /api/auth/language (Update user language preference)
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth_deps import get_current_user
from app.models.schemas import (
    AuthResponse,
    LanguageUpdateRequest,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.session_store import (
    create_user,
    create_user_session,
    delete_user_session,
    get_user_by_username,
    update_user_language,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(req: UserRegisterRequest) -> AuthResponse:
    """Register a new user account and return an active auth session token."""
    username = req.username.strip()
    if len(username) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 2 characters long",
        )
    if len(req.password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters long",
        )

    # Check case-insensitively if username exists
    existing = get_user_by_username(username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists. Please choose another or sign in.",
        )

    try:
        user = create_user(
            username=username,
            password=req.password,
            preferred_language=req.preferred_language or "en",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    token = create_user_session(user["id"])
    return AuthResponse(
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            preferred_language=user["preferred_language"],
            created_at=user["created_at"],
        ),
        token=token,
    )


@router.post("/login", response_model=AuthResponse)
def login(req: UserLoginRequest) -> AuthResponse:
    """Authenticate with username & password, returning an active session token."""
    user = get_user_by_username(req.username)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    token = create_user_session(user["id"])
    return AuthResponse(
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            preferred_language=user["preferred_language"],
            created_at=user["created_at"],
        ),
        token=token,
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> UserResponse:
    """Return profile information of the currently authenticated user."""
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        preferred_language=current_user["preferred_language"],
        created_at=current_user["created_at"],
    )


@router.post("/logout")
def logout(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    """Invalidate current session token."""
    token = current_user.get("token")
    if token:
        delete_user_session(token)
    return {"status": "logged_out"}


@router.put("/language")
def set_user_language(
    body: LanguageUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    """Update preferred language for authenticated user."""
    update_user_language(current_user["id"], body.language)
    return {"status": "updated", "preferred_language": body.language}
