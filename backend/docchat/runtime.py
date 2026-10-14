from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from .core.config import Config, load_config
from .core.logging import configure_logging
from .infrastructure.database import Database
from .infrastructure.openai_client import OpenAIClient
from .services.ingestion import IngestionService
from .services.intelligence import IntelligenceService
from .services.rag import RagService


@dataclass(frozen=True)
class AppContext:
    config: Config
    logger: logging.Logger
    database: Database
    openai: OpenAIClient
    rag: RagService
    ingestion: IngestionService
    intelligence: IntelligenceService
    uploads_path: Path
    frontend_path: Path

    def close(self) -> None:
        for handler in list(self.logger.handlers):
            handler.close()
            self.logger.removeHandler(handler)


def build_context(config_path: str | Path) -> AppContext:
    config = load_config(config_path)
    logger = configure_logging(config)
    database = Database(config.path("database"))
    database.initialize()
    uploads_path = config.path("uploads")
    uploads_path.mkdir(parents=True, exist_ok=True)
    openai = OpenAIClient(config)
    rag = RagService(config, openai)
    ingestion = IngestionService(config, database, rag, openai, logger)
    intelligence = IntelligenceService(openai)
    return AppContext(
        config=config,
        logger=logger,
        database=database,
        openai=openai,
        rag=rag,
        ingestion=ingestion,
        intelligence=intelligence,
        uploads_path=uploads_path,
        frontend_path=config.path("static"),
    )

