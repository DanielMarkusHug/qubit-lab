"""API-key helpers backed by the Version 7 mock key store."""

from __future__ import annotations

from app.config import Config
from app.schemas import ApiError
from app.usage_policy import resolve_usage_context


def validate_api_key(api_key: str | None) -> bool:
    if not api_key:
        return False
    resolve_usage_context(api_key)
    return True


def require_api_key(api_key: str | None) -> None:
    if not api_key:
        raise ApiError(
            401,
            "invalid_api_key",
            f"Missing or invalid {Config.API_KEY_HEADER} header.",
        )
    validate_api_key(api_key)
