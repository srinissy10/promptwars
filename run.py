from __future__ import annotations

import os

import uvicorn

from backend.docchat.core.config import load_config


if __name__ == "__main__":
    config = load_config("config.yaml")
    server = config.section("server")
    uvicorn.run(
        "backend.docchat.main:app",
        host=os.environ.get("HOST", str(server.get("host", "127.0.0.1"))),
        port=int(os.environ.get("PORT", server.get("port", 8000))),
        reload=bool(server.get("reload", False)),
    )
