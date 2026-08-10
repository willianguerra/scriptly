import asyncio
from pathlib import Path
from typing import Any

from app.automation.flow.models import GenerationState
from app.automation.flow.page import (
    FlowAuthRequiredError,
    FlowGenerationTimeoutError,
)
from app.automation.flow.provider import FlowProvider
from app.config import Settings


class FakeBrowserManager:
    def __init__(self) -> None:
        self.calls: list[str] = []
        self.page = object()

    async def open(self) -> None:
        self.calls.append("open")

    async def open_flow(self) -> None:
        self.calls.append("open_flow")

    async def get_flow_page(self) -> object:
        self.calls.append("get_flow_page")
        return self.page


class FakeFlowPage:
    def __init__(self, cost: int | None = 0) -> None:
        self.cost = cost
        self.calls: list[Any] = []

    async def ensure_ready(self) -> None:
        self.calls.append("ensure_ready")

    async def configure_free_video(self) -> int | None:
        self.calls.append("configure_free_video")
        return self.cost

    async def submit_video_prompt(self, prompt: str) -> None:
        self.calls.append(("submit_video_prompt", prompt))

    async def wait_generation(self, timeout_seconds: int) -> None:
        self.calls.append(("wait_generation", timeout_seconds))

    async def detect_result(self) -> bool:
        self.calls.append("detect_result")
        return True

    async def download_result(self, destination: Path) -> None:
        self.calls.append(("download_result", destination.name))
        destination.write_bytes(b"\x00\x00\x00\x18ftypisompayload")

    async def capture_screenshot(self, destination: Path) -> None:
        self.calls.append(("capture_screenshot", destination.name))
        destination.write_bytes(b"png")

    def current_url(self) -> str:
        return "https://labs.google/fx/tools/flow/project/example?secret=removed"


class AuthRequiredFlowPage(FakeFlowPage):
    async def ensure_ready(self) -> None:
        raise FlowAuthRequiredError("manual authentication is required")


class TimeoutFlowPage(FakeFlowPage):
    async def wait_generation(self, timeout_seconds: int) -> None:
        raise FlowGenerationTimeoutError("generation timed out")


class BlockingFlowPage(FakeFlowPage):
    def __init__(self) -> None:
        super().__init__()
        self.started = asyncio.Event()
        self.release = asyncio.Event()

    async def wait_generation(self, timeout_seconds: int) -> None:
        self.started.set()
        await self.release.wait()


class InvalidDownloadFlowPage(FakeFlowPage):
    async def download_result(self, destination: Path) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"invalid")


def make_settings(tmp_path: Path) -> Settings:
    return Settings(
        data_dir=tmp_path / "data",
        downloads_dir=tmp_path / "downloads",
        generation_timeout_seconds=42,
        _env_file=None,
    )


def test_provider_completes_one_free_generation(tmp_path: Path) -> None:
    async def scenario() -> None:
        manager = FakeBrowserManager()
        flow_page = FakeFlowPage(cost=0)
        provider = FlowProvider(
            manager,
            make_settings(tmp_path),
            page_factory=lambda _: flow_page,
        )

        response = await provider.generate_video("ocean waves at sunrise")

        assert response.status == "completed"
        assert Path(response.file).name == "0001.mp4"
        assert Path(response.file).exists()
        assert manager.calls == ["open", "open_flow", "get_flow_page"]
        assert ("submit_video_prompt", "ocean waves at sunrise") in flow_page.calls
        assert ("wait_generation", 42) in flow_page.calls
        assert provider.last_execution is not None
        assert provider.last_execution.state is GenerationState.COMPLETED

    asyncio.run(scenario())


def test_provider_rejects_unknown_or_positive_cost_before_submit(
    tmp_path: Path,
) -> None:
    async def scenario(cost: int | None) -> None:
        flow_page = FakeFlowPage(cost=cost)
        provider = FlowProvider(
            FakeBrowserManager(),
            make_settings(tmp_path),
            page_factory=lambda _: flow_page,
        )

        response = await provider.generate_video("safe prompt")

        assert response.status == "failed"
        assert response.error_code == "NON_ZERO_OR_UNKNOWN_COST"
        assert not any(
            isinstance(call, tuple) and call[0] == "submit_video_prompt"
            for call in flow_page.calls
        )
        assert provider.last_execution is not None
        assert provider.last_execution.state is GenerationState.REJECTED

    asyncio.run(scenario(None))
    asyncio.run(scenario(1))


def test_provider_writes_sanitized_diagnostics_on_failure(tmp_path: Path) -> None:
    async def scenario() -> None:
        flow_page = FakeFlowPage(cost=None)
        settings = make_settings(tmp_path)
        provider = FlowProvider(
            FakeBrowserManager(),
            settings,
            page_factory=lambda _: flow_page,
        )

        await provider.generate_video("must not be persisted")

        metadata_files = list((settings.error_logs_dir).glob("*.json"))
        assert len(metadata_files) == 1
        metadata = metadata_files[0].read_text(encoding="utf-8")
        assert "?secret=" not in metadata
        assert "must not be persisted" not in metadata
        assert '"state": "REJECTED"' in metadata
        assert list(settings.error_logs_dir.glob("*.png"))

    asyncio.run(scenario())


def test_provider_returns_auth_required_state(tmp_path: Path) -> None:
    async def scenario() -> None:
        provider = FlowProvider(
            FakeBrowserManager(),
            make_settings(tmp_path),
            page_factory=lambda _: AuthRequiredFlowPage(),
        )

        response = await provider.generate_video("safe prompt")

        assert response.status == "failed"
        assert response.error_code == "AUTH_REQUIRED"
        assert provider.last_execution is not None
        assert provider.last_execution.state is GenerationState.AUTH_REQUIRED

    asyncio.run(scenario())


def test_provider_returns_timeout_state(tmp_path: Path) -> None:
    async def scenario() -> None:
        provider = FlowProvider(
            FakeBrowserManager(),
            make_settings(tmp_path),
            page_factory=lambda _: TimeoutFlowPage(),
        )

        response = await provider.generate_video("safe prompt")

        assert response.status == "failed"
        assert response.error_code == "TIMEOUT"
        assert provider.last_execution is not None
        assert provider.last_execution.state is GenerationState.TIMEOUT

    asyncio.run(scenario())


def test_provider_rejects_concurrent_generation_without_queueing(
    tmp_path: Path,
) -> None:
    async def scenario() -> None:
        flow_page = BlockingFlowPage()
        provider = FlowProvider(
            FakeBrowserManager(),
            make_settings(tmp_path),
            page_factory=lambda _: flow_page,
        )

        first = asyncio.create_task(provider.generate_video("first prompt"))
        await flow_page.started.wait()
        second = await provider.generate_video("second prompt")
        flow_page.release.set()
        await first

        assert second.status == "failed"
        assert second.error_code == "BUSY"
        assert not any(
            call == ("submit_video_prompt", "second prompt")
            for call in flow_page.calls
        )

    asyncio.run(scenario())


def test_provider_reports_invalid_download(tmp_path: Path) -> None:
    async def scenario() -> None:
        provider = FlowProvider(
            FakeBrowserManager(),
            make_settings(tmp_path),
            page_factory=lambda _: InvalidDownloadFlowPage(),
        )

        response = await provider.generate_video("safe prompt")

        assert response.status == "failed"
        assert response.error_code == "DOWNLOAD_FAILED"
        assert provider.last_execution is not None
        assert provider.last_execution.state is GenerationState.FAILED

    asyncio.run(scenario())
