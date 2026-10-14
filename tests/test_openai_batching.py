from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.docchat.infrastructure.openai_client import OpenAIClient, OpenAIError
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


if __name__ == "__main__":
    unittest.main()
