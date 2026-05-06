"""YAML-backed usage policy and HMAC API-key verification."""

from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import os
import copy
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.config import Config
from app.key_store import clear_key_store_cache, get_key_store
from app.random_seed import effective_random_seed, random_seed_source
from app.schemas import ApiError, json_safe


CANONICAL_MODES = ("classical_only", "qaoa_limited", "qaoa_full")
QAOA_MODE_ALIASES = {"qaoa": "qaoa_full"}
QAOA_MODES = {"qaoa_limited", "qaoa_full"}
QAOA_DISABLED_MODES = {"qaoa_full"}
LOCAL_DEV_FALLBACK_SECRET = "qaoa-rqp-local-dev-secret-v1"
DEFAULT_RESPONSE_LEVEL = "full"


@dataclass(frozen=True)
class UsageContext:
    usage_level_name: str
    usage_level: dict[str, Any]
    key_record: dict[str, Any] | None = None
    authenticated: bool = False

    @property
    def identity(self) -> dict[str, Any]:
        payload = {
            "usage_level": self.usage_level_name,
            "usage_level_id": self.usage_level.get("level_id"),
            "display_name": self.usage_level.get("display_name"),
            "authenticated": self.authenticated,
        }
        if self.key_record and self.usage_level.get("show_identity", False):
            payload.update(
                {
                    "key_id": self.key_record.get("key_id"),
                    "name": self.key_record.get("name"),
                    "email": self.key_record.get("email"),
                    "organization": self.key_record.get("organization"),
                    "status": self.key_record.get("status"),
                }
            )
        return json_safe(payload)


@dataclass(frozen=True)
class RuntimeInputs:
    layers: int
    iterations: int
    restarts: int
    warm_start: bool = False
    qaoa_shots: int | None = None
    restart_perturbation: float | None = None
    random_seed: int | None = None


@dataclass(frozen=True)
class PolicyResult:
    runtime_inputs: RuntimeInputs
    estimated_runtime_sec: float
    raw_estimated_runtime_sec: float
    max_estimated_runtime_sec: float
    within_limit: bool
    n_qubits: int
    candidate_count: int
    runtime_limit_source: str = "usage_level"
    effective_settings: dict[str, Any] = field(default_factory=dict)


def resolve_usage_context(api_key: str | None) -> UsageContext:
    usage_config = load_usage_config()
    usage_levels = usage_config["usage_levels"]

    if not api_key:
        return UsageContext(
            usage_level_name="public_demo",
            usage_level=usage_levels["public_demo"],
            key_record=None,
            authenticated=False,
        )

    key_record = get_key_store().find_key_by_hash(_hash_key(api_key))

    if key_record is None:
        raise ApiError(401, "invalid_api_key", f"Invalid {Config.API_KEY_HEADER} header.")

    _validate_key_record(key_record)
    level_name = str(key_record.get("level", ""))
    if level_name not in usage_levels:
        raise ApiError(403, "invalid_usage_level", "API key is mapped to an unknown usage level.")

    usage_level = copy.deepcopy(usage_levels[level_name])
    _apply_key_limit_overrides(usage_level, key_record)

    return UsageContext(
        usage_level_name=level_name,
        usage_level=usage_level,
        key_record=key_record,
        authenticated=True,
    )


def usage_context_from_key_record(key_record: dict[str, Any] | None) -> UsageContext:
    usage_config = load_usage_config()
    usage_levels = usage_config["usage_levels"]
    if not key_record:
        return UsageContext(
            usage_level_name="public_demo",
            usage_level=usage_levels["public_demo"],
            key_record=None,
            authenticated=False,
        )
    _validate_key_record(key_record)
    level_name = str(key_record.get("level") or key_record.get("usage_level") or "")
    if level_name not in usage_levels:
        raise ApiError(403, "invalid_usage_level", "API key is mapped to an unknown usage level.")
    usage_level = copy.deepcopy(usage_levels[level_name])
    _apply_key_limit_overrides(usage_level, key_record)
    return UsageContext(
        usage_level_name=level_name,
        usage_level=usage_level,
        key_record=key_record,
        authenticated=True,
    )


