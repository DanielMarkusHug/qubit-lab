"""QAOA execution helpers for controlled Version 7 milestones."""

from __future__ import annotations

import time

from app.config import Config
from app.schemas import ApiError


class QAOAExecutionError(RuntimeError):
    """Raised when limited QAOA execution fails after optimization starts."""


def raise_qaoa_full_disabled(submitted_mode: str | None = None) -> None:
    raise ApiError(
        501,
        "qaoa_full_disabled",
        "Full QAOA mode is disabled. Use qaoa_limited for synchronous cloud runs.",
        details={
            "received_mode": "qaoa_full",
            "submitted_mode": submitted_mode or "qaoa_full",
            "version": Config.VERSION,
        },
    )


def raise_qaoa_not_enabled() -> None:
    raise_qaoa_full_disabled(submitted_mode="qaoa")


def run_qaoa_limited(optimizer, runtime_inputs, logs: list[str] | None = None, max_qubits: int | None = None):
    """Run the V6.1 QAOA path with strict cloud-safe settings.

    The QUBO has already been built with the existing optimizer logic. This
    function only flips on the bounded QAOA execution path and forces exact
    statevector probabilities for the small allowed problem sizes.
    """

    logs = logs if logs is not None else []
    _configure_limited_qaoa(optimizer, runtime_inputs, max_qubits=max_qubits)
    start = time.perf_counter()
    try:
        optimizer.run_qaoa()
        optimizer.qaoa_runtime_sec = float(max(time.perf_counter() - start, 0.0))
        _normalize_limited_qaoa_outputs(optimizer)
        optimizer.generate_results()
    except Exception as exc:  # noqa: BLE001 - converted to controlled API error upstream
        optimizer.qaoa_runtime_sec = float(max(time.perf_counter() - start, 0.0))
        raise QAOAExecutionError("QAOA limited execution failed.") from exc

    if getattr(optimizer, "samples_df", None) is None or len(optimizer.samples_df) == 0:
        raise QAOAExecutionError("QAOA limited execution completed without exported candidates.")

    return optimizer, logs


def _configure_limited_qaoa(optimizer, runtime_inputs, max_qubits: int | None = None) -> None:
    optimizer.enable_qaoa = True
    optimizer.qaoa_p = int(runtime_inputs.layers)
    optimizer.qaoa_maxiter = int(runtime_inputs.iterations)
    optimizer.qaoa_multistart_restarts = int(runtime_inputs.restarts)

    optimizer.qaoa_layerwise_warm_start = bool(getattr(runtime_inputs, "warm_start", False))
    if getattr(runtime_inputs, "restart_perturbation", None) is not None:
        optimizer.qaoa_restart_perturbation = max(0.0, float(runtime_inputs.restart_perturbation))
    optimizer.qaoa_maxiter_per_param = 0
    optimizer.qaoa_exact_probability_max_qubits = max(int(getattr(optimizer, "n", 0)), 1)
    optimizer.qaoa_max_qubits_allowed = int(max_qubits or getattr(optimizer, "qaoa_max_qubits_allowed", 16) or 16)
    optimizer.qaoa_exact_p1_presearch = False
    optimizer.qaoa_concentration_polish_enabled = False
    optimizer.qaoa_sampled_concentration_polish_enabled = False

    optimizer.qaoa_export_mode = "top_k"
    optimizer.qaoa_export_sort_by = "probability"
    optimizer.qaoa_export_feasible_only = False
    optimizer.qaoa_min_probability_to_export = 0.0
    n_qubits = max(int(getattr(optimizer, "n", 0)), 0)
    optimizer.qaoa_max_export_rows = max(1, min(1 << n_qubits, 256))
    optimizer.qaoa_exact_qubo_diagnostic_rows = 0
    optimizer.qaoa_limited_exact_probabilities = True
    optimizer.qaoa_limited_runtime_inputs = {
        "layers": int(runtime_inputs.layers),
        "iterations": int(runtime_inputs.iterations),
        "restarts": int(runtime_inputs.restarts),
        "warm_start": bool(getattr(runtime_inputs, "warm_start", False)),
        "restart_perturbation": getattr(runtime_inputs, "restart_perturbation", None),
    }


def _normalize_limited_qaoa_outputs(optimizer) -> None:
    samples = getattr(optimizer, "samples_df", None)
    if samples is None or len(samples) == 0:
        return

    samples = samples.copy()
    samples["source"] = "qaoa_limited"
    samples["selection_scope"] = "qaoa exact probability sample"
    optimizer.samples_df = samples

    best_qubo = optimizer.sort_candidates(samples).head(20).copy()
    best_qubo["source"] = "qaoa_limited"
    best_qubo["selection_scope"] = "qaoa exact probability sample"
    optimizer.qaoa_exact_best_qubo_df = best_qubo
    optimizer.qaoa_mode = "qaoa_limited"
