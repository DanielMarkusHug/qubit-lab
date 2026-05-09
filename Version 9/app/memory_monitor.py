"""Container memory telemetry helpers for Version 9 worker jobs."""

from __future__ import annotations

import datetime as dt
import time
from pathlib import Path
from typing import Any

from app.schemas import json_safe


BYTES_PER_GIB = 1024 ** 3
DEFAULT_MEMORY_SAMPLE_INTERVAL_SEC = 10.0
DEFAULT_MEMORY_HISTORY_LIMIT = 720


def get_memory_used_bytes(cgroup_root: str | Path = "/sys/fs/cgroup") -> int | None:
    root = Path(cgroup_root)
    value = _read_int(root / "memory.current")
    if value is not None:
        return value
    return _read_int(root / "memory" / "memory.usage_in_bytes")


def get_memory_limit_bytes(cgroup_root: str | Path = "/sys/fs/cgroup") -> int | None:
    root = Path(cgroup_root)
    value = _read_limit(root / "memory.max")
    if value is not None:
        return value
    return _read_limit(root / "memory" / "memory.limit_in_bytes")


def get_memory_snapshot(
    *,
    cgroup_root: str | Path = "/sys/fs/cgroup",
    peak_memory_used_bytes: int | None = None,
) -> dict[str, Any]:
    used_bytes = get_memory_used_bytes(cgroup_root)
    limit_bytes = get_memory_limit_bytes(cgroup_root)
    peak_bytes = max(_int_or_zero(peak_memory_used_bytes), _int_or_zero(used_bytes)) if used_bytes is not None else peak_memory_used_bytes

    used_gib = _bytes_to_gib(used_bytes)
    limit_gib = _bytes_to_gib(limit_bytes)
    remaining_gib = (
        max(float(limit_gib) - float(used_gib), 0.0)
        if used_gib is not None and limit_gib is not None
        else None
    )
    used_pct = (
        (float(used_bytes) / float(limit_bytes)) * 100.0
        if used_bytes is not None and limit_bytes not in (None, 0)
        else None
    )
    return json_safe(
        {
            "memory_used_gib": used_gib,
            "memory_limit_gib": limit_gib,
            "memory_remaining_gib": remaining_gib,
            "memory_used_pct": used_pct,
            "peak_memory_used_gib": _bytes_to_gib(peak_bytes),
        }
    )


class MemoryTracker:
    def __init__(
        self,
        *,
        cgroup_root: str | Path = "/sys/fs/cgroup",
        sample_interval_sec: float = DEFAULT_MEMORY_SAMPLE_INTERVAL_SEC,
        history_limit: int = DEFAULT_MEMORY_HISTORY_LIMIT,
    ):
        self.cgroup_root = Path(cgroup_root)
        self.sample_interval_sec = float(max(sample_interval_sec, 0.0))
        self.history_limit = int(max(history_limit, 1))
        self.peak_memory_used_bytes: int | None = None
        self.history: list[dict[str, Any]] = []
        self.last_sample_monotonic = 0.0
        self.latest_snapshot: dict[str, Any] = get_memory_snapshot(cgroup_root=self.cgroup_root)

    def snapshot(self, *, elapsed_sec: float | None = None, force: bool = False) -> dict[str, Any]:
        used_bytes = get_memory_used_bytes(self.cgroup_root)
        if used_bytes is not None:
            self.peak_memory_used_bytes = max(_int_or_zero(self.peak_memory_used_bytes), int(used_bytes))

        snapshot = get_memory_snapshot(
            cgroup_root=self.cgroup_root,
            peak_memory_used_bytes=self.peak_memory_used_bytes,
        )
        self.latest_snapshot = snapshot

        now = time.perf_counter()
        should_sample = force or not self.history or (now - self.last_sample_monotonic) >= self.sample_interval_sec
        if should_sample:
            self.last_sample_monotonic = now
            point = {
                "timestamp": _utc_now(),
                "elapsed_sec": elapsed_sec,
                "memory_used_gib": snapshot.get("memory_used_gib"),
                "memory_limit_gib": snapshot.get("memory_limit_gib"),
                "memory_remaining_gib": snapshot.get("memory_remaining_gib"),
                "memory_used_pct": snapshot.get("memory_used_pct"),
            }
            self.history.append(json_safe(point))
            self.history = self.history[-self.history_limit :]

        return self.payload()

    def payload(self) -> dict[str, Any]:
        return json_safe({**self.latest_snapshot, "memory_history": list(self.history)})


def _read_int(path: Path) -> int | None:
    try:
        raw = path.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _read_limit(path: Path) -> int | None:
    try:
        raw = path.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    if raw.lower() == "max":
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None
    return value


def _bytes_to_gib(value: int | None) -> float | None:
    if value is None:
        return None
    return float(value) / BYTES_PER_GIB


def _int_or_zero(value: int | None) -> int:
    return 0 if value is None else int(value)


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
