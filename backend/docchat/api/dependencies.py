from __future__ import annotations

from typing import Any

from fastapi import Depends, Header, HTTPException, Request

from ..core.security import decode_token
from ..runtime import AppContext


def get_context(request: Request) -> AppContext:
    return request.app.state.context


def current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    security = context.config.section("security")
    payload = decode_token(authorization.split(" ", 1)[1], str(security["secret_key"]))
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = context.database.get_user(str(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    request.state.user_id = user["id"]
    return user