def normalize_mode(mode: str | None) -> str:
    raw_mode = (mode or "classical_only").strip().lower()
    return QAOA_MODE_ALIASES.get(raw_mode, raw_mode)


def validate_pre_upload_policy(
    usage_context: UsageContext,
    mode: str,
    response_level: str,
    content_length: int | None,
) -> None:
    usage_level = usage_context.usage_level
    if mode not in CANONICAL_MODES:
        raise ApiError(
            400,
            "unsupported_mode",
            "Unsupported mode.",
            {
                "received_mode": mode,
                "supported_modes": list(CANONICAL_MODES),
                "mode_aliases": QAOA_MODE_ALIASES,
            },
        )

    if mode not in usage_level.get("allowed_modes", []):
        raise ApiError(
            403,
            "mode_not_allowed",
            "Requested mode is not allowed for this usage level.",
            {
                "mode": mode,
                "response_level": response_level,
                "usage_level": usage_context.usage_level_name,
                "allowed_modes": usage_level.get("allowed_modes", []),
            },
        )

    if response_level not in usage_level.get("allowed_response_levels", []):
        raise ApiError(
            403,
            "response_level_not_allowed",
            "Requested response_level is not allowed for this usage level.",
            {
                "mode": mode,
                "response_level": response_level,
                "usage_level": usage_context.usage_level_name,
                "allowed_response_levels": usage_level.get("allowed_response_levels", []),
            },
        )

    max_upload_mb = float(usage_level.get("max_upload_mb", Config.MAX_UPLOAD_MB))
    if content_length is not None and content_length > max_upload_mb * 1024 * 1024:
        raise ApiError(
            403,
            "upload_too_large",
            "Uploaded request exceeds the usage-level upload limit.",
            {"usage_level": usage_context.usage_level_name, "max_upload_mb": max_upload_mb},
        )


def validate_problem_policy(usage_context: UsageContext, optimizer, mode: str, form_data) -> PolicyResult:
    usage_level = usage_context.usage_level
    n_qubits = int(getattr(optimizer, "n", 0))
    mode_limits = _mode_limits(usage_level, mode)
    license_max_qubits = int(usage_level.get("max_qubits", 0))
    if n_qubits > license_max_qubits:
        raise ApiError(
            403,
            "qubit_limit_exceeded",
            "Problem exceeds the license-level binary-variable limit.",
            {
                "usage_level": usage_context.usage_level_name,
                "mode": mode,
                "binary_variables": n_qubits,
                "license_max_qubits": license_max_qubits,
                "max_qubits": license_max_qubits,
            },
        )

    if mode == "qaoa_limited":
        safety_cap = int(mode_limits.get("max_qubits", license_max_qubits))
        if n_qubits > safety_cap:
            raise ApiError(
                403,
                "qaoa_limited_limit_exceeded",
                "Requested QAOA limited run exceeds the effective limit for this key.",
                {
                    "usage_level": usage_context.usage_level_name,
                    "mode": mode,
                    "field": "max_qubits",
                    "requested": n_qubits,
                    "allowed": safety_cap,
                    "binary_variables": n_qubits,
                    "license_max_qubits": license_max_qubits,
                    "qaoa_limited_max_qubits": safety_cap,
                    "max_qubits": safety_cap,
                },
            )

    runtime_inputs = extract_runtime_inputs(optimizer, form_data, usage_level=usage_level, mode=mode)
    if mode in QAOA_MODES:
        _validate_qaoa_runtime_limits(usage_context, runtime_inputs, mode, mode_limits)

    policy_result = estimate_policy_result(
        usage_context,
        optimizer,
        mode,
        runtime_inputs=runtime_inputs,
        form_data=form_data,
    )
    if not policy_result.within_limit:
        raise ApiError(
            403,
            "runtime_limit_exceeded",
            "Estimated runtime exceeds the configured limit for this run.",
            {
                "usage_level": usage_context.usage_level_name,
                "mode": mode,
                "estimated_runtime_sec": policy_result.estimated_runtime_sec,
                "max_estimated_runtime_sec": policy_result.max_estimated_runtime_sec,
                "limit_source": policy_result.runtime_limit_source,
                "binary_variables": policy_result.n_qubits,
                "max_layers": mode_limits.get("max_layers", usage_level.get("max_layers")),
                "max_iterations": mode_limits.get("max_iterations", usage_level.get("max_iterations")),
                "max_restarts": mode_limits.get("max_restarts", usage_level.get("max_restarts")),
            },
        )

    return policy_result


