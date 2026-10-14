from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

from ..runtime import AppContext


def safe_document(document: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in document.items() if key != "storage_path"}


def require_document(context: AppContext, document_id: str, user_id: str) -> dict[str, Any]:
    document = context.database.get_document(document_id, user_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def require_conversation(context: AppContext, conversation_id: str, user_id: str) -> dict[str, Any]:
    conversation = context.database.get_conversation(conversation_id, user_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

