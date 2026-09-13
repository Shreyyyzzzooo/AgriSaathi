"""Authentication dependencies for FastAPI routes."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import Depends, Header, HTTPException, status

from app.session_store import get_user_by_token


def get_token_from_header(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Extract Bearer token from the Authorization header."""
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def get_current_user(
    token: Optional[str] = Depends(get_token_from_header),
) -> Dict[str, Any]:
    """Require valid Bearer token, return authenticated user dict.
    
    Raises 401 Unauthorized if token is missing or invalid.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Attach active token to user dict for convenience
    user["token"] = token
    return user


def get_optional_user(
    token: Optional[str] = Depends(get_token_from_header),
) -> Optional[Dict[str, Any]]:
    """Return authenticated user dict if valid Bearer token present, else None."""
    if not token:
        return None
    user = get_user_by_token(token)
    if user:
        user["token"] = token
    return user
