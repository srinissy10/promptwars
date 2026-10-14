from __future__ import annotations

import io
import json
import logging
import tempfile
import urllib.error
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.docchat.core.logging import JsonFormatter
from backend.docchat.infrastructure.openai_client import OpenAIClient, OpenAIError
from backend.docchat.services.rag import RagService
from tests.helpers import test_config


class OpenAIBatchingTests(unittest.TestCase):
    def test_embeddings_are_packed_by_estimated_token_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            config = test_config(Path(directory))
            config.values["openai"]["api_key"] = "test-key"
            config.values["openai"]["embedding_dimensions"] = 2
            config.values["openai"]["embedding_batch_size"] = 10
            config.values["openai"]["embedding_max_batch_tokens"] = 60
            client = OpenAIClient(config)
            observed_batch_sizes: list[int] = []

            def fake_post(endpoint, payload):
                self.assertEqual(endpoint, "embeddings")
                observed_batch_sizes.append(len(payload["input"]))
                return {
                    "data": [
                        {"index": index, "embedding": [float(index), 1.0]}
                        for index, _ in enumerate(payload["input"])
                    ]
                }

            client._post = fake_post  # type: ignore[method-assign]
            texts = ["x" * 120, "y" * 120, "z" * 120, "q" * 120]
            vectors = client.embed(texts)

            self.assertEqual(observed_batch_sizes, [2, 2])
            self.assertEqual(len(vectors), 4)

    def test_single_oversized_chunk_is_rejected_before_network_call(self):
        with tempfile.TemporaryDirectory() as directory:
            config = test_config(Path(directory))
            config.values["openai"]["api_key"] = "test-key"
            config.values["openai"]["embedding_max_input_tokens"] = 10
            client = OpenAIClient(config)
            with self.assertRaises(OpenAIError):
                client.embed(["x" * 100])

    def test_answer_uses_the_selected_chat_model(self):
        with tempfile.TemporaryDirectory() as directory:
            config = test_config(Path(directory))
            config.values["openai"]["api_key"] = "test-key"
            client = OpenAIClient(config)
            observed_model: list[str] = []

            def fake_post(endpoint, payload):
                self.assertEqual(endpoint, "responses")
                observed_model.append(payload["model"])
                return {"output_text": "Answer", "model": payload["model"], "usage": {}}

            client._post = fake_post  # type: ignore[method-assign]
            result = client.generate_answer(
                system_prompt="Use the context.",
                question="Question?",
                context="Context.",
                history=[],
                user_id="user-1",
                model="gpt-5.6-sol",
            )

            self.assertEqual(observed_model, ["gpt-5.6-sol"])
            self.assertEqual(result.model, "gpt-5.6-sol")

    def test_provider_failures_are_logged_without_raw_error_or_document_text(self):
        with tempfile.TemporaryDirectory() as directory:
            config = test_config(Path(directory))
            config.values["openai"]["api_key"] = "test-secret-key"
            config.values["chat"]["provider"] = "openai"
            client = OpenAIClient(config)
            output = io.StringIO()
            logger = logging.Logger(f"provider-test-{id(self)}")
            handler = logging.StreamHandler(output)
            handler.setFormatter(JsonFormatter())
            logger.addHandler(handler)
            logger.setLevel(logging.WARNING)
            raw_error = {
                "error": {
                    "code": "invalid_api_key",
                    "message": "Private document text test-secret-key",
                }
            }

            def reject_request(*args, **kwargs):
                raise urllib.error.HTTPError(
                    "https://api.example.test/responses",
                    401,
                    "Unauthorized",
                    {},
                    io.BytesIO(json.dumps(raw_error).encode("utf-8")),
                )

            service = RagService(config, client, logger)
            with patch("urllib.request.urlopen", side_effect=reject_request):
                result = service.answer(
                    document_id="document-1",
                    user_id="user-1",
                    question="What does the private policy say?",
                    chunks=[
                        {
                            "id": "chunk-1",
                            "chunk_index": 0,
                            "page_start": 1,
                            "page_end": 1,
                            "section_title": "Policy",
                            "content": "The private policy states that access is restricted.",
                            "embedding": None,
                        }
                    ],
                    history=[],
                )

            log_output = output.getvalue()
            self.assertEqual(result.model, "extractive-fallback")
            self.assertIn("authentication or model access", result.warning or "")
            self.assertIn('"provider_status_code": 401', log_output)
            self.assertIn('"provider_error_code": "invalid_api_key"', log_output)
            self.assertNotIn("test-secret-key", log_output)
            self.assertNotIn("Private document text", log_output)
            handler.close()


if __name__ == "__main__":
    unittest.main()
