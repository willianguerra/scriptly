from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.config import Settings

router = APIRouter(tags=["agent"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str


class StatusResponse(BaseModel):
    agent: Literal["ready"]
    browser: Literal["stopped"]
    flow: Literal["unknown"]


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings: Settings = request.app.state.settings
    return HealthResponse(
        status="ok",
        service=settings.service_name,
        version=settings.version,
    )


@router.get("/status", response_model=StatusResponse)
async def status() -> StatusResponse:
    return StatusResponse(agent="ready", browser="stopped", flow="unknown")
