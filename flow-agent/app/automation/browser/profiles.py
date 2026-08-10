import os
import re
import sys
from pathlib import Path

PROFILE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def default_data_directory() -> Path:
    """Return an OS-specific application data directory outside the source tree."""
    if sys.platform == "win32":
        local_app_data = os.environ.get("LOCALAPPDATA")
        base = Path(local_app_data) if local_app_data else Path.home() / "AppData" / "Local"
        return (base / "ScriptlyFlowAgent").resolve()

    if sys.platform == "darwin":
        return (Path.home() / "Library" / "Application Support" / "ScriptlyFlowAgent").resolve()

    xdg_data_home = os.environ.get("XDG_DATA_HOME")
    base = Path(xdg_data_home) if xdg_data_home else Path.home() / ".local" / "share"
    return (base / "ScriptlyFlowAgent").resolve()


def validate_profile_name(profile: str) -> str:
    if not PROFILE_NAME_PATTERN.fullmatch(profile):
        raise ValueError(
            "browser profile must contain only letters, numbers, underscores, or hyphens"
        )
    return profile


def profile_directory(data_directory: Path, profile: str) -> Path:
    safe_profile = validate_profile_name(profile)
    profiles_root = (data_directory.expanduser() / "profiles").resolve()
    resolved_profile = (profiles_root / safe_profile).resolve()

    if not resolved_profile.is_relative_to(profiles_root):
        raise ValueError("browser profile must remain inside the profiles directory")
    return resolved_profile


def ensure_profile_directory(data_directory: Path, profile: str) -> Path:
    directory = profile_directory(data_directory, profile)
    directory.mkdir(parents=True, exist_ok=True)
    return directory
