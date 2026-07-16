from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def runtime_directory() -> Path:
    path = Path(__file__).resolve().parents[1] / "runtime"
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_state(payload: dict[str, Any], filename: str = "state.json") -> Path:
    target = runtime_directory() / filename
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    os.replace(temporary, target)
    return target
