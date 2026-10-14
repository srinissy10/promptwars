from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.docchat.infrastructure.database import Database


class AuthorizationTests(unittest.TestCase):
    def test_document_queries_are_scoped_to_owner(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Database(Path(directory) / "test.db")
            database.initialize()
            user_a = database.create_user("a@example.com", "hash-a")
            user_b = database.create_user("b@example.com", "hash-b")
            document = database.create_document(
                user_id=user_a["id"],
                filename="private.txt",
                storage_path="/tmp/private.txt",
                extension=".txt",
                mime_type="text/plain",
                size_bytes=10,
            )
            self.assertIsNotNone(database.get_document(document["id"], user_a["id"]))
            self.assertIsNone(database.get_document(document["id"], user_b["id"]))
            self.assertFalse(database.delete_document(document["id"], user_b["id"]))
            self.assertIsNotNone(database.get_document(document["id"], user_a["id"]))


if __name__ == "__main__":
    unittest.main()