def estimate_policy_result(
    usage_context: UsageContext,
    optimizer,
    mode: str,
    runtime_inputs: RuntimeInputs | None = None,
    candidate_count: int | None = None,
    form_data=None,
) -> PolicyResult:
    usage_level = usage_context.usage_level
    n_qubits = int(getattr(optimizer, "n", 0))
    runtime_inputs = runtime_inputs or extract_runtime_inputs(optimizer, {}, usage_level=usage_level, mode=mode)
    candidate_count = int(
        candidate_count if candidate_count is not None else estimate_candidate_count(optimizer, n_qubits)
    )
    raw_estimated_runtime_sec = estimate_raw_runtime_sec(n_qubits, mode, runtime_inputs, candidate_count)
    estimated_runtime_sec = apply_runtime_estimate_multiplier(raw_estimated_runtime_sec, mode)
    max_runtime, runtime_limit_source = runtime_limit_for(usage_level, mode)
    effective_settings = build_effective_settings(optimizer, mode, runtime_inputs, form_data)
    return PolicyResult(
        runtime_inputs=runtime_inputs,
        estimated_runtime_sec=estimated_runtime_sec,
        raw_estimated_runtime_sec=raw_estimated_runtime_sec,
        max_estimated_runtime_sec=max_runtime,
        within_limit=estimated_runtime_sec <= max_runtime,
        n_qubits=n_qubits,
        candidate_count=candidate_count,
        runtime_limit_source=runtime_limit_source,
        effective_settings=effective_settings,
    )


def runtime_limit_for(usage_level: dict[str, Any], mode: str) -> tuple[float, str]:
    mode_limits = _mode_limits(usage_level, mode)
    max_runtime = float(usage_level.get("max_estimated_runtime_sec", 0.0))
    runtime_limit_source = "usage_level"
    if mode == "qaoa_limited" and "max_estimated_runtime_sec" in mode_limits:
        max_runtime = float(mode_limits.get("max_estimated_runtime_sec", max_runtime))
        runtime_limit_source = "qaoa_limited"
    return max_runtime, runtime_limit_source


def runtime_estimate_payload(mode: str, policy_result: PolicyResult) -> dict[str, Any]:
    return json_safe(
        {
            "mode": mode,
            "estimated_runtime_sec": policy_result.estimated_runtime_sec,
            "raw_estimated_runtime_sec": getattr(
                policy_result,
                "raw_estimated_runtime_sec",
                policy_result.estimated_runtime_sec,
            ),
            "max_estimated_runtime_sec": policy_result.max_estimated_runtime_sec,
            "within_limit": policy_result.within_limit,
            "limit_source": policy_result.runtime_limit_source,
            "eta_seconds_low": getattr(
                policy_result,
                "raw_estimated_runtime_sec",
                policy_result.estimated_runtime_sec,
            ),
            "eta_seconds_high": policy_result.estimated_runtime_sec,
            "basis": {
                "n_qubits": policy_result.n_qubits,
                "layers": policy_result.runtime_inputs.layers,
                "iterations": policy_result.runtime_inputs.iterations,
                "restarts": policy_result.runtime_inputs.restarts,
                "warm_start": policy_result.runtime_inputs.warm_start,
                "qaoa_shots_display": policy_result.effective_settings.get("qaoa_shots_display"),
                "shots_mode": policy_result.effective_settings.get("shots_mode"),
                "random_seed": policy_result.runtime_inputs.random_seed,
            },
        }
    )


