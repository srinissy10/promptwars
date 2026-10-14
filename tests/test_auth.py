from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import yaml
from fastapi import HTTPException

from backend.docchat.api.routes.auth import register
from backend.docchat.api.schemas import AuthRequest
from backend.docchat.runtime import build_context
from tests.helpers import test_config


class AuthRouteTests(unittest.TestCase):
    def test_duplicate_registration_returns_a_clear_conflict(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "config.yaml"
            config_path.write_text(yaml.safe_dump(test_config(root).values, sort_keys=False), encoding="utf-8")
            context = build_context(config_path)
            payload = AuthRequest(email="person@example.com", password="password123")

            try:
                register(payload, context)
                with self.assertRaises(HTTPException) as caught:
                    register(payload, context)

                self.assertEqual(caught.exception.status_code, 409)
                self.assertEqual(caught.exception.detail, "An account with this email already exists")
            finally:
                context.close()


if __name__ == "__main__":
    unittest.main()
