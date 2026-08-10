import asyncio
import logging
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from app.automation.flow.diagnostics import write_error_diagnostics
from app.automation.flow.downloads import allocate_download_path, validate_mp4
from app.automation.flow.models import (
    GenerateVideoCompleted,
    GenerateVideoFailed,
    GenerateVideoResponse,
    GenerationExecution,
    GenerationState,
    TERMINAL_STATES,
)
from app.automation.flow.page import (
    FlowAuthRequiredError,
    FlowDownloadError,
    FlowGenerationTimeoutError,
    FlowPageError,
    PlaywrightFlowPage,
)
from app.config import Settings

logger = logging.getLogger(__name__)


class FlowProvider:
    """Coordinates exactly one debug generation; it is deliberately not a queue."""

    def __init__(
        self,
        browser_manager: Any,
        settings: Settings,
        page_factory: Callable[[Any], Any] | None = None,
    ) -> None:
        self._browser_manager = browser_manager
        self._settings = settings
        self._page_factory = page_factory or (
            lambda page: PlaywrightFlowPage(page, settings.navigation_timeout_ms)
        )
        self._flow_page: Any | None = None
        self._lock = asyncio.Lock()
        self.last_execution: GenerationExecution | None = None

    async def open(self) -> None:
        await self._browser_manager.open()
        await self._browser_manager.open_flow()
        page = await self._browser_manager.get_flow_page()
        self._flow_page = self._page_factory(page)

    async def ensure_ready(self) -> None:
        await self._require_page().ensure_ready()

    async def submit_video_prompt(self, prompt: str) -> None:
        cost = await self._require_page().configure_free_video()
        if cost != 0:
            raise NonZeroOrUnknownCostError(
                "generation was blocked because the displayed cost is not exactly zero"
            )
        await self._require_page().submit_video_prompt(prompt)

    async def wait_generation(self) -> None:
        await self._require_page().wait_generation(
            self._settings.generation_timeout_seconds
        )

    async def detect_result(self) -> bool:
        return await self._require_page().detect_result()

    async def download_result(self) -> Path:
        destination = allocate_download_path(self._settings.downloads_dir)
        try:
            await self._require_page().download_result(destination)
            validate_mp4(destination)
        except FlowPageError:
            raise
        except Exception as error:
            raise FlowDownloadError("download is not a valid Google Flow MP4") from error
        return destination

    async def generate_video(self, prompt: str) -> GenerateVideoResponse:
        if self._lock.locked():
            return GenerateVideoFailed(
                error_code="BUSY",
                error_message="another debug generation is already running",
            )

        async with self._lock:
            started_at = time.monotonic()
            execution = GenerationExecution()
            self.last_execution = execution
            try:
                await self.open()
                await self.ensure_ready()
                execution.transition(GenerationState.SUBMITTING)
                await self.submit_video_prompt(prompt)
                execution.transition(GenerationState.GENERATING)
                await self.wait_generation()
                if not await self.detect_result():
                    raise FlowPageError("Google Flow produced no downloadable video")
                execution.transition(GenerationState.DOWNLOADING)
                destination = await self.download_result()
                execution.transition(GenerationState.COMPLETED)
                return GenerateVideoCompleted(
                    file=str(destination.resolve()),
                    duration_seconds=round(time.monotonic() - started_at, 3),
                )
            except NonZeroOrUnknownCostError as error:
                return await self._failure(
                    execution,
                    GenerationState.REJECTED,
                    error.code,
                    str(error),
                )
            except FlowAuthRequiredError as error:
                return await self._failure(
                    execution,
                    GenerationState.AUTH_REQUIRED,
                    error.code,
                    str(error),
                )
            except FlowGenerationTimeoutError as error:
                return await self._failure(
                    execution,
                    GenerationState.TIMEOUT,
                    error.code,
                    str(error),
                )
            except FlowPageError as error:
                return await self._failure(
                    execution,
                    GenerationState.FAILED,
                    error.code,
                    str(error),
                )
            except PlaywrightTimeoutError:
                logger.exception("Google Flow interface interaction timed out")
                return await self._failure(
                    execution,
                    GenerationState.TIMEOUT,
                    "FLOW_UI_TIMEOUT",
                    "Google Flow interface interaction timed out",
                )
            except PlaywrightError:
                logger.exception("Google Flow interface interaction failed")
                return await self._failure(
                    execution,
                    GenerationState.FAILED,
                    "FLOW_UI_ERROR",
                    "Google Flow interface interaction failed",
                )
            except Exception:
                logger.exception("Unexpected Google Flow generation failure")
                return await self._failure(
                    execution,
                    GenerationState.FAILED,
                    "UNEXPECTED_ERROR",
                    "unexpected Google Flow generation failure",
                )

    def _require_page(self) -> Any:
        if self._flow_page is None:
            raise RuntimeError("Google Flow page is not open")
        return self._flow_page

    async def _failure(
        self,
        execution: GenerationExecution,
        state: GenerationState,
        error_code: str,
        error_message: str,
    ) -> GenerateVideoFailed:
        if execution.state not in TERMINAL_STATES:
            execution.transition(state)
        logger.error(
            "Google Flow generation ended in %s (%s): %s",
            execution.state,
            error_code,
            error_message,
        )
        if self._flow_page is not None:
            try:
                await write_error_diagnostics(
                    self._flow_page,
                    self._settings.error_logs_dir,
                    execution,
                    error_code,
                    error_message,
                )
            except Exception:
                logger.exception("Failed to save Google Flow error diagnostics")
        return GenerateVideoFailed(
            error_code=error_code,
            error_message=error_message,
        )


class NonZeroOrUnknownCostError(FlowPageError):
    code = "NON_ZERO_OR_UNKNOWN_COST"