def extract_runtime_inputs(optimizer, form_data, usage_level: dict[str, Any] | None = None, mode: str | None = None) -> RuntimeInputs:
    mode_limits = _mode_limits(usage_level or {}, mode or "")
    clamp_default = mode == "qaoa_limited"
    return RuntimeInputs(
        layers=_runtime_int(
            form_data,
            ("qaoa_p", "layers"),
            int(getattr(optimizer, "qaoa_p", 1) or 1),
            mode_limits.get("max_layers"),
            clamp_default=clamp_default,
        ),
        iterations=_runtime_int(
            form_data,
            ("qaoa_maxiter", "iterations"),
            int(getattr(optimizer, "qaoa_maxiter", 60) or 60),
            mode_limits.get("max_iterations"),
            clamp_default=clamp_default,
        ),
        restarts=_runtime_int(
            form_data,
            ("qaoa_multistart_restarts", "restarts"),
            int(getattr(optimizer, "qaoa_multistart_restarts", 1) or 1),
            mode_limits.get("max_restarts"),
            clamp_default=clamp_default,
        ),
        warm_start=_runtime_bool(
            form_data,
            ("warm_start", "qaoa_layerwise_warm_start"),
            bool(getattr(optimizer, "qaoa_layerwise_warm_start", False)),
        ),
        qaoa_shots=_runtime_optional_int(
            form_data,
            ("qaoa_shots",),
            _int_or_none(getattr(optimizer, "qaoa_shots", None)),
        ),
        restart_perturbation=_runtime_optional_float(
            form_data,
            ("restart_perturbation", "qaoa_restart_perturbation"),
            _float_or_none(getattr(optimizer, "qaoa_restart_perturbation", None)),
        ),
        random_seed=effective_random_seed(optimizer, form_data),
    )


def build_effective_settings(optimizer, mode: str, runtime_inputs: RuntimeInputs, form_data=None) -> dict[str, Any]:
    settings = getattr(optimizer, "settings", {}) or {}
    shots_mode = _shots_mode_for(mode)
    raw_qaoa_shots = runtime_inputs.qaoa_shots
    if shots_mode == "exact":
        qaoa_shots = None
        qaoa_shots_display = "exact"
    elif shots_mode == "sampling":
        qaoa_shots = raw_qaoa_shots
        qaoa_shots_display = str(qaoa_shots) if qaoa_shots is not None else None
    else:
        qaoa_shots = None
        qaoa_shots_display = "not_applicable"

    payload = {
        "mode": mode,
        "layers": runtime_inputs.layers,
        "qaoa_p": runtime_inputs.layers,
        "iterations": runtime_inputs.iterations,
        "qaoa_maxiter": runtime_inputs.iterations,
        "restarts": runtime_inputs.restarts,
        "qaoa_multistart_restarts": runtime_inputs.restarts,
        "warm_start": runtime_inputs.warm_start,
        "qaoa_layerwise_warm_start": runtime_inputs.warm_start,
        "qaoa_shots": qaoa_shots,
        "qaoa_shots_display": qaoa_shots_display,
        "shots_mode": shots_mode,
        "lambda_budget": _float_or_none(getattr(optimizer, "lambda_budget", None)),
        "budget_lambda": _float_or_none(getattr(optimizer, "lambda_budget", None)),
        "lambda_variance": _float_or_none(getattr(optimizer, "lambda_variance", None)),
        "risk_lambda": _float_or_none(getattr(optimizer, "lambda_variance", None)),
        "variance_lambda": _float_or_none(getattr(optimizer, "lambda_variance", None)),
        "risk_free_rate": _float_or_none(getattr(optimizer, "risk_free", None)),
        "restart_perturbation": runtime_inputs.restart_perturbation,
        "qaoa_restart_perturbation": runtime_inputs.restart_perturbation,
        "random_seed": runtime_inputs.random_seed,
        "rng_seed": runtime_inputs.random_seed,
        "sources": {
            "layers": _setting_source(form_data, settings, ("qaoa_p", "layers"), ("qaoa_p",)),
            "iterations": _setting_source(form_data, settings, ("qaoa_maxiter", "iterations"), ("qaoa_maxiter",)),
            "restarts": _setting_source(
                form_data,
                settings,
                ("qaoa_multistart_restarts", "restarts"),
                ("qaoa_multistart_restarts",),
            ),
            "warm_start": _setting_source(
                form_data,
                settings,
                ("warm_start", "qaoa_layerwise_warm_start"),
                ("qaoa_layerwise_warm_start",),
            ),
            "qaoa_shots": _setting_source(form_data, settings, ("qaoa_shots",), ("qaoa_shots",)),
            "lambda_budget": _setting_source(
                form_data,
                settings,
                ("lambda_budget", "budget_lambda"),
                ("lambda_budget",),
            ),
            "lambda_variance": _setting_source(
                form_data,
                settings,
                ("lambda_variance", "risk_lambda", "variance_lambda"),
                ("lambda_variance",),
            ),
            "risk_free_rate": _setting_source(
                form_data,
                settings,
                ("risk_free_rate", "risk_free_rate_annual"),
                ("risk_free_rate_annual",),
            ),
            "restart_perturbation": _setting_source(
                form_data,
                settings,
                ("restart_perturbation", "qaoa_restart_perturbation"),
                ("qaoa_restart_perturbation",),
            ),
            "random_seed": random_seed_source(form_data, settings),
        },
    }
    return json_safe(payload)


