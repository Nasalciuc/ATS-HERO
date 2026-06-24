"""Loads the shared JSON data (single source of truth) from packages/shared/data.

Resolution order:
  1. ATS_AI_SHARED_DATA_DIR env var, if set.
  2. Walk up from this file until a `packages/shared/data` directory is found
     (works in the monorepo and in the standalone zip, which preserves that layout).
Raises a clear error if the data cannot be located, so misconfiguration fails loudly.
"""
import json
import os
from functools import lru_cache
from pathlib import Path


def _find_data_dir() -> Path:
    override = os.environ.get("ATS_AI_SHARED_DATA_DIR")
    if override:
        p = Path(override)
        if p.is_dir():
            return p
        raise FileNotFoundError(f"ATS_AI_SHARED_DATA_DIR is set but not a directory: {override}")

    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "packages" / "shared" / "data"
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError(
        "Could not locate packages/shared/data. Set ATS_AI_SHARED_DATA_DIR or run inside the monorepo."
    )


@lru_cache(maxsize=None)
def load(name: str) -> dict:
    """Load and cache a shared JSON file by stem, e.g. load('weak-phrases')."""
    data_dir = _find_data_dir()
    path = data_dir / f"{name}.json"
    if not path.is_file():
        raise FileNotFoundError(f"Shared data file not found: {path}")
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)
