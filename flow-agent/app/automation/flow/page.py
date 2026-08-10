import asyncio
import logging
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from app.automation.flow import selectors
from app.automation.flow.downloads import validate_mp4
from app.automation.flow.selectors import parse_credit_cost

logger = logging.getLogger(__name__)


class FlowPageError(RuntimeError):
    """A comprehensible Flow UI failure."""

    code = "FLOW_UI_ERROR"


class FlowAuthRequiredError(FlowPageError):
    code = "AUTH_REQUIRED"


class FlowGenerationTimeoutError(FlowPageError):
    code = "TIMEOUT"


class FlowResultError(FlowPageError):
    code = "RESULT_NOT_FOUND"


class FlowDownloadError(FlowPageError):
    code = "DOWNLOAD_FAILED"


class PlaywrightFlowPage:
    """Google Flow DOM adapter. All selector values live in selectors.py."""

    def __init__(self, page: Any, navigation_timeout_ms: int = 60_000) -> None:
        self._page = page
        self._navigation_timeout_ms = navigation_timeout_ms

    def current_url(self) -> str:
        return self._page.url

    async def capture_screenshot(self, destination: Path) -> None:
        await self._page.screenshot(path=str(destination), full_page=True)

    async def ensure_ready(self) -> None:
        if await self._authentication_required():
            raise FlowAuthRequiredError("manual Google Flow authentication is required")

        editor = self._page.locator(selectors.COMPOSER_EDITOR_CSS)
        public_create = self._page.get_by_role(
            selectors.BUTTON_ROLE, name=selectors.PUBLIC_CREATE_BUTTON_NAME
        )
        new_project = self._page.get_by_role(
            selectors.BUTTON_ROLE, name=selectors.NEW_PROJECT_BUTTON_NAME
        )
        if not any(
            [
                await editor.is_visible(),
                await public_create.is_visible(),
                await new_project.is_visible(),
            ]
        ):
            try:
                await self._wait_for_any_visible(
                    [editor, public_create, new_project],
                    self._navigation_timeout_ms,
                )
            except PlaywrightTimeoutError as error:
                if await self._authentication_required():
                    raise FlowAuthRequiredError(
                        "manual Google Flow authentication is required"
                    ) from error
                raise FlowPageError("Google Flow did not become ready") from error

        if await editor.is_visible():
            return

        if await public_create.is_visible():
            await public_create.click()
            try:
                await self._wait_for_any_visible(
                    [
                        self._page.locator(selectors.COMPOSER_EDITOR_CSS),
                        self._page.get_by_role(
                            selectors.BUTTON_ROLE,
                            name=selectors.NEW_PROJECT_BUTTON_NAME,
                        ),
                    ],
                    self._navigation_timeout_ms,
                )
            except PlaywrightTimeoutError as error:
                if await self._authentication_required():
                    raise FlowAuthRequiredError(
                        "manual Google Flow authentication is required"
                    ) from error
                raise FlowPageError("Google Flow did not open its project list") from error

        if await self._authentication_required():
            raise FlowAuthRequiredError("manual Google Flow authentication is required")

        editor = self._page.locator(selectors.COMPOSER_EDITOR_CSS)
        if await editor.is_visible():
            return

        if not await new_project.is_visible():
            raise FlowPageError("Google Flow project list is not ready")

        await new_project.click()
        try:
            await self._page.locator(selectors.COMPOSER_EDITOR_CSS).wait_for(
                state="visible", timeout=self._navigation_timeout_ms
            )
        except PlaywrightTimeoutError as error:
            if await self._authentication_required():
                raise FlowAuthRequiredError(
                    "manual Google Flow authentication is required"
                ) from error
            raise FlowPageError("Google Flow project editor did not open") from error

        logger.info("Google Flow project editor is ready")

    async def configure_free_video(self) -> int | None:
        menu = await self._open_settings_menu()
        await menu.get_by_role(
            selectors.TAB_ROLE, name=selectors.VIDEO_TAB_NAME
        ).click()
        menu = await self._visible_settings_menu()
        await menu.get_by_role(
            selectors.TAB_ROLE, name=selectors.ELEMENTS_TAB_NAME
        ).click()

        menu = await self._visible_settings_menu()
        selected_model = menu.get_by_role(
            selectors.BUTTON_ROLE,
            name=selectors.SELECTED_FREE_VIDEO_MODEL_NAME,
        ).first
        if not await selected_model.is_visible():
            model_button = menu.get_by_role(
                selectors.BUTTON_ROLE, name=selectors.MODEL_BUTTON_NAME
            ).first
            await model_button.click()
            model_item = self._page.get_by_role(
                selectors.MENUITEM_ROLE,
                name=selectors.FREE_VIDEO_MODEL_NAME,
            )
            await model_item.wait_for(
                state="visible", timeout=self._navigation_timeout_ms
            )
            await model_item.click()
        else:
            logger.info("The configured zero-credit Google Flow model is already selected")

        menu = await self._open_settings_menu()
        await menu.get_by_role(
            selectors.TAB_ROLE, name=selectors.ASPECT_RATIO_NAME
        ).click()
        menu = await self._visible_settings_menu()
        await menu.get_by_role(
            selectors.TAB_ROLE, name=selectors.DURATION_NAME, exact=True
        ).click()
        menu = await self._visible_settings_menu()
        await menu.get_by_role(
            selectors.TAB_ROLE, name=selectors.COUNT_NAME, exact=True
        ).click()

        menu = await self._visible_settings_menu()
        selected_model = menu.get_by_role(
            selectors.BUTTON_ROLE,
            name=selectors.SELECTED_FREE_VIDEO_MODEL_NAME,
        ).first
        await selected_model.wait_for(
            state="visible", timeout=selectors.COST_SETTLE_TIMEOUT_MS
        )
        zero_cost = menu.locator(selectors.COST_LINK_CSS).filter(
            has_text=selectors.ZERO_COST_TEXT_PATTERN
        )
        try:
            await zero_cost.first.wait_for(
                state="visible", timeout=selectors.COST_SETTLE_TIMEOUT_MS
            )
        except PlaywrightTimeoutError:
            pass
        cost_links = menu.locator(selectors.COST_LINK_CSS).filter(
            has_text=selectors.COST_TEXT_PATTERN
        )
        for text in await cost_links.all_inner_texts():
            cost = parse_credit_cost(text)
            if cost is not None:
                logger.info("Google Flow generation cost verified: %d credits", cost)
                return cost
        logger.error("Google Flow generation cost could not be verified")
        return None

    async def submit_video_prompt(self, prompt: str) -> None:
        await self._page.keyboard.press("Escape")
        editor = self._page.locator(selectors.COMPOSER_EDITOR_CSS)
        await editor.click()
        await self._page.keyboard.insert_text(prompt)

        editor = self._page.locator(selectors.COMPOSER_EDITOR_CSS)
        composer = editor.locator(selectors.COMPOSER_CONTAINER_XPATH)
        submit_button = composer.locator(selectors.COMPOSER_BUTTON_CSS).nth(
            selectors.SUBMIT_BUTTON_INDEX
        )
        label = (await submit_button.inner_text()).strip()
        if not selectors.SUBMIT_BUTTON_NAME.search(label):
            raise FlowPageError("Google Flow submit control was not recognized")
        await submit_button.click()
        logger.info("One Google Flow video prompt was submitted")

        try:
            await self._wait_for_any_visible(
                [
                    self._page.get_by_text(selectors.PROGRESS_TEXT_PATTERN).first,
                    self._page.get_by_role(
                        selectors.IMAGE_ROLE, name=selectors.VIDEO_THUMBNAIL_NAME
                    ).first,
                ],
                self._navigation_timeout_ms,
            )
        except PlaywrightTimeoutError as error:
            if await self._authentication_required():
                raise FlowAuthRequiredError(
                    "manual Google Flow authentication is required"
                ) from error
            raise FlowPageError("Google Flow did not accept the video prompt") from error

    async def wait_generation(self, timeout_seconds: int) -> None:
        thumbnail = self._page.get_by_role(
            selectors.IMAGE_ROLE, name=selectors.VIDEO_THUMBNAIL_NAME
        ).first
        try:
            await thumbnail.wait_for(state="visible", timeout=timeout_seconds * 1_000)
        except PlaywrightTimeoutError as error:
            if await self._authentication_required():
                raise FlowAuthRequiredError(
                    "manual Google Flow authentication is required"
                ) from error
            progress = self._page.get_by_text(selectors.PROGRESS_TEXT_PATTERN).first
            if await progress.is_visible():
                raise FlowGenerationTimeoutError(
                    "Google Flow video generation timed out"
                ) from error
            failure = self._page.get_by_text(
                selectors.TERMINAL_FAILURE_TEXT_PATTERN
            ).first
            if await failure.is_visible():
                raise FlowResultError("Google Flow reported a generation failure") from error
            raise FlowGenerationTimeoutError(
                "Google Flow result did not appear before the timeout"
            ) from error

    async def detect_result(self) -> bool:
        thumbnail = self._page.get_by_role(
            selectors.IMAGE_ROLE, name=selectors.VIDEO_THUMBNAIL_NAME
        ).first
        if await thumbnail.is_visible():
            return True
        return await self._page.locator(selectors.VIDEO_CSS).first.is_visible()

    async def download_result(self, destination: Path) -> None:
        thumbnail = self._page.get_by_role(
            selectors.IMAGE_ROLE, name=selectors.VIDEO_THUMBNAIL_NAME
        ).first
        thumbnail_button = thumbnail.locator(selectors.THUMBNAIL_BUTTON_XPATH)
        if await thumbnail_button.count():
            await thumbnail_button.click()
        else:
            await thumbnail.click()

        download_button = self._page.get_by_role(
            selectors.BUTTON_ROLE, name=selectors.DOWNLOAD_BUTTON_NAME
        ).first
        await download_button.wait_for(
            state="visible", timeout=self._navigation_timeout_ms
        )

        temporary = destination.with_suffix(".mp4.part")
        try:
            async with self._page.expect_download(
                timeout=self._navigation_timeout_ms
            ) as download_info:
                await download_button.click()
            download = await download_info.value
            if not download.suggested_filename.lower().endswith(".mp4"):
                raise FlowDownloadError("Google Flow download is not an MP4 file")
            await download.save_as(str(temporary))
            validate_mp4(temporary)
            if destination.exists():
                raise FlowResultError("debug download destination already exists")
            temporary.replace(destination)
            logger.info("Google Flow video downloaded to %s", destination)
        except FlowPageError:
            temporary.unlink(missing_ok=True)
            raise
        except Exception as error:
            temporary.unlink(missing_ok=True)
            raise FlowDownloadError("failed to download the Google Flow MP4") from error

    async def _authentication_required(self) -> bool:
        if urlsplit(self._page.url).hostname == selectors.AUTH_URL_HOST:
            return True
        human_prompt = self._page.get_by_text(
            selectors.HUMAN_INTERACTION_TEXT_PATTERN
        ).first
        return await human_prompt.is_visible()

    def _composer_buttons(self) -> Any:
        editor = self._page.locator(selectors.COMPOSER_EDITOR_CSS)
        return editor.locator(selectors.COMPOSER_CONTAINER_XPATH).locator(
            selectors.COMPOSER_BUTTON_CSS
        )

    async def _open_settings_menu(self) -> Any:
        visible = await self._find_visible_menu()
        if visible is not None:
            return visible
        await self._composer_buttons().nth(selectors.CONFIG_BUTTON_INDEX).click()
        return await self._visible_settings_menu()

    async def _visible_settings_menu(self) -> Any:
        menus = self._page.get_by_role(selectors.MENU_ROLE)
        await menus.last.wait_for(state="visible", timeout=self._navigation_timeout_ms)
        visible = await self._find_visible_menu()
        if visible is None:
            raise FlowPageError("Google Flow settings menu is not visible")
        return visible

    async def _find_visible_menu(self) -> Any | None:
        menus = self._page.get_by_role(selectors.MENU_ROLE)
        for index in range(await menus.count() - 1, -1, -1):
            candidate = menus.nth(index)
            if not await candidate.is_visible():
                continue
            cost_labels = candidate.locator(selectors.COST_LINK_CSS).filter(
                has_text=selectors.COST_TEXT_PATTERN
            )
            video_tabs = candidate.get_by_role(
                selectors.TAB_ROLE,
                name=selectors.VIDEO_TAB_NAME,
            )
            if await cost_labels.count() or await video_tabs.count():
                return candidate
        return None

    @staticmethod
    async def _wait_for_any_visible(locators: list[Any], timeout_ms: int) -> Any:
        tasks = [
            asyncio.create_task(
                locator.wait_for(state="visible", timeout=timeout_ms)
            )
            for locator in locators
        ]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        successful = [task for task in done if task.exception() is None]
        if successful:
            return successful[0].result()
        first_error = next(iter(done)).exception()
        if first_error is not None:
            raise first_error
        raise PlaywrightTimeoutError("no expected Google Flow element became visible")