def estimate_candidate_count(optimizer=None, n_qubits: int | None = None) -> int:
    if optimizer is not None:
        classical_results = getattr(optimizer, "classical_results", None)
        try:
            if classical_results is not None and len(classical_results):
                return int(len(classical_results))
        except TypeError:
            pass
        n_qubits = int(getattr(optimizer, "n", n_qubits or 0) or 0)
    return int(2 ** max(0, min(int(n_qubits or 0), 60)))


def estimate_runtime_sec(
    n_qubits: int,
    mode: str,
    runtime_inputs: RuntimeInputs,
    candidate_count: int | None = None,
) -> float:
    return apply_runtime_estimate_multiplier(
        estimate_raw_runtime_sec(n_qubits, mode, runtime_inputs, candidate_count),
        mode,
    )


def estimate_raw_runtime_sec(
    n_qubits: int,
    mode: str,
    runtime_inputs: RuntimeInputs,
    candidate_count: int | None = None,
) -> float:
    estimator = load_usage_config()["runtime_estimator"]
    candidate_count = int(candidate_count if candidate_count is not None else 2 ** max(0, min(int(n_qubits), 60)))
    state_count = float(candidate_count)
    safety_factor = float(estimator.get("safety_factor", 1.0))
    if mode == "classical_only":
        base_runtime = (
            float(estimator.get("classical_parse_overhead_sec", 0.0))
            + float(estimator.get("classical_result_overhead_sec", 0.0))
            + float(estimator.get("alpha_classical_qubit", 0.0)) * max(0, int(n_qubits))
            + float(estimator.get("alpha_classical_candidate", estimator.get("alpha_classical", 0.0))) * state_count
        )
        return float(max(float(estimator.get("minimum_classical_runtime_sec", 0.0)), safety_factor * base_runtime))
    return float(
        max(
            float(estimator.get("minimum_qaoa_runtime_sec", 0.0)),
            safety_factor
            * float(estimator.get("alpha_qaoa_statevector", 0.0))
            * state_count
            * max(1, int(runtime_inputs.layers))
            * max(1, int(runtime_inputs.iterations))
            * max(1, int(runtime_inputs.restarts))
            * (1.5 if bool(getattr(runtime_inputs, "warm_start", False)) else 1.0),
        )
    )


def apply_runtime_estimate_multiplier(raw_estimated_runtime_sec: float, mode: str) -> float:
    if mode != "qaoa_limited":
        return float(raw_estimated_runtime_sec)
    estimator = load_usage_config()["runtime_estimator"]
    raw_multiplier = os.getenv(
        "QAOA_RUNTIME_ESTIMATE_MULTIPLIER",
        str(estimator.get("qaoa_runtime_estimate_multiplier", 2.75)),
    )
    try:
        multiplier = max(1.0, float(raw_multiplier))
    except (TypeError, ValueError):
        multiplier = 2.75
    return float(raw_estimated_runtime_sec) * multiplier


