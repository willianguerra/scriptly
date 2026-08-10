import pytest
from pydantic import ValidationError

from app.config import Settings

ENVIRONMENT_VARIABLES = (
    "FLOW_AGENT_SERVICE_NAME",
    "FLOW_AGENT_VERSION",
    "FLOW_AGENT_HOST",
    "FLOW_AGENT_PORT",
    "FLOW_AGENT_CORS_ORIGINS",
    "FLOW_AGENT_LOG_LEVEL",
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


def test_settings_read_flow_agent_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    clear_agent_environment(monkeypatch)
    monkeypatch.setenv("FLOW_AGENT_PORT", "9876")
    monkeypatch.setenv("FLOW_AGENT_CORS_ORIGINS", "http://localhost:4000")

    settings = Settings(_env_file=None)

    assert settings.port == 9876
    assert settings.allowed_cors_origins == ("http://localhost:4000",)


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
