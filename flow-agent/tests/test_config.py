from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.automation.browser.profiles import default_data_directory

ENVIRONMENT_VARIABLES = (
    "FLOW_AGENT_SERVICE_NAME",
    "FLOW_AGENT_VERSION",
    "FLOW_AGENT_HOST",
    "FLOW_AGENT_PORT",
    "FLOW_AGENT_CORS_ORIGINS",
    "FLOW_AGENT_LOG_LEVEL",
    "FLOW_AGENT_DATA_DIR",
    "FLOW_AGENT_BROWSER_PROFILE",
    "FLOW_AGENT_BROWSER_HEADLESS",
    "FLOW_AGENT_FLOW_URL",
    "FLOW_AGENT_NAVIGATION_TIMEOUT_MS",
    "FLOW_AGENT_GENERATION_TIMEOUT_SECONDS",
    "FLOW_AGENT_DOWNLOADS_DIR",
)


def clear_agent_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for variable in ENVIRONMENT_VARIABLES:
        monkeypatch.delenv(variable, raising=False)


def test_settings_use_loopback_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    clear_agent_environment(monkeypatch)
    settings = Settings(_env_file=None)

    assert settings.host == "127.0.0.1"
    assert settings.port == 8765
    assert settings.allowed_cors_origins == (
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    )
    assert settings.data_dir == default_data_directory()
    assert settings.browser_profile == "video"
    assert settings.browser_headless is False
    assert str(settings.flow_url) == "https://labs.google/fx/tools/flow"
    assert settings.navigation_timeout_ms == 60_000
    assert settings.generation_timeout_seconds == 900
    assert settings.downloads_dir.name == "debug"
    assert settings.error_logs_dir == settings.data_dir / "logs" / "errors"


def test_settings_read_flow_agent_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    clear_agent_environment(monkeypatch)
    monkeypatch.setenv("FLOW_AGENT_PORT", "9876")
    monkeypatch.setenv("FLOW_AGENT_CORS_ORIGINS", "http://localhost:4000")
    monkeypatch.setenv("FLOW_AGENT_BROWSER_PROFILE", "images")
    monkeypatch.setenv("FLOW_AGENT_BROWSER_HEADLESS", "true")
    monkeypatch.setenv("FLOW_AGENT_GENERATION_TIMEOUT_SECONDS", "120")
    monkeypatch.setenv("FLOW_AGENT_DOWNLOADS_DIR", "custom-downloads")

    settings = Settings(_env_file=None)

    assert settings.port == 9876
    assert settings.allowed_cors_origins == ("http://localhost:4000",)
    assert settings.browser_profile == "images"
    assert settings.browser_headless is True
    assert settings.generation_timeout_seconds == 120
    assert settings.downloads_dir == Path("custom-downloads")


def test_settings_reject_non_loopback_bind_address(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clear_agent_environment(monkeypatch)
    with pytest.raises(ValidationError):
        Settings(host="0.0.0.0", _env_file=None)


def test_settings_reject_wildcard_cors(monkeypatch: pytest.MonkeyPatch) -> None:
    clear_agent_environment(monkeypatch)
    with pytest.raises(ValidationError):
        Settings(cors_origins="*", _env_file=None)


@pytest.mark.parametrize("profile", ["../video", "video/profile", "", "a b"])
def test_settings_reject_unsafe_profile_names(
    monkeypatch: pytest.MonkeyPatch,
    profile: str,
) -> None:
    clear_agent_environment(monkeypatch)
    with pytest.raises(ValidationError):
        Settings(browser_profile=profile, _env_file=None)


def test_settings_requires_https_flow_url(monkeypatch: pytest.MonkeyPatch) -> None:
    clear_agent_environment(monkeypatch)
    with pytest.raises(ValidationError):
        Settings(flow_url="http://labs.google/fx/tools/flow", _env_file=None)
