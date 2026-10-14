from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import yaml

from backend.docchat.core.config import load_config, persist_openai_api_key
from tests.helpers import test_config


class ConfigPersistenceTests(unittest.TestCase):
    def test_api_key_is_saved_to_config_and_reloaded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "config.yaml"
            original = test_config(root)
            config_path.write_text(yaml.safe_dump(original.values, sort_keys=False), encoding="utf-8")
            config = load_config(config_path)

            persist_openai_api_key(config, "test-key-that-is-long-enough")

            reloaded = load_config(config_path)
            self.assertEqual(reloaded.section("openai")["api_key"], "test-key-that-is-long-enough")
            if os.name != "nt":
                self.assertEqual(os.stat(config_path).st_mode & 0o777, 0o600)

    def test_api_key_can_be_cleared(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "config.yaml"
            original = test_config(root)
            original.values["openai"]["api_key"] = "test-key-that-is-long-enough"
            config_path.write_text(yaml.safe_dump(original.values, sort_keys=False), encoding="utf-8")
            config = load_config(config_path)

            persist_openai_api_key(config, "")

            self.assertEqual(load_config(config_path).section("openai")["api_key"], "")

    def test_deployment_secrets_can_come_from_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "config.yaml"
            original = test_config(root)
            config_path.write_text(yaml.safe_dump(original.values, sort_keys=False), encoding="utf-8")

            with patch.dict(
                os.environ,
                {"DOCCHAT_SECRET_KEY": "temporary-demo-secret", "OPENAI_API_KEY": "environment-key"},
            ):
                config = load_config(config_path)

            self.assertEqual(config.section("security")["secret_key"], "temporary-demo-secret")
            self.assertEqual(config.section("openai")["api_key"], "environment-key")


if __name__ == "__main__":
    unittest.main()
