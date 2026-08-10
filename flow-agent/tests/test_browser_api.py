from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.automation.browser.manager import BrowserNotRunningError
from app.automation.browser.models import BrowserStatus
from app.config import Settings
from app.main import create_app


class FakeBrowserManager:
    def __init__(self) -> None:
        self.running = False
        self.flow_opened = False
        self.close_calls = 0

    async def open(self) -> None:
        self.running = True

    async def close(self) -> None:
        self.close_calls += 1
        self.running = False
        self.flow_opened = False

    async def get_status(self) -> BrowserStatus:
        return BrowserStatus(running=self.running, profile="video")

    async def open_flow(self) -> None:
        if not self.running:
            raise BrowserNotRunningError("browser is not running")
        self.flow_opened = True


@pytest.fixture
def browser_client() -> Generator[tuple[TestClient, FakeBrowserManager]]:
    manager = FakeBrowserManager()
    settings = Settings(
        data_dir=Path("test-data"),
        browser_headless=True,
        _env_file=None,
    )
    with TestClient(create_app(settings, browser_manager=manager)) as client:
        yield client, manager


def test_browser_lifecycle_endpoints(
    browser_client: tuple[TestClient, FakeBrowserManager],
) -> None:
    client, _ = browser_client

    assert client.get("/browser/status").json() == {
        "running": False,
        "profile": "video",
    }
    assert client.post("/browser/open").json() == {"status": "opened"}
    assert client.get("/browser/status").json() == {
        "running": True,
        "profile": "video",
    }
    assert client.post("/browser/close").json() == {"status": "closed"}


def test_flow_open_requires_browser(
    browser_client: tuple[TestClient, FakeBrowserManager],
) -> None:
    client, _ = browser_client

    response = client.post("/flow/open")

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "BROWSER_NOT_RUNNING"


def test_status_reflects_browser_and_flow_state(
    browser_client: tuple[TestClient, FakeBrowserManager],
) -> None:
    client, _ = browser_client

    client.post("/browser/open")
    assert client.get("/status").json() == {
        "agent": "ready",
        "browser": "running",
        "flow": "unknown",
    }

    assert client.post("/flow/open").json() == {"status": "opened"}
    assert client.get("/status").json() == {
        "agent": "ready",
        "browser": "running",
        "flow": "opened",
    }


def test_app_shutdown_closes_the_browser_manager() -> None:
    manager = FakeBrowserManager()
    settings = Settings(data_dir=Path("test-data"), _env_file=None)

    with TestClient(create_app(settings, browser_manager=manager)):
        pass

    assert manager.close_calls == 1
