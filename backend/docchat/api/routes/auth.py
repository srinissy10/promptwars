from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ...core.security import create_token, hash_password, verify_password
from ...runtime import AppContext
from ..dependencies import get_context
from ..schemas import AuthRequest

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/register", status_code=201)
def register(payload: AuthRequest, context: AppContext = Depends(get_context)) -> dict[str, Any]:
    if "@" not in payload.email:
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    if context.database.get_user_by_email(payload.email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    security = context.config.section("security")
    user = context.database.create_user(
        payload.email,
        hash_password(payload.password, int(security.get("password_iterations", 210000))),
    )
    token = create_token(
        user["id"],
        str(security["secret_key"]),
        int(security.get("token_ttl_minutes", 1440)),
    )
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/login")
def login(payload: AuthRequest, context: AppContext = Depends(get_context)) -> dict[str, Any]:
    user = context.database.get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    security = context.config.section("security")
    token = create_token(
        user["id"],
        str(security["secret_key"]),
        int(security.get("token_ttl_minutes", 1440)),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"], "created_at": user["created_at"]},
    }
