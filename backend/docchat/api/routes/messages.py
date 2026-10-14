from __future__ import annotations

import asyncio
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
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
    request: Request,
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
    chat_settings = context.config.section("chat")
    history_limit = int(chat_settings.get("recent_messages", 10))
    history = context.database.list_messages(conversation_id, user["id"], history_limit)
    chunks = context.database.get_chunks(document["id"], user["id"])

    async def events():
        yield sse("status", {"state": "processing"})
        loop = asyncio.get_running_loop()
        timeout_seconds = max(
            1,
            int(chat_settings.get("request_timeout_seconds", context.openai.chat_timeout_seconds)),
        )
        heartbeat_seconds = max(1.0, float(chat_settings.get("stream_heartbeat_seconds", 15)))
        deadline = loop.time() + timeout_seconds
        answer_task = asyncio.create_task(
            asyncio.to_thread(
                context.rag.answer,
                document_id=document["id"],
                user_id=user["id"],
                question=question,
                chunks=chunks,
                history=history,
                model=selected_model,
            )
        )
        try:
            while not answer_task.done():
                remaining = deadline - loop.time()
                if remaining <= 0:
                    answer_task.cancel()
                    context.logger.warning(
                        "chat_generation_timed_out",
                        extra={
                            "request_id": getattr(request.state, "request_id", None),
                            "user_id": user["id"],
                            "document_id": document["id"],
                            "conversation_id": conversation_id,
                            "timeout_seconds": timeout_seconds,
                        },
                    )
                    yield sse(
                        "error",
                        {"message": "This answer took too long to generate. Please try again."},
                    )
                    return
                completed, _ = await asyncio.wait(
                    {answer_task},
                    timeout=min(heartbeat_seconds, remaining),
                )
                if not completed:
                    yield sse("keepalive", {})

            result = await answer_task
            user_message, assistant_message = context.database.add_chat_exchange(
                conversation_id,
                user["id"],
                question,
                result.text,
                citations=result.citations,
                model=result.model,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
            )
        except asyncio.CancelledError:
            answer_task.cancel()
            raise
        except sqlite3.IntegrityError:
            context.logger.info(
                "chat_exchange_not_saved",
                extra={
                    "request_id": getattr(request.state, "request_id", None),
                    "user_id": user["id"],
                    "document_id": document["id"],
                    "conversation_id": conversation_id,
                    "error_code": "conversation_changed",
                },
            )
            yield sse(
                "error",
                {
                    "message": "This conversation is no longer available. Select an active conversation and try again."
                },
            )
            return
        except Exception as exc:
            context.logger.error(
                "chat_generation_failed",
                extra={
                    "request_id": getattr(request.state, "request_id", None),
                    "user_id": user["id"],
                    "document_id": document["id"],
                    "conversation_id": conversation_id,
                    "error_code": type(exc).__name__,
                },
            )
            yield sse(
                "error",
                {"message": "MINDMATE could not complete this answer. Please try again."},
            )
            return

        context.logger.info(
            "chat_answer_created",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "user_id": user["id"],
                "document_id": document["id"],
                "conversation_id": conversation_id,
            },
        )
        yield sse(
            "message",
            {"user_message_id": user_message["id"], "assistant_message_id": assistant_message["id"]},
        )
        stream_size = max(1, int(chat_settings.get("stream_chunk_characters", 28)))
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
