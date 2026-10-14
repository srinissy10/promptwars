from __future__ import annotations

import json
import math
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from ..core.config import Config


class OpenAIError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class GeneratedAnswer:
    text: str
    input_tokens: int
    output_tokens: int
    model: str


class OpenAIClient:
    def __init__(self, config: Config):
        settings = config.section("openai")
        self.api_key = str(settings.get("api_key", "")).strip()
        self.base_url = str(settings.get("base_url", "https://api.openai.com/v1")).rstrip("/")
        self.chat_model = str(settings.get("chat_model", "gpt-5.6-terra"))
        raw_models = settings.get("chat_models", [])
        self.chat_models = [dict(item) for item in raw_models if isinstance(item, dict) and item.get("id")]
        self.allowed_chat_models = {str(item["id"]) for item in self.chat_models}
        self.reasoning_effort = str(settings.get("reasoning_effort", "low"))
        self.max_output_tokens = int(settings.get("max_output_tokens", 700))
        self.timeout = int(settings.get("timeout_seconds", 120))
        self.embedding_model = str(settings.get("embedding_model", "text-embedding-3-small"))
        self.embedding_dimensions = int(settings.get("embedding_dimensions", 512))
        self.embedding_batch_size = int(settings.get("embedding_batch_size", 64))
        self.embedding_max_batch_tokens = int(settings.get("embedding_max_batch_tokens", 60000))
        self.embedding_max_input_tokens = int(settings.get("embedding_max_input_tokens", 8000))
        self.max_retries = int(settings.get("max_retries", 4))
        self.retry_base_seconds = float(settings.get("retry_base_seconds", 1.5))

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def _post(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.configured:
            raise OpenAIError("OpenAI API key is not configured")
        request = urllib.request.Request(
            f"{self.base_url}/{endpoint.lstrip('/')}",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        last_error: OpenAIError | None = None
        for attempt in range(self.max_retries + 1):
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                try:
                    error_data = json.loads(exc.read().decode("utf-8"))
                    message = str(error_data.get("error", {}).get("message", exc.reason))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    message = str(exc.reason)
                last_error = OpenAIError(message, exc.code)
                retryable = exc.code == 429 or exc.code >= 500
                if not retryable or attempt == self.max_retries:
                    raise last_error from exc
                retry_after = exc.headers.get("retry-after")
                delay = float(retry_after) if retry_after and retry_after.replace(".", "", 1).isdigit() else self.retry_base_seconds * (2**attempt)
            except (urllib.error.URLError, TimeoutError) as exc:
                last_error = OpenAIError(f"Could not reach OpenAI: {exc.reason if hasattr(exc, 'reason') else exc}")
                if attempt == self.max_retries:
                    raise last_error from exc
                delay = self.retry_base_seconds * (2**attempt)
            time.sleep(min(delay, 20.0))
        raise last_error or OpenAIError("OpenAI request failed")

    @staticmethod
    def estimate_tokens(text: str) -> int:
        cjk_characters = len(re.findall(r"[\u3400-\u9fff]", text))
        other_characters = max(0, len(text) - cjk_characters)
        return max(1, cjk_characters + math.ceil(other_characters / 4))

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors: list[list[float]] = []
        start = 0
        while start < len(texts):
            batch: list[str] = []
            estimated_batch_tokens = 0
            while start + len(batch) < len(texts) and len(batch) < self.embedding_batch_size:
                candidate = texts[start + len(batch)]
                estimated = self.estimate_tokens(candidate)
                if estimated > self.embedding_max_input_tokens:
                    raise OpenAIError(
                        f"A document chunk is estimated at {estimated} tokens; "
                        f"reduce chunking.max_words below the configured {self.embedding_max_input_tokens}-token limit"
                    )
                if batch and estimated_batch_tokens + estimated > self.embedding_max_batch_tokens:
                    break
                batch.append(candidate)
                estimated_batch_tokens += estimated
            response = self._post(
                "embeddings",
                {
                    "model": self.embedding_model,
                    "input": batch,
                    "dimensions": self.embedding_dimensions,
                    "encoding_format": "float",
                },
            )
            data = sorted(response.get("data", []), key=lambda item: int(item.get("index", 0)))
            vectors.extend([list(map(float, item["embedding"])) for item in data])
            start += len(batch)
        if len(vectors) != len(texts):
            raise OpenAIError("OpenAI returned an unexpected number of embeddings")
        return vectors

    def generate_answer(
        self,
        *,
        system_prompt: str,
        question: str,
        context: str,
        history: list[dict[str, str]],
        user_id: str,
        model: str | None = None,
    ) -> GeneratedAnswer:
        selected_model = model or self.chat_model
        if selected_model not in self.allowed_chat_models:
            raise OpenAIError(f"Chat model '{selected_model}' is not available")
        history_text = "\n".join(
            f"{item['role'].upper()}: {item['content']}" for item in history
        ) or "No previous messages."
        prompt = (
            f"CONVERSATION HISTORY\n{history_text}\n\n"
            f"DOCUMENT CONTEXT\n{context}\n\n"
            f"CURRENT QUESTION\n{question}"
        )
        response = self._post(
            "responses",
            {
                "model": selected_model,
                "instructions": system_prompt,
                "input": prompt,
                "reasoning": {"effort": self.reasoning_effort},
                "max_output_tokens": self.max_output_tokens,
                "store": False,
                "safety_identifier": user_id,
                "text": {"verbosity": "low"},
            },
        )
        text = str(response.get("output_text", "")).strip()
        if not text:
            parts: list[str] = []
            for item in response.get("output", []):
                for content in item.get("content", []):
                    if content.get("type") == "output_text" and content.get("text"):
                        parts.append(str(content["text"]))
            text = "\n".join(parts).strip()
        if not text:
            raise OpenAIError("OpenAI returned no answer text")
        usage = response.get("usage", {})
        return GeneratedAnswer(
            text=text,
            input_tokens=int(usage.get("input_tokens", 0)),
            output_tokens=int(usage.get("output_tokens", 0)),
            model=str(response.get("model", selected_model)),
        )
