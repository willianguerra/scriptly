"""Run the opt-in, sequential 10-generation manual validation."""

import argparse
import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate ten sequential free Flow video generations."
    )
    parser.add_argument(
        "--endpoint",
        default="http://127.0.0.1:8765/debug/generate-video",
    )
    parser.add_argument(
        "--prompt",
        default="Ocean waves at sunrise, static camera, natural light",
    )
    parser.add_argument(
        "--confirm-zero-credits",
        action="store_true",
        help="Required confirmation that the Flow UI currently displays 0 credits.",
    )
    return parser.parse_args()


def generate(endpoint: str, prompt: str) -> dict[str, object]:
    payload = json.dumps({"prompt": prompt}).encode("utf-8")
    request = Request(
        endpoint,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=1_200) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    args = parse_args()
    if not args.confirm_zero_credits:
        print(
            "Refusing to start: visually confirm '0 créditos' and pass "
            "--confirm-zero-credits.",
            file=sys.stderr,
        )
        return 2

    files: set[Path] = set()
    try:
        for sequence in range(1, 11):
            result = generate(args.endpoint, f"{args.prompt} [validation {sequence:02d}/10]")
            if result.get("status") != "completed":
                print(f"Generation {sequence:02d} failed: {result}", file=sys.stderr)
                return 1
            output = Path(str(result["file"]))
            if not output.is_file() or output in files:
                print(f"Invalid or duplicate output: {output}", file=sys.stderr)
                return 1
            files.add(output)
            print(f"{sequence:02d}/10 completed: {output}")
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        print(f"Validation stopped: {error}", file=sys.stderr)
        return 1

    print("10/10 sequential generations completed with distinct files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
