import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.browser import router as browser_router
from app.api.debug import router as debug_router
from app.api.health import router as health_router
from app.automation.browser.manager import BrowserManager
from app.automation.flow.provider import FlowProvider
from app.config import Settings, get_settings


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def create_app(
    settings: Settings | None = None,
    browser_manager: Any | None = None,
    flow_provider: Any | None = None,
) -> FastAPI:
    resolved_settings = settings or get_settings()
    configure_logging(resolved_settings.log_level)
    resolved_browser_manager = browser_manager or BrowserManager(resolved_settings)
    resolved_flow_provider = flow_provider or FlowProvider(
        resolved_browser_manager,
        resolved_settings,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await resolved_browser_manager.close()

    application = FastAPI(
        title=resolved_settings.service_name,
        version=resolved_settings.version,
        lifespan=lifespan,
    )
    application.state.settings = resolved_settings
    application.state.browser_manager = resolved_browser_manager
    application.state.flow_provider = resolved_flow_provider

    @application.middleware("http")
    async def reject_untrusted_mutating_origin(
        request: Request,
        call_next: Any,
    ) -> Any:
        origin = request.headers.get("origin")
        if (
            request.method in {"POST", "PUT", "PATCH", "DELETE"}
            and origin is not None
            and origin.rstrip("/") not in resolved_settings.allowed_cors_origins
        ):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "detail": {
                        "code": "ORIGIN_NOT_ALLOWED",
                        "message": "request origin is not allowed",
                    }
                },
            )
        return await call_next(request)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Accept", "Content-Type"],
    )
    application.include_router(health_router)
    application.include_router(browser_router)
    application.include_router(debug_router)
    return application


app = create_app()


def run() -> None:
    settings = get_settings()
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    run()
