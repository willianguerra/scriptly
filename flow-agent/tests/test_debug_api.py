from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.automation.flow.models import GenerateVideoCompleted, GenerateVideoFailed
from app.config import Settings
from app.main import create_app


class FakeBrowserManager:
    flow_opened = False

    async def close(self) -> None:
        return None


class FakeProvider:
    def __init__(self, response: Any) -> None:
        self.response = response
        self.prompts: list[str] = []

    async def generate_video(self, prompt: str) -> Any:
        self.prompts.append(prompt)
        return self.response


def make_client(tmp_path: Path, provider: FakeProvider) -> TestClient:
    settings = Settings(
        data_dir=tmp_path / "data",
        downloads_dir=tmp_path / "downloads",
        _env_file=None,
    )
    return TestClient(
        create_app(
            settings,
            browser_manager=FakeBrowserManager(),
            flow_provider=provider,
        )
    )


def test_debug_generate_video_returns_completed_response(tmp_path: Path) -> None:
    provider = FakeProvider(
        GenerateVideoCompleted(file="C:/downloads/0001.mp4", duration_seconds=12.5)
    )

    with make_client(tmp_path, provider) as client:
        response = client.post("/debug/generate-video", json={"prompt": " test "})

    assert response.status_code == 200
    assert response.json() == {
        "status": "completed",
        "file": "C:/downloads/0001.mp4",
        "duration_seconds": 12.5,
    }
    assert provider.prompts == ["test"]


def test_debug_generate_video_returns_operational_failure(tmp_path: Path) -> None:
    provider = FakeProvider(
        GenerateVideoFailed(
            error_code="AUTH_REQUIRED",
            error_message="manual authentication is required",
        )
    )

    with make_client(tmp_path, provider) as client:
        response = client.post("/debug/generate-video", json={"prompt": "test"})

    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert response.json()["error_code"] == "AUTH_REQUIRED"


def test_debug_generate_video_rejects_blank_prompt(tmp_path: Path) -> None:
    provider = FakeProvider(None)

    with make_client(tmp_path, provider) as client:
        response = client.post("/debug/generate-video", json={"prompt": "   "})

    assert response.status_code == 422
    assert provider.prompts == []
