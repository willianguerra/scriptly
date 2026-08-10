import asyncio
import logging
from collections.abc import Callable
from typing import Any

from playwright.async_api import async_playwright

from app.automation.browser.models import BrowserStatus
from app.automation.browser.profiles import ensure_profile_directory
from app.config import Settings

logger = logging.getLogger(__name__)


class BrowserManagerError(RuntimeError):
    """Base error for browser lifecycle operations."""


class BrowserLaunchError(BrowserManagerError):
    """Raised when Chromium cannot be started."""


class BrowserCloseError(BrowserManagerError):
    """Raised when Chromium cannot be closed cleanly."""


class BrowserNotRunningError(BrowserManagerError):
    """Raised when an operation requires an active browser context."""


class FlowNavigationError(BrowserManagerError):
    """Raised when the configured Flow page cannot be opened."""


class BrowserManager:
    """Owns one Playwright persistent Chromium context for the local agent."""

    def __init__(
        self,
        settings: Settings,
        playwright_factory: Callable[[], Any] = async_playwright,
    ) -> None:
        self._settings = settings
        self._playwright_factory = playwright_factory
        self._lock = asyncio.Lock()
        self._playwright: Any | None = None
        self._context: Any | None = None
        self._flow_page: Any | None = None
        self._flow_opened = False
        self._closing = False

    @property
    def flow_opened(self) -> bool:
        return self._flow_opened and self._context is not None

    async def get_status(self) -> BrowserStatus:
        async with self._lock:
            return BrowserStatus(
                running=self._context is not None,
                profile=self._settings.browser_profile,
            )

    async def open(self) -> None:
        async with self._lock:
            if self._context is not None:
                return

            await self._stop_playwright()

            try:
                profile_path = ensure_profile_directory(
                    self._settings.data_dir,
                    self._settings.browser_profile,
                )
                self._playwright = await self._playwright_factory().start()
                context = await self._playwright.chromium.launch_persistent_context(
                    user_data_dir=str(profile_path),
                    headless=self._settings.browser_headless,
                )
                context.set_default_navigation_timeout(
                    self._settings.navigation_timeout_ms
                )
                context.on("close", self._on_context_closed)
                self._context = context
                self._flow_opened = False
                logger.info(
                    "Browser opened with persistent profile '%s'",
                    self._settings.browser_profile,
                )
            except Exception as error:
                await self._stop_playwright()
                logger.exception(
                    "Failed to open browser with profile '%s'",
                    self._settings.browser_profile,
                )
                raise BrowserLaunchError("failed to open Chromium") from error

    async def close(self) -> None:
        async with self._lock:
            context = self._context
            had_browser_resources = context is not None or self._playwright is not None
            self._closing = True
            self._context = None
            self._flow_page = None
            self._flow_opened = False
            close_error: Exception | None = None

            try:
                if context is not None:
                    await context.close(reason="Scriptly Flow Agent shutdown")
            except Exception as error:
                close_error = error
                logger.exception("Failed while closing browser context")
            finally:
                await self._stop_playwright()
                self._closing = False

            if had_browser_resources:
                logger.info("Browser closed")
            if close_error is not None:
                raise BrowserCloseError("failed to close Chromium cleanly") from close_error

    async def open_flow(self) -> None:
        async with self._lock:
            context = self._context
            if context is None:
                raise BrowserNotRunningError("browser is not running")

            page = self._flow_page
            if page is None or page.is_closed():
                page = next(
                    (candidate for candidate in context.pages if not candidate.is_closed()),
                    None,
                )
                if page is None:
                    page = await context.new_page()
                page.on("close", self._on_flow_page_closed)

            try:
                response = await page.goto(
                    str(self._settings.flow_url),
                    wait_until="domcontentloaded",
                    timeout=self._settings.navigation_timeout_ms,
                )
                if response is not None and not response.ok:
                    raise FlowNavigationError(
                        f"Flow returned HTTP status {response.status}"
                    )
                await page.bring_to_front()
                self._flow_page = page
                self._flow_opened = True
                logger.info("Google Flow page opened")
            except Exception as error:
                self._flow_opened = False
                logger.exception("Failed to navigate to Google Flow")
                if isinstance(error, FlowNavigationError):
                    raise
                raise FlowNavigationError("failed to navigate to Google Flow") from error

    async def _stop_playwright(self) -> None:
        playwright = self._playwright
        self._playwright = None
        if playwright is not None:
            try:
                await playwright.stop()
            except Exception:
                logger.exception("Failed to stop Playwright")

    def _on_context_closed(self, context: Any) -> None:
        if context is not self._context:
            return
        if not self._closing:
            logger.error("Browser context closed unexpectedly")
        self._context = None
        self._flow_page = None
        self._flow_opened = False

    def _on_flow_page_closed(self, page: Any) -> None:
        if page is self._flow_page:
            self._flow_page = None
            self._flow_opened = False
