from pathlib import Path

import pytest

from app.automation.flow.downloads import allocate_download_path, validate_mp4
from app.automation.flow.selectors import parse_credit_cost


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("0 créditos", 0),
        (" 0 CRÉDITOS ", 0),
        ("12 créditos", 12),
        ("1 credit", 1),
    ],
)
def test_parse_credit_cost(text: str, expected: int) -> None:
    assert parse_credit_cost(text) == expected


@pytest.mark.parametrize("text", ["", "gratuito", "—", "créditos", "0,5 créditos"])
def test_parse_credit_cost_fails_closed(text: str) -> None:
    assert parse_credit_cost(text) is None


def test_allocate_download_path_never_overwrites_existing_file(tmp_path: Path) -> None:
    (tmp_path / "0001.mp4").write_bytes(b"existing")

    assert allocate_download_path(tmp_path).name == "0002.mp4"


def test_validate_mp4_checks_size_and_ftyp_signature(tmp_path: Path) -> None:
    valid = tmp_path / "valid.mp4"
    invalid = tmp_path / "invalid.mp4"
    valid.write_bytes(b"\x00\x00\x00\x18ftypisompayload")
    invalid.write_bytes(b"not an mp4")

    validate_mp4(valid)
    with pytest.raises(ValueError, match="valid MP4"):
        validate_mp4(invalid)

