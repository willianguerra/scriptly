from pathlib import Path

import pytest

from app.automation.browser.profiles import (
    ensure_profile_directory,
    profile_directory,
)


def test_profile_directory_is_nested_under_profiles_root(tmp_path: Path) -> None:
    result = profile_directory(tmp_path, "video")

    assert result == (tmp_path / "profiles" / "video").resolve()


def test_ensure_profile_directory_creates_the_directory(tmp_path: Path) -> None:
    result = ensure_profile_directory(tmp_path, "video")

    assert result.is_dir()


@pytest.mark.parametrize("profile", ["../video", "video/other", "video\\other"])
def test_profile_directory_rejects_path_traversal(
    tmp_path: Path,
    profile: str,
) -> None:
    with pytest.raises(ValueError):
        profile_directory(tmp_path, profile)
