"""Validation and effective-setting helpers for user-controlled random seeds."""

from __future__ import annotations

import math
import numbers
from typing import Any

from app.schemas import ApiError


RANDOM_SEED_MIN = 0
RANDOM_SEED_MAX = 2**32 - 1
RANDOM_SEED_KEYS = ("random_seed", "rng_seed")


def parse_random_seed(raw: Any, field_name: str = "random_seed") -> int | None:
    if raw is None:
        return None
    if isinstance(raw, str) and raw.strip() == "":
        return None

    value: int
    if isinstance(raw, bool):
        raise _invalid_seed(field_name)
    if isinstance(raw, numbers.Integral):
        value = int(raw)
    elif isinstance(raw, numbers.Real):
        if not math.isfinite(float(raw)) or not float(raw).is_integer():
            raise _invalid_seed(field_name)
        value = int(raw)
    else:
        text = str(raw).strip()
        if not text or not text.lstrip("+-").isdigit():
            raise _invalid_seed(field_name)
        value = int(text)

    if value < RANDOM_SEED_MIN or value > RANDOM_SEED_MAX:
        raise ApiError(
            400,
            "invalid_random_seed",
            f"random_seed must be between {RANDOM_SEED_MIN} and {RANDOM_SEED_MAX}.",
            {
                "field": field_name,
                "requested": value,
                "min": RANDOM_SEED_MIN,
                "max": RANDOM_SEED_MAX,
            },
        )
    return value


def form_random_seed(form_data: Any | None) -> int | None:
    raw = _first_mapping_value(form_data, RANDOM_SEED_KEYS)
    return parse_random_seed(raw) if raw is not None else None


def workbook_random_seed(optimizer) -> int | None:
    settings = getattr(optimizer, "settings", {}) or {}
    raw = _first_mapping_value(settings, RANDOM_SEED_KEYS)
    return parse_random_seed(raw) if raw is not None else None


def effective_random_seed(optimizer, form_data: Any | None = None) -> int | None:
    form_seed = form_random_seed(form_data)
    if form_seed is not None:
        return form_seed
    return workbook_random_seed(optimizer)


def random_seed_source(form_data: Any | None, settings: dict[str, Any] | None) -> str:
    if _first_mapping_value(form_data, RANDOM_SEED_KEYS) is not None:
        return "form"
    if _first_mapping_value(settings or {}, RANDOM_SEED_KEYS) is not None:
        return "workbook"
    return "backend_default"


def random_seed_display(seed: int | None) -> str:
    return str(seed) if seed is not None else "auto"


def _invalid_seed(field_name: str) -> ApiError:
    return ApiError(
        400,
        "invalid_random_seed",
        "random_seed must be an integer.",
        {
            "field": field_name,
            "min": RANDOM_SEED_MIN,
            "max": RANDOM_SEED_MAX,
        },
    )


def _first_mapping_value(mapping: Any | None, keys: tuple[str, ...]) -> Any | None:
    if mapping is None:
        return None
    for key in keys:
        try:
            raw_value = mapping.get(key)
        except AttributeError:
            raw_value = None
        if raw_value is None or (isinstance(raw_value, str) and raw_value.strip() == ""):
            continue
        return raw_value
    return None
