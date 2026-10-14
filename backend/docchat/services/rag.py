from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any

from ..core.config import Config
from ..infrastructure.openai_client import GeneratedAnswer, OpenAIClient, OpenAIError


@dataclass(frozen=True)
class AnswerResult:
    text: str
    citations: list[dict[str, Any]]
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    warning: str | None = None


def _terms(text: str) -> list[str]:
    lowered = text.lower()
    terms = re.findall(r"[a-z0-9_]{2,}|[\u3400-\u9fff]+", lowered)
    result: list[str] = []
    for term in terms:
        if re.fullmatch(r"[\u3400-\u9fff]+", term):
            if len(term) == 1:
                result.append(term)
            else:
                result.extend(term[index : index + 2] for index in range(len(term) - 1))
        else:
            result.append(term)
    return result


def _cosine(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        return 0.0
    return dot / (left_norm * right_norm)


def retrieve(
    chunks: list[dict[str, Any]],
    query: str,
    *,
    query_embedding: list[float] | None,
    top_k: int,
    min_score: float,
) -> list[dict[str, Any]]:
    query_terms = _terms(query)
    query_set = set(query_terms)
    has_vectors = bool(query_embedding) and any(item.get("embedding") for item in chunks)
    ranked: list[dict[str, Any]] = []
    for item in chunks:
        content_terms = _terms(item["content"])
        content_set = set(content_terms)
        overlap = len(query_set.intersection(content_set))
        lexical = overlap / max(1, len(query_set))
        frequency = sum(content_terms.count(term) for term in query_set) / max(1, len(content_terms))
        lexical = min(1.0, lexical * 0.85 + frequency * 2.5)
        semantic = _cosine(query_embedding or [], item.get("embedding") or []) if has_vectors else 0.0
        score = semantic * 0.82 + lexical * 0.18 if has_vectors else lexical
        candidate = dict(item)
        candidate["score"] = round(score, 6)
        candidate["lexical_score"] = round(lexical, 6)
        candidate["semantic_score"] = round(semantic, 6)
        ranked.append(candidate)
    ranked.sort(key=lambda item: (item["score"], -item["chunk_index"]), reverse=True)
    return [item for item in ranked[:top_k] if item["score"] >= min_score]


def build_citations(
    document_id: str,
    chunks: list[dict[str, Any]],
    match_levels: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    levels = match_levels or {}
    exact_lexical = float(levels.get("exact_lexical", 0.95))
    high_score = float(levels.get("high_score", 0.60))
    medium_score = float(levels.get("medium_score", 0.35))
    citations: list[dict[str, Any]] = []
    for item in chunks:
        content = re.sub(r"\s+", " ", item["content"]).strip()
        score = float(item["score"])
        lexical = float(item.get("lexical_score", 0.0))
        if lexical >= exact_lexical:
            match_level = "Exact"
        elif score >= high_score:
            match_level = "High"
        elif score >= medium_score:
            match_level = "Medium"
        else:
            match_level = "Low"
        citations.append(
            {
                "document_id": document_id,
                "page_number": item["page_start"],
                "page_end": item["page_end"],
                "chunk_id": item["id"],
                "section_title": item.get("section_title") or "",
                "snippet": content[:520] + ("…" if len(content) > 520 else ""),
                "score": score,
                "match_level": match_level,
            }
        )
    return citations


def build_context(chunks: list[dict[str, Any]], max_characters: int) -> str:
    blocks: list[str] = []
    used = 0
    for index, item in enumerate(chunks, start=1):
        block = (
            f"[CHUNK {index} | PAGE {item['page_start']} | "
            f"SECTION {item.get('section_title') or 'Not available'}]\n{item['content']}"
        )
        if blocks and used + len(block) > max_characters:
            break
        blocks.append(block[: max_characters - used])
        used += len(block)
    return "\n\n".join(blocks)


def extractive_answer(question: str, chunks: list[dict[str, Any]], refusal: str) -> str:
    if not chunks:
        return refusal
    query_terms = set(_terms(question))
    sentences: list[tuple[float, str, int]] = []
    for item in chunks[:4]:
        parts = re.split(r"(?<=[.!?。！？])\s*|\n+", item["content"])
        for sentence in parts:
            sentence = sentence.strip()
            if len(sentence) < 18:
                continue
            sentence_terms = set(_terms(sentence))
            overlap = len(query_terms.intersection(sentence_terms)) / max(1, len(query_terms))
            sentences.append((overlap + float(item["score"]) * 0.25, sentence, int(item["page_start"])))
    sentences.sort(key=lambda item: item[0], reverse=True)
    selected: list[tuple[str, int]] = []
    seen: set[str] = set()
    for score, sentence, page in sentences:
        normalized = sentence.lower()
        if normalized in seen or (selected and score <= 0):
            continue
        selected.append((sentence, page))
        seen.add(normalized)
        if len(selected) == 3:
            break
    if not selected:
        return refusal
    body = " ".join(sentence for sentence, _ in selected)
    pages = ", ".join(str(page) for page in sorted({page for _, page in selected}))
    return f"Based on the document: {body}\n\nRelevant page(s): {pages}."


class RagService:
    def __init__(self, config: Config, client: OpenAIClient):
        self.config = config
        self.client = client

    def embed_chunks(self, chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not self.client.configured or not chunks:
            return chunks
        vectors = self.client.embed([str(item["content"]) for item in chunks])
        for item, vector in zip(chunks, vectors):
            item["embedding"] = vector
        return chunks

    def answer(
        self,
        *,
        document_id: str,
        user_id: str,
        question: str,
        chunks: list[dict[str, Any]],
        history: list[dict[str, Any]],
        model: str | None = None,
    ) -> AnswerResult:
        retrieval_settings = self.config.section("retrieval")
        chat_settings = self.config.section("chat")
        history_questions = [item["content"] for item in history[-4:] if item["role"] == "user"]
        retrieval_query = "\n".join((*history_questions[-2:], question))
        warning: str | None = None
        query_embedding: list[float] | None = None
        if self.client.configured:
            try:
                query_embedding = self.client.embed([retrieval_query])[0]
            except OpenAIError as exc:
                warning = f"Embedding request failed; used local keyword retrieval: {exc}"

        matches = retrieve(
            chunks,
            retrieval_query,
            query_embedding=query_embedding,
            top_k=int(retrieval_settings.get("top_k", 6)),
            min_score=float(retrieval_settings.get("min_score", 0.08)),
        )
        refusal = str(chat_settings.get("refusal_message"))
        citations = build_citations(
            document_id,
            matches,
            retrieval_settings.get("match_levels", {}),
        )
        if not matches:
            return AnswerResult(refusal, [], "retrieval-refusal", warning=warning)

        provider = str(chat_settings.get("provider", "openai"))
        if provider == "openai" and self.client.configured:
            context = build_context(matches, int(retrieval_settings.get("max_context_characters", 12000)))
            try:
                generated: GeneratedAnswer = self.client.generate_answer(
                    system_prompt=str(chat_settings.get("system_prompt")),
                    question=question,
                    context=context,
                    history=[{"role": item["role"], "content": item["content"]} for item in history],
                    user_id=user_id,
                    model=model,
                )
                return AnswerResult(
                    generated.text,
                    citations,
                    generated.model,
                    generated.input_tokens,
                    generated.output_tokens,
                    warning,
                )
            except OpenAIError as exc:
                warning = f"OpenAI answer generation failed; used local extractive answer: {exc}"

        return AnswerResult(
            extractive_answer(question, matches, refusal),
            citations,
            "extractive-fallback" if provider == "openai" else "extractive",
            warning=warning or ("OpenAI API key is empty; used local extractive answer" if provider == "openai" else None),
        )