def capabilities_payload() -> dict[str, Any]:
    usage_config = load_usage_config()
    usage_levels = usage_config["usage_levels"]
    supported_modes = list(CANONICAL_MODES)
    response_levels = sorted(
        {level for usage_level in usage_levels.values() for level in usage_level.get("allowed_response_levels", [])}
    )
    public_levels = {}
    qaoa_limited_effective_limits = {}
    for name, level in usage_levels.items():
        public_levels[name] = {
            key: value
            for key, value in level.items()
            if key
            in {
                "level_id",
                "requires_key",
                "display_name",
                "max_qubits",
                "max_layers",
                "max_iterations",
                "max_restarts",
                "max_estimated_runtime_sec",
                "max_upload_mb",
                "max_parallel_runs",
                "allowed_modes",
                "allowed_response_levels",
                "qaoa_limited_limits",
            }
        }
        qaoa_limited_effective_limits[name] = (
            level.get("qaoa_limited_limits") if "qaoa_limited" in level.get("allowed_modes", []) else None
        )

    return json_safe(
        {
            "service": Config.SERVICE_NAME,
            "version": Config.VERSION,
            "supported_modes": supported_modes,
            "disabled_modes": sorted(QAOA_DISABLED_MODES),
            "mode_aliases": QAOA_MODE_ALIASES,
            "backward_compatibility": {
                "qaoa": "Accepted as an alias for qaoa_full. qaoa_full is currently disabled."
            },
            "response_levels": response_levels,
            "default_response_level": DEFAULT_RESPONSE_LEVEL,
            "usage_levels": public_levels,
            "qaoa_limited_effective_limits": qaoa_limited_effective_limits,
        }
    )


@lru_cache(maxsize=1)
def load_usage_config() -> dict[str, Any]:
    raw = _read_yaml(Config.USAGE_LEVELS_PATH)
    runtime_estimator = dict(raw.get("runtime_estimator", {}))
    usage_levels = {name: value for name, value in raw.items() if name != "runtime_estimator"}
    return {"usage_levels": usage_levels, "runtime_estimator": runtime_estimator}


@lru_cache(maxsize=1)
def load_key_store() -> dict[str, Any]:
    return _read_yaml(Config.DEMO_KEYS_PATH)


def clear_policy_caches() -> None:
    load_usage_config.cache_clear()
    load_key_store.cache_clear()
    clear_key_store_cache()


def validate_secret_configuration() -> None:
    key_store_mode = Config.key_store_mode()
    ledger_store_mode = Config.ledger_store_mode()
    job_store_mode = Config.job_store_mode()
    job_storage_mode = Config.job_storage_mode()
    if key_store_mode not in {"local", "firestore"}:
        raise RuntimeError("QAOA_KEY_STORE must be 'firestore', 'yaml', or 'auto'.")
    if ledger_store_mode not in {"local", "firestore", "disabled"}:
        raise RuntimeError("QAOA_RQP_LEDGER_STORE must be 'local', 'firestore', or 'disabled'.")
    if job_store_mode not in {"local", "firestore"}:
        raise RuntimeError("QAOA_JOB_STORE must be 'firestore', 'local', or 'auto'.")
    if job_storage_mode not in {"local", "gcs"}:
        raise RuntimeError("QAOA_JOB_STORAGE must be 'gcs', 'local', or 'auto'.")
    if os.getenv("QAOA_RQP_LOCAL_DEV") == "1":
        return
    if not os.getenv("KEY_HASH_SECRET"):
        raise RuntimeError(
            "KEY_HASH_SECRET is required when QAOA_RQP_LOCAL_DEV is not set. "
            "Set KEY_HASH_SECRET for production-like deployments, or set QAOA_RQP_LOCAL_DEV=1 only for local development."
        )
    if key_store_mode == "local":
        raise RuntimeError("QAOA_KEY_STORE=yaml/local is allowed only when QAOA_RQP_LOCAL_DEV=1.")
    if ledger_store_mode == "local":
        raise RuntimeError("QAOA_RQP_LEDGER_STORE=local is allowed only when QAOA_RQP_LOCAL_DEV=1.")
    if ledger_store_mode == "disabled":
        raise RuntimeError("QAOA_RQP_LEDGER_STORE=disabled is allowed only when QAOA_RQP_LOCAL_DEV=1.")
    if job_store_mode == "local":
        raise RuntimeError("QAOA_JOB_STORE=local is allowed only when QAOA_RQP_LOCAL_DEV=1.")
    if job_storage_mode == "local":
        raise RuntimeError("QAOA_JOB_STORAGE=local is allowed only when QAOA_RQP_LOCAL_DEV=1.")
    if job_storage_mode == "gcs" and not Config.job_bucket():
        raise RuntimeError("QAOA_JOB_BUCKET is required when QAOA_JOB_STORAGE=gcs.")
    return


