from __future__ import annotations

from pathlib import Path

from backend.docchat.core.config import Config


def test_config(root: Path) -> Config:
    return Config(
        root=root,
        values={
            "app": {"name": "DocChat Test", "version": "test"},
            "server": {"host": "127.0.0.1", "port": 8000, "reload": False},
            "paths": {
                "database": "docchat.db",
                "uploads": "uploads",
                "log_file": "logs.jsonl",
                "static": "frontend",
            },
            "security": {"secret_key": "test-secret", "token_ttl_minutes": 30, "password_iterations": 1000},
            "uploads": {"max_file_mb": 5, "allowed_extensions": [".txt", ".pdf", ".docx"]},
            "chunking": {"max_words": 40, "overlap_words": 8, "max_chunks_per_document": 100},
            "retrieval": {
                "top_k": 4,
                "min_score": 0.05,
                "max_context_characters": 4000,
                "match_levels": {"exact_lexical": 0.95, "high_score": 0.6, "medium_score": 0.35},
            },
            "chat": {
                "provider": "extractive",
                "fallback_provider": "extractive",
                "refusal_message": "Not enough information.",
                "recent_messages": 4,
                "stream_chunk_characters": 20,
                "system_prompt": "Use only the context.",
            },
            "openai": {
                "api_key": "",
                "base_url": "https://api.openai.com/v1",
                "chat_model": "gpt-5.6-terra",
                "chat_models": [
                    {"id": "gpt-5.6-luna", "label": "Luna", "description": "Fast"},
                    {"id": "gpt-5.6-terra", "label": "Terra", "description": "Balanced"},
                    {"id": "gpt-5.6-sol", "label": "Sol", "description": "Highest quality"},
                ],
                "reasoning_effort": "low",
                "max_output_tokens": 100,
                "timeout_seconds": 10,
                "embedding_model": "text-embedding-3-small",
                "embedding_dimensions": 16,
                "embedding_batch_size": 16,
                "embedding_max_batch_tokens": 1000,
                "embedding_max_input_tokens": 800,
                "max_retries": 0,
                "retry_base_seconds": 0.01,
            },
            "logging": {"level": "INFO", "max_bytes": 100000, "backup_count": 1},
        },
    )
