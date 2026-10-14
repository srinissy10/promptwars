from __future__ import annotations

import asyncio
import logging
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException
from starlette.requests import Request

from backend.docchat.api.routes.messages import stream_message
from backend.docchat.api.schemas import MessageRequest
from backend.docchat.infrastructure.database import Database
from backend.docchat.services.rag import AnswerResult
from tests.helpers import test_config


class BlockingRag:
    def __init__(self, *, started: threading.Event | None = None, release: threading.Event | None = None):
        self.started = started
        self.release = release

    def answer(self, **_: object) -> AnswerResult:
        if self.started:
            self.started.set()
        if self.release:
            self.release.wait(timeout=5)
        return AnswerResult("Grounded answer.", [], "test-model")


class ChatStreamTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.temp_directory = tempfile.TemporaryDirectory()
        root = Path(self.temp_directory.name)
        self.database = Database(root / "chat.db")
        self.database.initialize()
        self.user = self.database.create_user("person@example.com", "hash")
        self.document = self.database.create_document(
            user_id=self.user["id"],
            filename="policy.txt",
            storage_path=str(root / "policy.txt"),
            extension=".txt",
            mime_type="text/plain",
            size_bytes=10,
        )
        self.database.update_document(self.document["id"], status="ready")
        self.conversation = self.database.create_conversation(
            self.document["id"], self.user["id"], "New conversation"
        )
        self.config = test_config(root)
        self.logger = logging.getLogger(f"chat-stream-test-{id(self)}")
        self.context = SimpleNamespace(
            config=self.config,
            logger=self.logger,
            database=self.database,
            openai=SimpleNamespace(
                chat_model="gpt-5.6-terra",
                allowed_chat_models={"gpt-5.6-terra"},
                chat_timeout_seconds=5,
            ),
            rag=BlockingRag(),
        )

    def tearDown(self) -> None:
        self.temp_directory.cleanup()

    async def _response(self):
        request = Request(
            {
                "type": "http",
                "asgi": {"version": "3.0"},
                "http_version": "1.1",
                "method": "POST",
                "scheme": "http",
                "path": f"/api/conversations/{self.conversation['id']}/messages/stream",
                "raw_path": b"/messages/stream",
                "query_string": b"",
                "headers": [],
                "client": ("test", 1),
                "server": ("test", 80),
            }
        )
        return await stream_message(
            self.conversation["id"],
            MessageRequest(content="What does the policy say?", model="gpt-5.6-terra"),
            request,
            self.user,
            self.context,
        )

    async def test_deleted_conversation_during_generation_returns_stream_error_not_conflict(self):
        started = threading.Event()
        release = threading.Event()
        self.context.rag = BlockingRag(started=started, release=release)
        response = await self._response()
        iterator = response.body_iterator
        first = await anext(iterator)
        self.assertIn("event: status", first)
        next_block = asyncio.create_task(anext(iterator))

        self.assertTrue(await asyncio.to_thread(started.wait, 3), "RAG generation did not start")
        deleted = await asyncio.to_thread(
            self.database.delete_conversation,
            self.conversation["id"],
            self.user["id"],
        )
        self.assertTrue(deleted)
        release.set()
        error_block = await next_block
        self.assertEqual(response.status_code, 200)
        self.assertIn("event: error", error_block)
        self.assertIn("conversation is no longer available", error_block)

    async def test_successful_stream_persists_user_and_assistant_messages_together(self):
        response = await self._response()
        body = "".join([block async for block in response.body_iterator])

        self.assertEqual(response.status_code, 200)
        self.assertIn("event: done", body)
        messages = self.database.list_messages(self.conversation["id"], self.user["id"])
        self.assertEqual([message["role"] for message in messages], ["user", "assistant"])
        self.assertEqual(messages[-1]["content"], "Grounded answer.")

    async def test_generation_timeout_is_reported_as_a_stream_error(self):
        started = threading.Event()
        release = threading.Event()
        self.context.rag = BlockingRag(started=started, release=release)
        self.config.values["chat"]["request_timeout_seconds"] = 1
        response = await self._response()
        iterator = response.body_iterator
        await anext(iterator)
        next_block = asyncio.create_task(anext(iterator))

        self.assertTrue(await asyncio.to_thread(started.wait, 3), "RAG generation did not start")
        error_block = await next_block
        while "event: error" not in error_block:
            next_block = asyncio.create_task(anext(iterator))
            error_block = await next_block
        release.set()

        self.assertIn("event: error", error_block)
        self.assertIn("took too long to generate", error_block)
        self.assertEqual(self.database.list_messages(self.conversation["id"], self.user["id"]), [])

    async def test_document_not_ready_still_returns_http_conflict(self):
        self.database.update_document(self.document["id"], status="processing")

        with self.assertRaises(HTTPException) as caught:
            await self._response()

        self.assertEqual(caught.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
