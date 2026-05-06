"""Workbook sanity checks and candidate export diagnostics."""

from __future__ import annotations

from typing import Any

import numpy as np

from app.schemas import json_safe


def workbook_warnings(optimizer) -> list[str]:
    warnings: list[str] = list(getattr(optimizer, "cost_column_warnings", []) or [])
    budget_usd = _float_or_none(getattr(optimizer, "budget_usd", None))
    fixed_usd = _sum_numeric(getattr(optimizer, "fixed_cost", []))
    variable_costs = _numeric_array(getattr(optimizer, "opt_cost", []))
    variable_universe = float(variable_costs.sum()) if len(variable_costs) else 0.0

    if budget_usd is None:
        return warnings

    if fixed_usd > budget_usd:
        warnings.append("Fixed holdings exceed the configured budget before any variable block is selected.")

    if len(variable_costs):
        cheapest = float(np.min(variable_costs))
        median = float(np.median(variable_costs))
        if fixed_usd + cheapest > budget_usd:
            warnings.append("Configured budget is smaller than fixed holdings plus the cheapest variable block.")
        if fixed_usd + median > budget_usd:
            warnings.append("Configured budget may leave little or no room for typical variable selections.")
    elif budget_usd > 0:
        warnings.append("No variable decision blocks found; optimizer has no selectable assets.")

    remaining_budget = budget_usd - fixed_usd
    if remaining_budget > 0 and variable_universe > 0 and remaining_budget > variable_universe * 1.25:
        warnings.append("Available variable candidate universe may be too small to reach the configured budget.")

    return warnings


def workbook_warning_log_lines(optimizer) -> list[str]:
    return [f"Workbook warning: {warning}" for warning in workbook_warnings(optimizer)]


def append_workbook_warning_logs(logs: list[str], optimizer) -> list[str]:
    for line in workbook_warning_log_lines(optimizer):
        logs.append(line)
    return logs


def candidate_export_diagnostics(optimizer) -> dict[str, Any]:
    classical = getattr(optimizer, "classical_results", None)
    samples = getattr(optimizer, "samples_df", None)
    n_qubits = _int_or_zero(getattr(optimizer, "n", 0))
    random_samples = max(0, _int_or_zero(getattr(optimizer, "random_search_samples", 0)))
    local_starts = max(0, _int_or_zero(getattr(optimizer, "local_search_starts", 0)))
    classical_requested = random_samples + min(n_qubits, local_starts)
    classical_actual = _len(classical)
    classical_cap_applied = classical_actual < classical_requested
    classical_reason = _classical_export_reason(classical_requested, classical_actual)

    qaoa_requested = _int_or_none(
        getattr(optimizer, "qaoa_export_requested_rows", getattr(optimizer, "qaoa_max_export_rows", None))
    )
    qaoa_effective = _int_or_none(getattr(optimizer, "qaoa_max_export_rows", None))
    qaoa_actual = _len(samples)
    qaoa_cap_applied = bool(getattr(optimizer, "qaoa_export_cap_applied", False))
    qaoa_reason = str(getattr(optimizer, "qaoa_export_cap_reason", "") or "")
    if not qaoa_reason:
        qaoa_reason = _qaoa_export_reason(qaoa_requested, qaoa_effective, qaoa_actual, optimizer)
        qaoa_cap_applied = qaoa_cap_applied or (qaoa_requested is not None and qaoa_effective is not None and qaoa_effective < qaoa_requested)

    state_space = _state_space(n_qubits)
    exact_states_evaluated = _int_or_none(getattr(optimizer, "qaoa_total_states_considered", None))

    return json_safe(
        {
            "classical_export_requested_rows": classical_requested,
            "classical_export_actual_rows": classical_actual,
            "classical_export_cap_applied": classical_cap_applied,
            "classical_export_cap_reason": classical_reason,
            "classical_random_search_samples": random_samples,
            "classical_local_search_starts": local_starts,
            "top_n_export": _int_or_none(getattr(optimizer, "top_n_export", None)),
            "overview_classical_pool": _int_or_none(getattr(optimizer, "overview_classical_pool", None)),
            "overview_qaoa_pool": _int_or_none(getattr(optimizer, "overview_qaoa_pool", None)),
            "result_candidate_limit_per_solver": _int_or_none(getattr(optimizer, "result_candidate_limit_per_solver", None)),
            "qaoa_export_requested_rows": qaoa_requested,
            "qaoa_export_effective_max_rows": qaoa_effective,
            "qaoa_export_actual_rows": qaoa_actual,
            "qaoa_export_cap_applied": qaoa_cap_applied,
            "qaoa_export_cap_reason": qaoa_reason,
            "qaoa_max_export_rows": qaoa_effective,
            "qaoa_min_probability_to_export": _float_or_none(getattr(optimizer, "qaoa_min_probability_to_export", None)),
            "qaoa_export_mode": getattr(optimizer, "qaoa_export_mode", None),
            "qaoa_export_sort_by": getattr(optimizer, "qaoa_export_sort_by", None),
            "qaoa_export_feasible_only": bool(getattr(optimizer, "qaoa_export_feasible_only", False)),
            "qaoa_exact_probability_max_qubits": _int_or_none(getattr(optimizer, "qaoa_exact_probability_max_qubits", None)),
            "qaoa_exact_state_space": state_space,
            "qaoa_exact_states_evaluated": exact_states_evaluated,
            "qaoa_exact_states_exported": qaoa_actual,
        }
    )


