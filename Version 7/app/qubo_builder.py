"""Adapter around the existing V6.1 QUBO builder."""

from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path
from typing import Any, Callable

from app.schemas import ApiError


def load_legacy_optimizer_symbols():
    root = _find_legacy_optimizer_root()
    root_str = str(root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)

    module = importlib.import_module("qaoa_optimizer_V6_1_core")
    return module.QAOAOptimizerV61, module.OptimizationError


def build_qubo_from_workbook(workbook_path: Path, log_callback: Callable[[str], None], form_data: Any | None = None):
    optimizer_cls, _ = load_legacy_optimizer_symbols()
    optimizer = optimizer_cls(
        str(workbook_path),
        refresh_override=False,
        enable_qaoa_override=False,
        enable_classical_override=True,
        qaoa_p_override=_form_int_override(form_data, ("qaoa_p", "layers")),
        qaoa_maxiter_override=_form_int_override(form_data, ("qaoa_maxiter", "iterations")),
        qaoa_shots_override=_form_int_override(form_data, ("qaoa_shots",)),
        qaoa_multistart_restarts_override=_form_int_override(
            form_data,
            ("qaoa_multistart_restarts", "restarts"),
        ),
        qaoa_layerwise_warm_start_override=_form_bool_override(
            form_data,
            ("warm_start", "qaoa_layerwise_warm_start"),
        ),
        qaoa_restart_perturbation_override=_form_float_override(
            form_data,
            ("restart_perturbation", "qaoa_restart_perturbation"),
        ),
        lambda_budget_override=_form_float_override(form_data, ("lambda_budget", "budget_lambda")),
        lambda_variance_override=_form_float_override(
            form_data,
            ("lambda_variance", "risk_lambda", "variance_lambda"),
        ),
        risk_free_rate_override=_form_float_override(form_data, ("risk_free_rate", "risk_free_rate_annual")),
        log_callback=_sanitizing_log_callback(log_callback),
        progress_callback=lambda _message, _progress=None: None,
    )
    optimizer.load_input()
    optimizer.build_qubo()
    return optimizer


def _sanitizing_log_callback(log_callback: Callable[[str], None]) -> Callable[[str], None]:
    def emit(message: str) -> None:
        log_callback(str(message).replace("Refresh with yfinance:", "Refresh of Data:"))

    return emit


def _form_int_override(form_data: Any | None, keys: tuple[str, ...]) -> int | None:
    raw = _form_value(form_data, keys)
    if raw is None:
        return None
    try:
        return int(float(raw))
    except ValueError as exc:
        raise ApiError(400, "invalid_runtime_parameter", f"Form field {keys[0]!r} must be an integer.") from exc


def _form_float_override(form_data: Any | None, keys: tuple[str, ...]) -> float | None:
    raw = _form_value(form_data, keys)
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError as exc:
        raise ApiError(400, "invalid_runtime_parameter", f"Form field {keys[0]!r} must be numeric.") from exc


def _form_bool_override(form_data: Any | None, keys: tuple[str, ...]) -> bool | None:
    raw = _form_value(form_data, keys)
    if raw is None:
        return None
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "y", "on"}:
        return True
    if value in {"0", "false", "no", "n", "off"}:
        return False
    raise ApiError(400, "invalid_runtime_parameter", f"Form field {keys[0]!r} must be a boolean.")


def _form_value(form_data: Any | None, keys: tuple[str, ...]) -> str | None:
    if form_data is None:
        return None
    for key in keys:
        raw_value = form_data.get(key)
        if raw_value is None or str(raw_value).strip() == "":
            continue
        return str(raw_value).strip()
    return None


def _find_legacy_optimizer_root() -> Path:
    env_root = os.getenv("QAOA_LEGACY_ROOT")
    candidates = []
    if env_root:
        candidates.append(Path(env_root))

    here = Path(__file__).resolve()
    candidates.extend([here.parents[1], here.parents[2], Path.cwd()])

    for candidate in candidates:
        candidate = candidate.resolve()
        if (candidate / "qaoa_optimizer_V6_1_core.py").exists():
            return candidate

    raise RuntimeError(
        "Could not locate qaoa_optimizer_V6_1_core.py. "
        "Build Docker images from the repository root or set QAOA_LEGACY_ROOT."
    )
