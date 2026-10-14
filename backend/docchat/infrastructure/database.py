from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


class Database:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    filename TEXT NOT NULL,
                    storage_path TEXT NOT NULL,
                    extension TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    current_version INTEGER NOT NULL DEFAULT 1,
                    page_count INTEGER NOT NULL DEFAULT 0,
                    chunk_count INTEGER NOT NULL DEFAULT 0,
                    error_message TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS document_versions (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    version_number INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    storage_path TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    page_count INTEGER NOT NULL DEFAULT 0,
                    chunk_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    UNIQUE(document_id, version_number)
                );

                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    chunk_index INTEGER NOT NULL,
                    page_start INTEGER NOT NULL,
                    page_end INTEGER NOT NULL,
                    section_title TEXT,
                    content TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    embedding TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE(document_id, content_hash)
                );

                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    rolling_summary TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                    content TEXT NOT NULL,
                    citations TEXT NOT NULL DEFAULT '[]',
                    model TEXT,
                    input_tokens INTEGER NOT NULL DEFAULT 0,
                    output_tokens INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS feedback (
                    id TEXT PRIMARY KEY,
                    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    rating INTEGER NOT NULL CHECK(rating IN (-1, 1)),
                    reason TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE(message_id, user_id)
                );

                CREATE INDEX IF NOT EXISTS idx_documents_user_created
                    ON documents(user_id, created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_document_versions_doc
                    ON document_versions(document_id, version_number DESC);
                CREATE INDEX IF NOT EXISTS idx_chunks_document
                    ON chunks(document_id, chunk_index);
                CREATE INDEX IF NOT EXISTS idx_conversations_document
                    ON conversations(user_id, document_id, updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_messages_conversation
                    ON messages(conversation_id, created_at);
                """
            )
            # Ensure backward-compatible column migration
            cursor = connection.execute("PRAGMA table_info(documents)")
            columns = {row["name"] for row in cursor.fetchall()}
            if "current_version" not in columns:
                connection.execute("ALTER TABLE documents ADD COLUMN current_version INTEGER NOT NULL DEFAULT 1")

    def create_user(self, email: str, password_hash: str) -> dict[str, Any]:
        user_id = str(uuid.uuid4())
        created_at = utc_now()
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO users(id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (user_id, email.strip().lower(), password_hash, created_at),
            )
        return {"id": user_id, "email": email.strip().lower(), "created_at": created_at}

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            return _dict(connection.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone())

    def get_user(self, user_id: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            return _dict(connection.execute("SELECT id, email, created_at FROM users WHERE id = ?", (user_id,)).fetchone())

    def create_document(
        self,
        *,
        user_id: str,
        filename: str,
        storage_path: str,
        extension: str,
        mime_type: str,
        size_bytes: int,
    ) -> dict[str, Any]:
        document_id = str(uuid.uuid4())
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                """INSERT INTO documents(
                    id, user_id, filename, storage_path, extension, mime_type,
                    size_bytes, status, current_version, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', 1, ?, ?)""",
                (document_id, user_id, filename, storage_path, extension, mime_type, size_bytes, now, now),
            )
            version_id = str(uuid.uuid4())
            connection.execute(
                """INSERT INTO document_versions(
                    id, document_id, version_number, filename, storage_path,
                    content_hash, size_bytes, page_count, chunk_count, created_at
                ) VALUES (?, ?, 1, ?, ?, '', ?, 0, 0, ?)""",
                (version_id, document_id, filename, storage_path, size_bytes, now),
            )
        result = self.get_document(document_id, user_id)
        assert result is not None
        return result

    def update_document(self, document_id: str, **fields: Any) -> None:
        allowed = {
            "status",
            "page_count",
            "chunk_count",
            "error_message",
            "storage_path",
            "current_version",
            "filename",
            "extension",
            "mime_type",
            "size_bytes",
        }
        selected = {key: value for key, value in fields.items() if key in allowed}
        selected["updated_at"] = utc_now()
        assignments = ", ".join(f"{key} = ?" for key in selected)
        with self.connect() as connection:
            connection.execute(
                f"UPDATE documents SET {assignments} WHERE id = ?",
                (*selected.values(), document_id),
            )

    def add_document_version(
        self,
        *,
        document_id: str,
        version_number: int,
        filename: str,
        storage_path: str,
        content_hash: str,
        size_bytes: int,
        page_count: int,
        chunk_count: int,
    ) -> dict[str, Any]:
        version_id = str(uuid.uuid4())
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                """INSERT INTO document_versions(
                    id, document_id, version_number, filename, storage_path,
                    content_hash, size_bytes, page_count, chunk_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    version_id,
                    document_id,
                    version_number,
                    filename,
                    storage_path,
                    content_hash,
                    size_bytes,
                    page_count,
                    chunk_count,
                    now,
                ),
            )
        return {
            "id": version_id,
            "document_id": document_id,
            "version_number": version_number,
            "filename": filename,
            "storage_path": storage_path,
            "content_hash": content_hash,
            "size_bytes": size_bytes,
            "page_count": page_count,
            "chunk_count": chunk_count,
            "created_at": now,
        }

    def update_initial_version(
        self,
        document_id: str,
        *,
        content_hash: str,
        page_count: int,
        chunk_count: int,
    ) -> None:
        with self.connect() as connection:
            connection.execute(
                """UPDATE document_versions
                SET content_hash = ?, page_count = ?, chunk_count = ?
                WHERE document_id = ? AND version_number = 1""",
                (content_hash, page_count, chunk_count, document_id),
            )

    def list_document_versions(self, document_id: str, user_id: str) -> list[dict[str, Any]]:
        with self.connect() as connection:
            # Check ownership first
            doc = connection.execute(
                "SELECT id FROM documents WHERE id = ? AND user_id = ?",
                (document_id, user_id),
            ).fetchone()
            if not doc:
                return []
            rows = connection.execute(
                """SELECT id, document_id, version_number, filename, content_hash,
                          size_bytes, page_count, chunk_count, created_at
                FROM document_versions
                WHERE document_id = ?
                ORDER BY version_number DESC""",
                (document_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_document_version(self, document_id: str, version_number: int, user_id: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            doc = connection.execute(
                "SELECT id FROM documents WHERE id = ? AND user_id = ?",
                (document_id, user_id),
            ).fetchone()
            if not doc:
                return None
            row = connection.execute(
                """SELECT * FROM document_versions
                WHERE document_id = ? AND version_number = ?""",
                (document_id, version_number),
            ).fetchone()
        return _dict(row)

    def list_documents(self, user_id: str, search: str = "") -> list[dict[str, Any]]:
        with self.connect() as connection:
            if search.strip():
                rows = connection.execute(
                    """SELECT * FROM documents
                    WHERE user_id = ? AND filename LIKE ? ESCAPE '\\'
                    ORDER BY created_at DESC""",
                    (user_id, f"%{search.strip()}%"),
                ).fetchall()
            else:
                rows = connection.execute(
                    "SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC",
                    (user_id,),
                ).fetchall()
        return [dict(row) for row in rows]

    def get_document(self, document_id: str, user_id: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            return _dict(
                connection.execute(
                    "SELECT * FROM documents WHERE id = ? AND user_id = ?",
                    (document_id, user_id),
                ).fetchone()
            )

    def delete_document(self, document_id: str, user_id: str) -> bool:
        with self.connect() as connection:
            cursor = connection.execute(
                "DELETE FROM documents WHERE id = ? AND user_id = ?",
                (document_id, user_id),
            )
            return cursor.rowcount > 0

    def replace_chunks(self, document_id: str, user_id: str, chunks: list[dict[str, Any]]) -> None:
        with self.connect() as connection:
            connection.execute(
                "DELETE FROM chunks WHERE document_id = ? AND user_id = ?",
                (document_id, user_id),
            )
            connection.executemany(
                """INSERT INTO chunks(
                    id, document_id, user_id, chunk_index, page_start, page_end,
                    section_title, content, content_hash, embedding, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    (
                        item["id"],
                        document_id,
                        user_id,
                        item["chunk_index"],
                        item["page_start"],
                        item["page_end"],
                        item.get("section_title"),
                        item["content"],
                        item["content_hash"],
                        json.dumps(item["embedding"]) if item.get("embedding") is not None else None,
                        utc_now(),
                    )
                    for item in chunks
                ],
            )

    def get_chunks(self, document_id: str, user_id: str) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """SELECT * FROM chunks
                WHERE document_id = ? AND user_id = ? ORDER BY chunk_index""",
                (document_id, user_id),
            ).fetchall()
        result = [dict(row) for row in rows]
        for item in result:
            item["embedding"] = json.loads(item["embedding"]) if item.get("embedding") else None
        return result

    def create_conversation(self, document_id: str, user_id: str, title: str) -> dict[str, Any]:
        conversation_id = str(uuid.uuid4())
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                """INSERT INTO conversations(
                    id, user_id, document_id, title, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)""",
                (conversation_id, user_id, document_id, title.strip() or "New conversation", now, now),
            )
        result = self.get_conversation(conversation_id, user_id)
        assert result is not None
        return result

    def list_conversations(self, document_id: str, user_id: str) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """SELECT * FROM conversations
                WHERE document_id = ? AND user_id = ? ORDER BY updated_at DESC""",
                (document_id, user_id),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_conversation(self, conversation_id: str, user_id: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            return _dict(
                connection.execute(
                    "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
                    (conversation_id, user_id),
                ).fetchone()
            )

    def update_conversation_title(self, conversation_id: str, user_id: str, title: str) -> bool:
        with self.connect() as connection:
            cursor = connection.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?",
                (title.strip(), utc_now(), conversation_id, user_id),
            )
            return cursor.rowcount > 0

    def delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        with self.connect() as connection:
            cursor = connection.execute(
                "DELETE FROM conversations WHERE id = ? AND user_id = ?",
                (conversation_id, user_id),
            )
            return cursor.rowcount > 0

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        *,
        citations: list[dict[str, Any]] | None = None,
        model: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
    ) -> dict[str, Any]:
        message_id = str(uuid.uuid4())
        now = utc_now()
        citations_json = json.dumps(citations or [], ensure_ascii=False)
        with self.connect() as connection:
            connection.execute(
                """INSERT INTO messages(
                    id, conversation_id, role, content, citations, model,
                    input_tokens, output_tokens, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    message_id,
                    conversation_id,
                    role,
                    content,
                    citations_json,
                    model,
                    input_tokens,
                    output_tokens,
                    now,
                ),
            )
            connection.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )
        return {
            "id": message_id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "citations": citations or [],
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "created_at": now,
        }

    def add_chat_exchange(
        self,
        conversation_id: str,
        user_id: str,
        question: str,
        answer: str,
        *,
        citations: list[dict[str, Any]],
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        user_message_id = str(uuid.uuid4())
        assistant_message_id = str(uuid.uuid4())
        user_created_at = utc_now()
        assistant_created_at = utc_now()
        with self.connect() as connection:
            conversation = connection.execute(
                "SELECT title FROM conversations WHERE id = ? AND user_id = ?",
                (conversation_id, user_id),
            ).fetchone()
            if conversation is None:
                raise sqlite3.IntegrityError("Conversation is no longer available")

            connection.executemany(
                """INSERT INTO messages(
                    id, conversation_id, role, content, citations, model,
                    input_tokens, output_tokens, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    (
                        user_message_id,
                        conversation_id,
                        "user",
                        question,
                        "[]",
                        None,
                        0,
                        0,
                        user_created_at,
                    ),
                    (
                        assistant_message_id,
                        conversation_id,
                        "assistant",
                        answer,
                        json.dumps(citations, ensure_ascii=False),
                        model,
                        input_tokens,
                        output_tokens,
                        assistant_created_at,
                    ),
                ],
            )
            if conversation["title"] == "New conversation":
                connection.execute(
                    "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?",
                    (question[:80], assistant_created_at, conversation_id, user_id),
                )
            else:
                connection.execute(
                    "UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?",
                    (assistant_created_at, conversation_id, user_id),
                )

        user_message = {
            "id": user_message_id,
            "conversation_id": conversation_id,
            "role": "user",
            "content": question,
            "citations": [],
            "model": None,
            "input_tokens": 0,
            "output_tokens": 0,
            "created_at": user_created_at,
        }
        assistant_message = {
            "id": assistant_message_id,
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": answer,
            "citations": citations,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "created_at": assistant_created_at,
        }
        return user_message, assistant_message

    def list_messages(self, conversation_id: str, user_id: str, limit: int | None = None) -> list[dict[str, Any]]:
        query = """SELECT m.* FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE m.conversation_id = ? AND c.user_id = ?
            ORDER BY m.created_at"""
        parameters: tuple[Any, ...] = (conversation_id, user_id)
        if limit is not None:
            query = """SELECT * FROM (""" + query + " DESC LIMIT ?) ORDER BY created_at"
            parameters = (conversation_id, user_id, limit)
        with self.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        result = [dict(row) for row in rows]
        for item in result:
            item["citations"] = json.loads(item.get("citations") or "[]")
        return result

    def add_feedback(self, message_id: str, user_id: str, rating: int, reason: str | None) -> dict[str, Any] | None:
        feedback_id = str(uuid.uuid4())
        now = utc_now()
        with self.connect() as connection:
            owns_message = connection.execute(
                """SELECT 1 FROM messages m
                JOIN conversations c ON c.id = m.conversation_id
                WHERE m.id = ? AND c.user_id = ? AND m.role = 'assistant'""",
                (message_id, user_id),
            ).fetchone()
            if not owns_message:
                return None
            connection.execute(
                """INSERT INTO feedback(id, message_id, user_id, rating, reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(message_id, user_id) DO UPDATE SET
                    rating = excluded.rating,
                    reason = excluded.reason,
                    created_at = excluded.created_at""",
                (feedback_id, message_id, user_id, rating, reason, now),
            )
        return {"message_id": message_id, "rating": rating, "reason": reason, "created_at": now}
