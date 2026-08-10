from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client() -> Generator[TestClient]:
    settings = Settings(
        service_name="scriptly-flow-agent",
        version="0.2.0",
        host="127.0.0.1",
        port=8765,
        cors_origins="http://127.0.0.1:3000,http://localhost:3000",
        log_level="INFO",
        data_dir=Path("test-data"),
        browser_profile="video",
        browser_headless=True,
        flow_url="https://labs.google/fx/tools/flow",
        navigation_timeout_ms=60_000,
        _env_file=None,
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client