def generate_key_hash(raw_key: str, secret: str | None = None) -> str:
    secret_value = secret if secret is not None else _key_hash_secret()
    return hmac.new(secret_value.encode("utf-8"), raw_key.encode("utf-8"), hashlib.sha256).hexdigest()


def _hash_key(api_key: str) -> str:
    return generate_key_hash(api_key)


def _key_hash_secret() -> str:
    secret = os.getenv("KEY_HASH_SECRET")
    if secret:
        return secret
    if os.getenv("QAOA_RQP_LOCAL_DEV") == "1":
        return LOCAL_DEV_FALLBACK_SECRET
    raise ApiError(
        500,
        "key_hash_secret_missing",
        "API key verification is not configured. Set KEY_HASH_SECRET, or set QAOA_RQP_LOCAL_DEV=1 only for local development.",
    )


def _validate_key_record(key_record: dict[str, Any]) -> None:
    status = str(key_record.get("status", "")).strip().lower()
    if status != "active":
        code = {
            "revoked": "revoked_key",
            "expired": "expired_key",
            "suspended": "revoked_key",
        }.get(status, "revoked_key")
        message = {
            "revoked": "API key has been revoked.",
            "expired": "API key has expired.",
            "suspended": "API key is suspended.",
        }.get(status, "API key is not active.")
        raise ApiError(
            403,
            code,
            message,
            {"key_id": key_record.get("key_id"), "status": status or None},
        )

    expires_at = _parse_datetime(key_record.get("expires_at"))
    if expires_at is not None and expires_at <= dt.datetime.now(dt.timezone.utc):
        raise ApiError(
            403,
            "expired_key",
            "API key has expired.",
            {"key_id": key_record.get("key_id"), "expires_at": key_record.get("expires_at")},
        )


def _apply_key_limit_overrides(usage_level: dict[str, Any], key_record: dict[str, Any]) -> None:
    general_limits = key_record.get("general_limits")
    if isinstance(general_limits, dict):
        for key, value in general_limits.items():
            if key in {
                "max_qubits",
                "max_layers",
                "max_iterations",
                "max_restarts",
                "max_estimated_runtime_sec",
                "max_upload_mb",
            }:
                usage_level[key] = value

    qaoa_limited_limits = key_record.get("qaoa_limited_limits")
    if isinstance(qaoa_limited_limits, dict):
        merged = dict(usage_level.get("qaoa_limited_limits") or {})
        merged.update(qaoa_limited_limits)
        usage_level["qaoa_limited_limits"] = merged

    if key_record.get("display_name"):
        usage_level["display_name"] = key_record.get("display_name")


def _validate_qaoa_runtime_limits(
    usage_context: UsageContext,
    runtime_inputs: RuntimeInputs,
    mode: str,
    mode_limits: dict[str, Any] | None = None,
) -> None:
    usage_level = usage_context.usage_level
    mode_limits = mode_limits or usage_level
    checks = [
        ("layers", runtime_inputs.layers, int(mode_limits.get("max_layers", usage_level.get("max_layers", 0)))),
        (
            "iterations",
            runtime_inputs.iterations,
            int(mode_limits.get("max_iterations", usage_level.get("max_iterations", 0))),
        ),
        ("restarts", runtime_inputs.restarts, int(mode_limits.get("max_restarts", usage_level.get("max_restarts", 0)))),
    ]
    exceeded = [
        {"field": field, "requested": requested, "allowed": limit, "limit": limit}
        for field, requested, limit in checks
        if int(requested) > int(limit)
    ]
    if exceeded:
        first = exceeded[0]
        if mode == "qaoa_limited":
            code = "qaoa_limited_limit_exceeded"
            message = "Requested QAOA limited run exceeds the effective limit for this key."
        else:
            code = "qaoa_runtime_limit_exceeded"
            message = "Requested QAOA runtime settings exceed the usage-level limits."
        raise ApiError(
            403,
            code,
            message,
            {
                "usage_level": usage_context.usage_level_name,
                "mode": mode,
                "field": first["field"],
                "requested": first["requested"],
                "allowed": first["allowed"],
                "max_layers": int(mode_limits.get("max_layers", usage_level.get("max_layers", 0))),
                "max_iterations": int(mode_limits.get("max_iterations", usage_level.get("max_iterations", 0))),
                "max_restarts": int(mode_limits.get("max_restarts", usage_level.get("max_restarts", 0))),
                "exceeded": exceeded,
            },
        )


