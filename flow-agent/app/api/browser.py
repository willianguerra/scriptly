from fastapi import APIRouter, HTTPException, Request, status

from app.automation.browser.manager import (
    BrowserCloseError,
    BrowserLaunchError,
    BrowserManager,
    BrowserNotRunningError,
    FlowNavigationError,
)
from app.automation.browser.models import (
    BrowserClosedResponse,
    BrowserOpenedResponse,
    BrowserStatus,
    FlowOpenedResponse,
)

router = APIRouter(tags=["browser"])


def get_browser_manager(request: Request) -> BrowserManager:
    return request.app.state.browser_manager


@router.post("/browser/open", response_model=BrowserOpenedResponse)
async def open_browser(request: Request) -> BrowserOpenedResponse:
    try:
        await get_browser_manager(request).open()
    except BrowserLaunchError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "BROWSER_OPEN_FAILED", "message": str(error)},
        ) from error
    return BrowserOpenedResponse()


@router.post("/browser/close", response_model=BrowserClosedResponse)
async def close_browser(request: Request) -> BrowserClosedResponse:
    try:
        await get_browser_manager(request).close()
    except BrowserCloseError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "BROWSER_CLOSE_FAILED", "message": str(error)},
        ) from error
    return BrowserClosedResponse()


@router.get("/browser/status", response_model=BrowserStatus)
async def browser_status(request: Request) -> BrowserStatus:
    return await get_browser_manager(request).get_status()


@router.post("/flow/open", response_model=FlowOpenedResponse)
async def open_flow(request: Request) -> FlowOpenedResponse:
    try:
        await get_browser_manager(request).open_flow()
    except BrowserNotRunningError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "BROWSER_NOT_RUNNING", "message": str(error)},
        ) from error
    except FlowNavigationError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "FLOW_NAVIGATION_FAILED", "message": str(error)},
        ) from error
    return FlowOpenedResponse()
