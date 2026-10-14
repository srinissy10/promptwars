from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from .config import Config


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in (
            "request_id",
            "user_id",
            "method",
            "path",
            "status_code",
            "latency_ms",
            "document_id",
            "conversation_id",
            "error_code",
        ):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(config: Config) -> logging.Logger:
    settings = config.section("logging")
    log_path = config.path("log_file")
    log_path.parent.mkdir(parents=True, exist_ok=True)

    formatter = JsonFormatter()
    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=int(settings.get("max_bytes", 5_242_880)),
        backupCount=int(settings.get("backup_count", 3)),
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    logger = logging.getLogger("docchat")
    logger.handlers.clear()
    logger.setLevel(str(settings.get("level", "INFO")).upper())
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    logger.propagate = False
    return logger