def _runtime_int(
    form_data,
    keys: tuple[str, ...],
    default: int,
    limit: Any | None = None,
    *,
    clamp_default: bool = False,
) -> int:
    for key in keys:
        raw_value = form_data.get(key)
        if raw_value is None or str(raw_value).strip() == "":
            continue
        try:
            return int(float(str(raw_value).strip()))
        except ValueError:
            raise ApiError(400, "invalid_runtime_parameter", f"Form field {key!r} must be an integer.")
    parsed_default = int(default)
    if clamp_default and limit is not None:
        try:
            return min(parsed_default, int(limit))
        except (TypeError, ValueError):
            return parsed_default
    return parsed_default


def _runtime_bool(form_data, keys: tuple[str, ...], default: bool = False) -> bool:
    for key in keys:
        raw_value = form_data.get(key)
        if raw_value is None or str(raw_value).strip() == "":
            continue
        value = str(raw_value).strip().lower()
        if value in {"1", "true", "yes", "y", "on"}:
            return True
        if value in {"0", "false", "no", "n", "off"}:
            return False
        raise ApiError(400, "invalid_runtime_parameter", f"Form field {key!r} must be a boolean.")
    return bool(default)


def _runtime_optional_int(form_data, keys: tuple[str, ...], default: int | None = None) -> int | None:
    for key in keys:
        raw_value = form_data.get(key)
        if raw_value is None or str(raw_value).strip() == "":
            continue
        try:
            return int(float(str(raw_value).strip()))
        except ValueError:
            raise ApiError(400, "invalid_runtime_parameter", f"Form field {key!r} must be an integer.")
    return default


def _runtime_optional_float(form_data, keys: tuple[str, ...], default: float | None = None) -> float | None:
    for key in keys:
        raw_value = form_data.get(key)
        if raw_value is None or str(raw_value).strip() == "":
            continue
        try:
            return float(str(raw_value).strip())
        except ValueError:
            raise ApiError(400, "invalid_runtime_parameter", f"Form field {key!r} must be numeric.")
    return default


def _shots_mode_for(mode: str) -> str:
    if mode == "qaoa_limited":
        return "exact"
    if mode == "qaoa_full":
        return "sampling"
    return "disabled"


def _setting_source(form_data, settings: dict[str, Any], form_keys: tuple[str, ...], workbook_keys: tuple[str, ...]) -> str:
    if _form_has_value(form_data, form_keys):
        return "form"
    if any(key in settings and settings.get(key) is not None for key in workbook_keys):
        return "workbook"
    return "backend_default"


def _form_has_value(form_data, keys: tuple[str, ...]) -> bool:
    if form_data is None:
        return False
    for key in keys:
        raw_value = form_data.get(key)
        if raw_value is not None and str(raw_value).strip() != "":
            return True
    return False


def _int_or_none(value) -> int | None:
    if value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _float_or_none(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _mode_limits(usage_level: dict[str, Any], mode: str) -> dict[str, Any]:
    if mode == "qaoa_limited":
        limits = usage_level.get("qaoa_limited_limits", {})
        if isinstance(limits, dict):
            return limits
    return usage_level


def _read_yaml(path: Path) -> dict[str, Any]:
    try:
        with Path(path).open("r", encoding="utf-8") as handle:
            data = yaml.safe_load(handle) or {}
    except FileNotFoundError as exc:
        raise ApiError(500, "config_file_missing", f"Configuration file is missing: {Path(path).name}") from exc
    if not isinstance(data, dict):
        raise ApiError(500, "config_file_invalid", f"Configuration file is invalid: {Path(path).name}")
    return data


def _parse_datetime(value) -> dt.datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, dt.datetime):
        parsed = value
    else:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)
