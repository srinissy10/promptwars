from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ...core.config import persist_openai_api_key
from ...runtime import AppContext
from ..dependencies import current_user, get_context
from ..schemas import ApiKeyRequest

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def ready(context: AppContext = Depends(get_context)) -> dict[str, Any]:
    with context.database.connect() as connection:
        connection.execute("SELECT 1").fetchone()
    return {
        "status": "ready",
        "database": "ok",
        "openai_configured": context.openai.configured,
        "chat_provider": context.config.section("chat").get("provider"),
    }


@router.get("/api/settings")
def safe_settings(
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    return {
        "app_name": context.config.section("app").get("name"),
        "user": user,
        "provider": context.config.section("chat").get("provider"),
        "openai_configured": context.openai.configured,
        "chat_model": context.openai.chat_model,
        "chat_models": context.openai.chat_models,
        "embedding_model": context.openai.embedding_model,
        "embedding_dimensions": context.openai.embedding_dimensions,
        "max_file_mb": context.config.section("uploads").get("max_file_mb"),
        "allowed_extensions": context.config.section("uploads").get("allowed_extensions"),
    }


def save_api_key(context: AppContext, user_id: str, api_key: str) -> dict[str, bool]:
    try:
        persist_openai_api_key(context.config, api_key)
    except (OSError, ValueError) as exc:
        context.logger.exception("openai_key_save_failed", extra={"user_id": user_id})
        raise HTTPException(status_code=500, detail="Could not save the API key locally") from exc
    context.openai.api_key = api_key
    context.logger.info("openai_key_updated", extra={"user_id": user_id})
    return {"openai_configured": context.openai.configured}


@router.put("/api/settings/openai-key")
def update_openai_key(
    payload: ApiKeyRequest,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, bool]:
    api_key = payload.api_key.strip()
    if len(api_key) < 20:
        raise HTTPException(status_code=422, detail="Enter a valid API key")
    return save_api_key(context, user["id"], api_key)


@router.delete("/api/settings/openai-key")
def clear_openai_key(
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, bool]:
    return save_api_key(context, user["id"], "")
