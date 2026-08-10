from pathlib import Path


def allocate_download_path(directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    for sequence in range(1, 10_000):
        candidate = directory / f"{sequence:04d}.mp4"
        if not candidate.exists() and not candidate.with_suffix(".mp4.part").exists():
            return candidate
    raise RuntimeError("no available debug download filename")


def validate_mp4(path: Path) -> None:
    if not path.is_file() or path.stat().st_size < 12:
        raise ValueError("download is not a valid MP4 file")
    with path.open("rb") as stream:
        header = stream.read(12)
    if header[4:8] != b"ftyp":
        raise ValueError("download is not a valid MP4 file")

