from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ...runtime import AppContext
from ..dependencies import current_user, get_context
from ..helpers import require_conversation, require_document, sse
from ..schemas import FeedbackRequest, MessageRequest

router = APIRouter(tags=["messages"])


@router.get("/api/conversations/{conversation_id}/messages")
def list_messages(
    conversation_id: str,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> list[dict[str, Any]]:
    require_conversation(context, conversation_id, user["id"])
    return context.database.list_messages(conversation_id, user["id"])


@router.post("/api/conversations/{conversation_id}/messages/stream")
async def stream_message(
    conversation_id: str,
    payload: MessageRequest,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> StreamingResponse:
    conversation = require_conversation(context, conversation_id, user["id"])
    document = require_document(context, conversation["document_id"], user["id"])
    if document["status"] != "ready":
        raise HTTPException(status_code=409, detail="Document is not ready for chat")
    selected_model = payload.model or context.openai.chat_model
    if selected_model not in context.openai.allowed_chat_models:
        raise HTTPException(status_code=422, detail="Selected chat model is unavailable")
    question = payload.content.strip()
    history_limit = int(context.config.section("chat").get("recent_messages", 10))
    history = context.database.list_messages(conversation_id, user["id"], history_limit)
    user_message = context.database.add_message(conversation_id, "user", question)
    if conversation["title"] == "New conversation":
        context.database.update_conversation_title(conversation_id, user["id"], question[:80])
    chunks = context.database.get_chunks(document["id"], user["id"])
    result = await asyncio.to_thread(
        context.rag.answer,
        document_id=document["id"],
        user_id=user["id"],
        question=question,
        chunks=chunks,
        history=history,
        model=selected_model,
    )
    assistant_message = context.database.add_message(
        conversation_id,
        "assistant",
        result.text,
        citations=result.citations,
        model=result.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
    context.logger.info(
        "chat_answer_created",
        extra={
            "user_id": user["id"],
            "document_id": document["id"],
            "conversation_id": conversation_id,
        },
    )

    async def events():
        yield sse(
            "message",
            {"user_message_id": user_message["id"], "assistant_message_id": assistant_message["id"]},
        )
        stream_size = int(context.config.section("chat").get("stream_chunk_characters", 28))
        for start in range(0, len(result.text), stream_size):
            yield sse("token", {"text": result.text[start : start + stream_size]})
            await asyncio.sleep(0.015)
        yield sse("citations", result.citations)
        yield sse(
            "metadata",
            {
                "model": result.model,
                "input_tokens": result.input_tokens,
                "output_tokens": result.output_tokens,
                "warning": result.warning,
            },
        )
        yield sse("done", {"message_id": assistant_message["id"]})

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.post("/api/messages/{message_id}/feedback")
def submit_feedback(
    message_id: str,
    payload: FeedbackRequest,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    if payload.rating not in {-1, 1}:
        raise HTTPException(status_code=422, detail="Rating must be 1 or -1")
    result = context.database.add_feedback(message_id, user["id"], payload.rating, payload.reason)
    if not result:
        raise HTTPException(status_code=404, detail="Assistant message not found")
    return result
