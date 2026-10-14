from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.docchat.infrastructure.database import Database
from backend.docchat.infrastructure.openai_client import OpenAIClient
from backend.docchat.services.documents import chunk_pages, parse_document
from backend.docchat.services.rag import RagService
from tests.helpers import test_config


class UploadToChatIntegrationTests(unittest.TestCase):
    def test_txt_ingestion_retrieval_chat_and_citation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "policy.txt"
            source.write_text(
                "Travel Policy\nThe approval threshold is 5,000 dollars. "
                "Amounts above the threshold require director approval.",
                encoding="utf-8",
            )
            config = test_config(root)
            database = Database(root / "docchat.db")
            database.initialize()
            user = database.create_user("person@example.com", "hash")
            document = database.create_document(
                user_id=user["id"],
                filename=source.name,
                storage_path=str(source),
                extension=".txt",
                mime_type="text/plain",
                size_bytes=source.stat().st_size,
            )
            chunks = chunk_pages(parse_document(source, ".txt"), 40, 8)
            database.replace_chunks(document["id"], user["id"], chunks)
            database.update_document(document["id"], status="ready", page_count=1, chunk_count=len(chunks))
            conversation = database.create_conversation(document["id"], user["id"], "Threshold")
            database.add_message(conversation["id"], "user", "What is the approval threshold?")

            result = RagService(config, OpenAIClient(config)).answer(
                document_id=document["id"],
                user_id=user["id"],
                question="What is the approval threshold?",
                chunks=database.get_chunks(document["id"], user["id"]),
                history=[],
            )
            message = database.add_message(
                conversation["id"], "assistant", result.text, citations=result.citations, model=result.model
            )

            self.assertIn("5,000", result.text)
            self.assertEqual(result.citations[0]["page_number"], 1)
            self.assertIn(result.citations[0]["match_level"], {"Low", "Medium", "High", "Exact"})
            self.assertEqual(message["citations"][0]["document_id"], document["id"])
            self.assertEqual(len(database.list_messages(conversation["id"], user["id"])), 2)
            recent = database.list_messages(conversation["id"], user["id"], limit=1)
            self.assertEqual([item["role"] for item in recent], ["assistant"])


if __name__ == "__main__":
    unittest.main()
