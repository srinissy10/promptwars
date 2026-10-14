from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class Config:
    root: Path
    values: dict[str, Any]
    source_path: Path | None = None

    def section(self, name: str) -> dict[str, Any]:
        value = self.values.get(name, {})
        if not isinstance(value, dict):
            raise ValueError(f"Configuration section '{name}' must be a mapping")
        return value

    def path(self, name: str) -> Path:
        raw = self.section("paths").get(name)
        if not raw:
            raise ValueError(f"Missing paths.{name} in config.yaml")
        candidate = Path(str(raw)).expanduser()
        return candidate if candidate.is_absolute() else (self.root / candidate).resolve()


def load_config(path: str | Path = "config.yaml") -> Config:
    config_path = Path(path).expanduser().resolve()
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    with config_path.open("r", encoding="utf-8") as handle:
        values = yaml.safe_load(handle) or {}
    if not isinstance(values, dict):
        raise ValueError("config.yaml must contain a YAML mapping")
    _apply_environment_overrides(values)
    config = Config(config_path.parent, values, source_path=config_path)
    validate_config(config)
    return config


def _apply_environment_overrides(values: dict[str, Any]) -> None:
    """Keep deploy-time secrets and ports out of the checked-in YAML file."""
    overrides = (
        ("DOCCHAT_SECRET_KEY", "security", "secret_key"),
        ("OPENAI_API_KEY", "openai", "api_key"),
    )
    for environment_name, section_name, key in overrides:
        environment_value = os.environ.get(environment_name)
        if environment_value is None:
            continue
        section = values.get(section_name)
        if isinstance(section, dict):
            section[key] = environment_value


def persist_openai_api_key(config: Config, api_key: str) -> None:
    """Atomically store the key in config.yaml without returning or logging it."""
    config_path = config.source_path or (config.root / "config.yaml")
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")

    openai_settings = dict(config.section("openai"))
    openai_settings["api_key"] = api_key
    updated_values = dict(config.values)
    updated_values["openai"] = openai_settings

    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=config_path.parent,
            prefix=f".{config_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            temporary_path = Path(handle.name)
            yaml.safe_dump(updated_values, handle, sort_keys=False, allow_unicode=True)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary_path, 0o600)
        os.replace(temporary_path, config_path)
        config.values["openai"] = openai_settings
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def validate_config(config: Config) -> None:
    required_sections = {
        "app",
        "server",
        "paths",
        "security",
        "uploads",
        "chunking",
        "retrieval",
        "chat",
        "openai",
        "logging",
    }
    missing = sorted(required_sections.difference(config.values))
    if missing:
        raise ValueError(f"Missing config sections: {', '.join(missing)}")

    chunking = config.section("chunking")
    max_words = int(chunking.get("max_words", 0))
    overlap = int(chunking.get("overlap_words", -1))
    if max_words < 20 or overlap < 0 or overlap >= max_words:
        raise ValueError("chunking requires max_words >= 20 and 0 <= overlap_words < max_words")
    if int(chunking.get("max_chunks_per_document", 0)) < 1:
        raise ValueError("chunking.max_chunks_per_document must be at least 1")

    provider = str(config.section("chat").get("provider", ""))
    if provider not in {"extractive", "openai"}:
        raise ValueError("chat.provider must be 'extractive' or 'openai'")

    openai = config.section("openai")
    configured_models = openai.get("chat_models", [])
    if not isinstance(configured_models, list) or not configured_models:
        raise ValueError("openai.chat_models must contain at least one selectable model")
    model_ids = {
        str(item.get("id"))
        for item in configured_models
        if isinstance(item, dict) and item.get("id")
    }
    if str(openai.get("chat_model", "")) not in model_ids:
        raise ValueError("openai.chat_model must be present in openai.chat_models")
