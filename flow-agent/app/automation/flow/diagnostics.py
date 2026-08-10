import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from app.automation.flow.models import GenerationExecution


def sanitized_url(value: str) -> str:
    parsed = urlsplit(value)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


async def write_error_diagnostics(
    flow_page: Any,
    directory: Path,
    execution: GenerationExecution,
    error_code: str,
    error_message: str,
) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
    screenshot_path = directory / f"{stamp}.png"
    metadata_path = directory / f"{stamp}.json"

    try:
        await flow_page.capture_screenshot(screenshot_path)
    except Exception:
        screenshot_path = None

    metadata = {
        "recorded_at": datetime.now(UTC).isoformat(timespec="milliseconds"),
        "state": execution.state.value,
        "history": [
            {"state": item.state.value, "recorded_at": item.recorded_at}
            for item in execution.history
        ],
        "error_code": error_code,
        "error_message": error_message,
        "url": sanitized_url(flow_page.current_url()),
        "screenshot": screenshot_path.name if screenshot_path else None,
    }
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

