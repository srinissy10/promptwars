from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response

from ...runtime import AppContext
from ..dependencies import current_user, get_context
from ..helpers import require_conversation, require_document
from ..schemas import ConversationRequest

router = APIRouter(tags=["conversations"])


@router.get("/api/documents/{document_id}/conversations")
def list_conversations(
    document_id: str,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> list[dict[str, Any]]:
    require_document(context, document_id, user["id"])
    return context.database.list_conversations(document_id, user["id"])


@router.post("/api/documents/{document_id}/conversations", status_code=201)
def create_conversation(
    document_id: str,
    payload: ConversationRequest,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    require_document(context, document_id, user["id"])
    return context.database.create_conversation(document_id, user["id"], payload.title)


@router.patch("/api/conversations/{conversation_id}")
def rename_conversation(
    conversation_id: str,
    payload: ConversationRequest,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    require_conversation(context, conversation_id, user["id"])
    context.database.update_conversation_title(conversation_id, user["id"], payload.title)
    return require_conversation(context, conversation_id, user["id"])


@router.delete("/api/conversations/{conversation_id}", status_code=204, response_class=Response)
def delete_conversation(
    conversation_id: str,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> Response:
    if not context.database.delete_conversation(conversation_id, user["id"]):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return Response(status_code=204)
