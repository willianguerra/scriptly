from functools import lru_cache
from ipaddress import ip_address
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app import __version__
from app.automation.browser.profiles import (
    default_data_directory,
    validate_profile_name,
)


class Settings(BaseSettings):
    """Configuration loaded from FLOW_AGENT_* environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="FLOW_AGENT_",
        extra="ignore",
    )

    service_name: str = "scriptly-flow-agent"
    version: str = __version__
    host: str = "127.0.0.1"
    port: int = Field(default=8765, ge=1, le=65535)
    cors_origins: str = "http://127.0.0.1:3000,http://localhost:3000"
    log_level: Literal["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"] = "INFO"
    data_dir: Path = Field(default_factory=default_data_directory)
    browser_profile: str = "video"
    browser_headless: bool = False
    flow_url: AnyHttpUrl = "https://labs.google/fx/tools/flow"
    navigation_timeout_ms: int = Field(default=60_000, ge=1_000, le=300_000)

    @field_validator("host")
    @classmethod
    def require_loopback_host(cls, value: str) -> str:
        host = value.strip()
        if host.lower() == "localhost":
            return host
        try:
            address = ip_address(host)
        except ValueError as error:
            raise ValueError("host must be a loopback address") from error
        if not address.is_loopback:
            raise ValueError("host must be a loopback address")
        return host

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        origins = [origin.strip().rstrip("/") for origin in value.split(",")]
        if not origins or any(not origin or origin == "*" for origin in origins):
            raise ValueError("CORS origins must be an explicit comma-separated list")

        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.netloc
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError(f"invalid CORS origin: {origin}")
        return ",".join(origins)

    @field_validator("browser_profile")
    @classmethod
    def validate_browser_profile(cls, value: str) -> str:
        return validate_profile_name(value)

    @field_validator("flow_url")
    @classmethod
    def require_https_flow_url(cls, value: AnyHttpUrl) -> AnyHttpUrl:
        if value.scheme != "https":
            raise ValueError("Flow URL must use HTTPS")
        return value

    @property
    def allowed_cors_origins(self) -> tuple[str, ...]:
        return tuple(self.cors_origins.split(","))


@lru_cache
def get_settings() -> Settings:
    return Settings()