def candidate_export_log_lines(optimizer) -> list[str]:
    diagnostics = candidate_export_diagnostics(optimizer)
    lines = [
        (
            "Classical export requested "
            f"{diagnostics.get('classical_export_requested_rows')} rows; exported "
            f"{diagnostics.get('classical_export_actual_rows')} rows; reason: "
            f"{diagnostics.get('classical_export_cap_reason')}"
        )
    ]
    qaoa_requested = diagnostics.get("qaoa_export_requested_rows")
    if qaoa_requested is not None or bool(getattr(optimizer, "enable_qaoa", False)):
        lines.append(
            "QAOA export requested "
            f"{qaoa_requested} rows; exported {diagnostics.get('qaoa_export_actual_rows')} rows; reason: "
            f"{diagnostics.get('qaoa_export_cap_reason')}"
        )
    return lines


def _classical_export_reason(requested: int, actual: int) -> str:
    if requested <= 0:
        return "classical_search_disabled_or_not_requested"
    if actual == 0:
        return "classical_search_returned_no_candidates"
    if actual < requested:
        return "unique_candidate_count_after_duplicate_removal_or_search_convergence"
    if actual == requested:
        return "all_requested_candidate_rows_available"
    return "actual_candidate_rows_exceed_requested_count"


def _qaoa_export_reason(qaoa_requested: int | None, qaoa_effective: int | None, qaoa_actual: int, optimizer) -> str:
    if not bool(getattr(optimizer, "enable_qaoa", False)) and qaoa_actual == 0:
        return "qaoa_not_executed"
    if qaoa_requested is None:
        return "qaoa_export_request_unknown"
    if qaoa_effective is not None and qaoa_effective < qaoa_requested:
        return "qaoa_export_effective_cap_applied"
    if qaoa_actual < qaoa_requested:
        if bool(getattr(optimizer, "qaoa_export_feasible_only", False)):
            return "feasibility_filter_or_available_state_count_below_requested_rows"
        min_probability = _float_or_none(getattr(optimizer, "qaoa_min_probability_to_export", None))
        if min_probability and min_probability > 0:
            return "minimum_probability_filter_or_available_state_count_below_requested_rows"
        return "available_exported_state_count_below_requested_rows"
    return "requested_rows_exported"


def _numeric_array(values) -> np.ndarray:
    try:
        array = np.asarray(values, dtype=float).reshape(-1)
        return array[np.isfinite(array)]
    except Exception:
        return np.array([], dtype=float)


def _sum_numeric(values) -> float:
    array = _numeric_array(values)
    return float(array.sum()) if len(array) else 0.0


def _float_or_none(value) -> float | None:
    try:
        if value is None:
            return None
        result = float(value)
        return result if np.isfinite(result) else None
    except Exception:
        return None


def _int_or_none(value) -> int | None:
    try:
        if value is None:
            return None
        return int(float(value))
    except Exception:
        return None


def _int_or_zero(value) -> int:
    parsed = _int_or_none(value)
    return int(parsed) if parsed is not None else 0


def _len(value) -> int:
    try:
        return int(len(value))
    except Exception:
        return 0


def _state_space(n_qubits: int) -> int | None:
    if n_qubits < 0 or n_qubits > 60:
        return None
    return int(1 << n_qubits)
