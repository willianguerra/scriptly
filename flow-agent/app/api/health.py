from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.config import Settings
from app.automation.browser.manager import BrowserManager

router = APIRouter(tags=["agent"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str


class StatusResponse(BaseModel):
    agent: Literal["ready"]
    browser: Literal["running", "stopped"]
    flow: Literal["opened", "unknown"]


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings: Settings = request.app.state.settings
    return HealthResponse(
        status="ok",
        service=settings.service_name,
        version=settings.version,
    )


@router.get("/status", response_model=StatusResponse)
async def status(request: Request) -> StatusResponse:
    browser_manager: BrowserManager = request.app.state.browser_manager
    browser_status = await browser_manager.get_status()
    return StatusResponse(
        agent="ready",
        browser="running" if browser_status.running else "stopped",
        flow="opened" if browser_manager.flow_opened else "unknown",
    )
