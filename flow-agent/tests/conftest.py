from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client() -> Generator[TestClient]:
    settings = Settings(
        service_name="scriptly-flow-agent",
        version="0.1.0",
        host="127.0.0.1",
        port=8765,
        cors_origins="http://127.0.0.1:3000,http://localhost:3000",
        log_level="INFO",
        _env_file=None,
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client
