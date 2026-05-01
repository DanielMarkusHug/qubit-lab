"""Small response and serialization helpers for the Flask API."""

from __future__ import annotations

import datetime as _dt
import math
import uuid
from typing import Any

try:
    import numpy as _np
except Exception:  # pragma: no cover - optional at import time
    _np = None

try:
    import pandas as _pd
except Exception:  # pragma: no cover - optional at import time
    _pd = None


class ApiError(Exception):
    """User-facing API error with an HTTP status code."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Any | None = None,
        license_info: Any | None = None,
    ):
        super().__init__(message)
        self.status_code = int(status_code)
        self.code = str(code)
        self.message = str(message)
        self.details = details
        self.license_info = license_info

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "status": "error",
            "error": {
                "code": self.code,
                "message": self.message,
            },
        }
        if self.details is not None:
            payload["error"]["details"] = json_safe(self.details)
        if self.license_info is not None:
            payload["license"] = json_safe(self.license_info)
        return payload


def make_run_id() -> str:
    return f"run_{uuid.uuid4().hex}"


def json_safe(value: Any) -> Any:
    """Convert pandas/numpy scalars, NaN, and datetimes into JSON-safe values."""

    if value is None:
        return None

    if _np is not None:
        if isinstance(value, _np.generic):
            return json_safe(value.item())
        if isinstance(value, _np.ndarray):
            return [json_safe(item) for item in value.tolist()]

    if _pd is not None:
        try:
            if _pd.isna(value):
                return None
        except (TypeError, ValueError):
            pass

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    if isinstance(value, (_dt.datetime, _dt.date, _dt.time)):
        return value.isoformat()

    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]

    return value
