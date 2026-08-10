import asyncio
import logging
from pathlib import Path
from typing import Any

import pytest

from app.automation.browser.manager import (
    BrowserLaunchError,
    BrowserManager,
    BrowserNotRunningError,
    FlowNavigationError,
)
from app.config import Settings


class FakeResponse:
    ok = True
    status = 200


class FakePage:
    def __init__(self) -> None:
        self.url = "about:blank"
        self.closed = False
        self.goto_calls: list[dict[str, Any]] = []
        self.brought_to_front = False
        self.handlers: dict[str, Any] = {}
        self.goto_error: Exception | None = None

    def is_closed(self) -> bool:
        return self.closed

    async def goto(self, url: str, **kwargs: Any) -> FakeResponse:
        self.goto_calls.append({"url": url, **kwargs})
        if self.goto_error:
            raise self.goto_error
        self.url = url
        return FakeResponse()

    async def bring_to_front(self) -> None:
        self.brought_to_front = True

    def on(self, event: str, handler: Any) -> None:
        self.handlers[event] = handler


class FakeContext:
    def __init__(self) -> None:
        self.pages = [FakePage()]
        self.closed = False
        self.handlers: dict[str, Any] = {}
        self.navigation_timeout: int | None = None

    def on(self, event: str, handler: Any) -> None:
        self.handlers[event] = handler

    def set_default_navigation_timeout(self, timeout: int) -> None:
        self.navigation_timeout = timeout

    async def new_page(self) -> FakePage:
        page = FakePage()
        self.pages.append(page)
        return page

    async def close(self, **_: Any) -> None:
        self.closed = True
        handler = self.handlers.get("close")
        if handler:
            handler(self)

    def close_unexpectedly(self) -> None:
        self.closed = True
        handler = self.handlers["close"]
        handler(self)


class FakeChromium:
    def __init__(self, context: FakeContext) -> None:
        self.context = context
        self.calls: list[dict[str, Any]] = []

    async def launch_persistent_context(
        self,
        user_data_dir: str,
        **kwargs: Any,
    ) -> FakeContext:
        self.calls.append({"user_data_dir": user_data_dir, **kwargs})
        return self.context


class FakePlaywright:
    def __init__(self, context: FakeContext) -> None:
        self.chromium = FakeChromium(context)
        self.stopped = False

    async def stop(self) -> None:
        self.stopped = True


class FakePlaywrightStarter:
    def __init__(self, playwright: FakePlaywright) -> None:
        self.playwright = playwright

    async def start(self) -> FakePlaywright:
        return self.playwright


def make_manager(tmp_path: Path) -> tuple[BrowserManager, FakePlaywright, FakeContext]:
    settings = Settings(
        data_dir=tmp_path,
        browser_headless=True,
        _env_file=None,
    )
    context = FakeContext()
    playwright = FakePlaywright(context)
    manager = BrowserManager(
        settings,
        playwright_factory=lambda: FakePlaywrightStarter(playwright),
    )
    return manager, playwright, context


def test_open_uses_a_persistent_profile_and_is_idempotent(tmp_path: Path) -> None:
    async def scenario() -> None:
        manager, playwright, context = make_manager(tmp_path)

        await manager.open()
        await manager.open()

        assert len(playwright.chromium.calls) == 1
        assert playwright.chromium.calls[0] == {
            "user_data_dir": str((tmp_path / "profiles" / "video").resolve()),
            "headless": True,
        }
        assert context.navigation_timeout == 60_000
        assert (await manager.get_status()).running is True
        await manager.close()

    asyncio.run(scenario())


def test_open_wraps_profile_directory_failures(tmp_path: Path) -> None:
    async def scenario() -> None:
        data_file = tmp_path / "not-a-directory"
        data_file.write_text("occupied", encoding="utf-8")
        settings = Settings(data_dir=data_file, _env_file=None)
        context = FakeContext()
        playwright = FakePlaywright(context)
        manager = BrowserManager(
            settings,
            playwright_factory=lambda: FakePlaywrightStarter(playwright),
        )

        with pytest.raises(BrowserLaunchError):
            await manager.open()

        assert (await manager.get_status()).running is False

    asyncio.run(scenario())


def test_close_closes_context_and_playwright(tmp_path: Path) -> None:
    async def scenario() -> None:
        manager, playwright, context = make_manager(tmp_path)
        await manager.open()

        await manager.close()

        assert context.closed is True
        assert playwright.stopped is True
        assert (await manager.get_status()).running is False

    asyncio.run(scenario())


def test_open_flow_requires_a_running_browser(tmp_path: Path) -> None:
    async def scenario() -> None:
        manager, _, _ = make_manager(tmp_path)

        with pytest.raises(BrowserNotRunningError):
            await manager.open_flow()

    asyncio.run(scenario())


def test_open_flow_navigates_to_the_configured_url(tmp_path: Path) -> None:
    async def scenario() -> None:
        manager, _, context = make_manager(tmp_path)
        await manager.open()

        await manager.open_flow()

        assert context.pages[0].goto_calls == [
            {
                "url": "https://labs.google/fx/tools/flow",
                "wait_until": "domcontentloaded",
                "timeout": 60_000,
            }
        ]
        assert context.pages[0].brought_to_front is True
        assert manager.flow_opened is True
        await manager.close()

    asyncio.run(scenario())


def test_open_flow_reports_navigation_failure(tmp_path: Path) -> None:
    async def scenario() -> None:
        manager, _, context = make_manager(tmp_path)
        context.pages[0].goto_error = RuntimeError("network down")
        await manager.open()

        with pytest.raises(FlowNavigationError):
            await manager.open_flow()

        assert manager.flow_opened is False
        await manager.close()

    asyncio.run(scenario())


def test_unexpected_context_close_is_logged(
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def scenario() -> None:
        manager, _, context = make_manager(tmp_path)
        await manager.open()

        with caplog.at_level(logging.ERROR):
            context.close_unexpectedly()

        assert (await manager.get_status()).running is False
        assert "Browser context closed unexpectedly" in caplog.text
        await manager.close()

    asyncio.run(scenario())
