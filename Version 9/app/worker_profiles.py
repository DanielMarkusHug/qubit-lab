"""Worker profile configuration for Version 9 Cloud Run Job execution."""

from __future__ import annotations

import os
from typing import Any

from app.schemas import ApiError, json_safe


DEFAULT_WORKER_PROFILE = "small"
QAOA_SIMULATION_MODES = {"qaoa_lightning_sim", "qaoa_tensor_sim"}
WORKER_PROFILE_ORDER = {"small": 0, "medium": 1, "large": 2}
QAOA_SIMULATION_PROFILE_LIMITS = (
    ("small", 18),
    ("medium", 25),
    ("large", None),
)

WORKER_PROFILES: dict[str, dict[str, Any]] = {
    "small": {
        "label": "Small",
        "job_name": "qaoa-rqp-worker-small",
        "cpu": 2,
        "memory_gib": 2,
        "allowed_levels": ["demo", "trial", "power"],
        "description": "For small examples and quick tests",
        "required_level": None,
    },
    "medium": {
        "label": "Medium",
        "job_name": "qaoa-rqp-worker-medium",
        "cpu": 4,
        "memory_gib": 4,
        "allowed_levels": ["trial", "power"],
        "description": "For larger simulations",
        "required_level": "trial",
    },
    "large": {
        "label": "Large",
        "job_name": "qaoa-rqp-worker-large",
        "cpu": 4,
        "memory_gib": 8,
        "allowed_levels": ["power"],
        "description": "For heavy QAOA runs",
        "required_level": "power",
    },
}


USAGE_LEVEL_TIERS = {
    "public_demo": "demo",
    "qualified_demo": "demo",
    "tester": "trial",
    "internal_power": "power",
    "internal_qaoa_30": "power",
    "internal_ultra": "power",
}


def normalize_worker_profile(raw_profile: str | None) -> str:
    profile = (raw_profile or DEFAULT_WORKER_PROFILE).strip().lower()
    if not profile:
        profile = DEFAULT_WORKER_PROFILE
    if profile not in WORKER_PROFILES:
        raise ApiError(
            400,
            "invalid_worker_profile",
            "Unsupported worker_profile.",
            {
                "worker_profile": profile,
                "supported_worker_profiles": list(WORKER_PROFILES),
            },
        )
    return profile


def worker_tier_for_usage_level(usage_level_name: str | None) -> str:
    return USAGE_LEVEL_TIERS.get(str(usage_level_name or "").strip().lower(), "demo")


def validate_worker_profile_allowed(usage_context, worker_profile: str) -> str:
    profile = normalize_worker_profile(worker_profile)
    tier = worker_tier_for_usage_level(getattr(usage_context, "usage_level_name", None))
    if tier not in WORKER_PROFILES[profile]["allowed_levels"]:
        raise ApiError(
            403,
            "worker_profile_not_allowed",
            f"Worker profile '{profile}' is not available for this key level.",
            {
                "worker_profile": profile,
                "usage_level": getattr(usage_context, "usage_level_name", None),
                "usage_tier": tier,
                "allowed_worker_profiles": allowed_worker_profiles(usage_context),
            },
        )
    return profile


def minimum_worker_profile_for_problem(*, n_qubits: int | None, mode: str | None) -> str | None:
    normalized_mode = str(mode or "").strip().lower()
    if normalized_mode not in QAOA_SIMULATION_MODES:
        return None
    try:
        qubits = int(n_qubits or 0)
    except Exception:
        qubits = 0
    if qubits <= 0:
        return None
    for profile_id, max_qubits in QAOA_SIMULATION_PROFILE_LIMITS:
        if max_qubits is None or qubits <= int(max_qubits):
            return str(profile_id)
    return None


def validate_worker_profile_capacity(
    usage_context,
    worker_profile: str,
    *,
    n_qubits: int | None,
    mode: str | None,
) -> str:
    profile = normalize_worker_profile(worker_profile)
    required_profile = minimum_worker_profile_for_problem(n_qubits=n_qubits, mode=mode)
    if required_profile is None:
        return profile
    if WORKER_PROFILE_ORDER[profile] >= WORKER_PROFILE_ORDER[required_profile]:
        return profile
    required_info = WORKER_PROFILES[required_profile]
    selected_info = WORKER_PROFILES[profile]
    raise ApiError(
        403,
        "worker_profile_insufficient",
        (
            f"{int(n_qubits or 0)} qubits in {mode} require at least the "
            f"{required_info['label']} worker profile."
        ),
        {
            "worker_profile": profile,
            "required_worker_profile": required_profile,
            "selected_memory_gib": selected_info.get("memory_gib"),
            "required_memory_gib": required_info.get("memory_gib"),
            "n_qubits": int(n_qubits or 0),
            "mode": mode,
            "usage_level": getattr(usage_context, "usage_level_name", None),
            "allowed_worker_profiles": allowed_worker_profiles(usage_context),
        },
    )


def allowed_worker_profiles(usage_context) -> list[str]:
    tier = worker_tier_for_usage_level(getattr(usage_context, "usage_level_name", None))
    return [
        profile_id
        for profile_id, profile in WORKER_PROFILES.items()
        if tier in profile.get("allowed_levels", [])
    ]


def worker_profile_job_name(worker_profile: str) -> str:
    profile = WORKER_PROFILES[normalize_worker_profile(worker_profile)]
    env_name = f"QAOA_WORKER_JOB_{worker_profile.upper()}_NAME"
    return os.getenv(env_name) or str(profile["job_name"])


def worker_profile_metadata(worker_profile: str) -> dict[str, Any]:
    profile_id = normalize_worker_profile(worker_profile)
    profile = WORKER_PROFILES[profile_id]
    return json_safe(
        {
            "worker_profile": profile_id,
            "worker_profile_label": profile["label"],
            "worker_job_name": worker_profile_job_name(profile_id),
            "configured_cpu": profile["cpu"],
            "configured_memory_gib": profile["memory_gib"],
            "memory_used_gib": None,
            "memory_limit_gib": None,
            "memory_remaining_gib": None,
            "memory_used_pct": None,
            "peak_memory_used_gib": None,
            "memory_history": [],
        }
    )


def worker_profiles_payload(usage_context=None) -> dict[str, Any]:
    allowed = set(allowed_worker_profiles(usage_context)) if usage_context is not None else set(WORKER_PROFILES)
    return json_safe(
        {
            profile_id: {
                "label": profile["label"],
                "cpu": profile["cpu"],
                "memory_gib": profile["memory_gib"],
                "description": profile["description"],
                "enabled": profile_id in allowed,
                "required_level": profile.get("required_level"),
            }
            for profile_id, profile in WORKER_PROFILES.items()
        }
    )
