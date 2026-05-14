"""Convert optimizer objects into stable JSON responses."""

from __future__ import annotations

import base64
import os
from io import BytesIO
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from app.config import Config
from app.cost_columns import INDICATIVE_COST_COLUMN, LEGACY_COST_COLUMN, add_indicative_cost_alias_to_frame
from app.code_exports import build_qaoa_code_export_package
from app.ibm_circuit import build_qiskit_qaoa_circuit_from_optimizer, qaoa_ibm_circuit_metadata
from app.schemas import json_safe
from app.type_constraints import (
    achievements_for_bitvec,
    constraints_for_json,
    type_budget_term_columns,
    type_candidate_columns,
    type_size_columns,
)
from app.usage_policy import (
    DEFAULT_EXPORT_MODE,
    EXPORT_MODE_IBM_EXTERNAL_RUN,
    EXPORT_MODE_INTERNAL_ONLY,
    EXPORT_MODE_LABELS,
    EXPORT_MODE_QISKIT_EXPORT,
    QAOA_MODES,
    mode_diagnostics,
    runtime_estimate_payload,
)
from app.workbook_diagnostics import candidate_export_diagnostics, workbook_warnings


BEST_METRIC_KEYS = (
    "bitstring",
    "qubo_value",
    "return_term",
    "risk_term",
    "budget_term",
    "type_budget_term",
    "qubo_reconstructed",
    "selected_usd",
    "fixed_usd",
    "variable_selected_usd",
    "budget_gap",
    "abs_budget_gap",
    "num_options",
    "num_fixed_options",
    "num_variable_options",
    "num_distinct_assets",
    "portfolio_return",
    "portfolio_vol",
    "sharpe_like",
    "cash_weight",
    "portfolio_return_budget_normalized",
    "portfolio_vol_budget_normalized",
    "sharpe_like_budget_normalized",
    "max_position_usd",
)


PORTFOLIO_ROW_KEYS = (
    "decision_role",
    "variable_bit_index",
    "Ticker",
    "Company",
    "Option Label",
    "Shares",
    INDICATIVE_COST_COLUMN,
    LEGACY_COST_COLUMN,
    "Expected Return Proxy",
    "Annual Volatility",
    "decision_id",
)


def _best_metric_keys(optimizer) -> tuple[str, ...]:
    keys = list(BEST_METRIC_KEYS)
    for key in type_candidate_columns(optimizer):
        if key not in keys:
            keys.append(key)
    return tuple(keys)


def _portfolio_row_keys(optimizer) -> tuple[str, ...]:
    keys = list(PORTFOLIO_ROW_KEYS)
    for key in type_size_columns(optimizer):
        if key not in keys:
            keys.append(key)
    for key in type_candidate_columns(optimizer):
        if key not in keys:
            keys.append(key)
    return tuple(keys)


IMPORTANT_LOG_PATTERNS = (
    "loading workbook",
    "loaded",
    "settings",
    "fixed asset",
    "variable decision",
    "qubo matrix size",
    "selected mode",
    "workbook warning",
    "qaoa",
    "classical candidate count",
    "classical export requested",
    "qaoa export requested",
    "random seed",
    "cost column used",
    "sample count",
)


def build_classical_response(
    run_id: str,
    optimizer,
    workbook_summary: dict | None,
    logs: list[str],
    response_level: str = "compact",
    mode: str = "classical_only",
    solver: str = "classical_heuristic",
    usage_context=None,
    policy_result=None,
    license_info: dict[str, Any] | None = None,
    actual_runtime_sec: float | None = None,
    run_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    full_payload = _build_full_classical_response(
        run_id,
        optimizer,
        workbook_summary,
        logs,
        mode=mode,
        solver=solver,
        include_reporting_charts=response_level == "full",
        policy_result=policy_result,
    )
    _attach_policy_metadata(full_payload, usage_context, policy_result, license_info, actual_runtime_sec)
    _attach_run_metadata(full_payload, run_metadata)
    return shape_classical_response(full_payload, response_level)


def shape_classical_response(full_payload: dict[str, Any], response_level: str) -> dict[str, Any]:
    if response_level == "full":
        return json_safe(full_payload)

    compact = {
        "status": full_payload.get("status"),
        "run_id": full_payload.get("run_id"),
        "model_version": full_payload.get("model_version"),
        "mode": full_payload.get("mode"),
        "solver": full_payload.get("solver"),
        "filename": full_payload.get("filename"),
        "binary_variables": full_payload.get("binary_variables"),
        "objective": full_payload.get("objective"),
        "qubo_value": full_payload.get("qubo_value"),
        "best_bitstring": full_payload.get("best_bitstring"),
        "selected_usd": full_payload.get("selected_usd"),
        "budget_gap": full_payload.get("budget_gap"),
        "portfolio_metrics": full_payload.get("portfolio_metrics"),
        "selected_blocks": full_payload.get("selected_blocks"),
        "license": full_payload.get("license"),
        "worker_profile": full_payload.get("worker_profile"),
        "worker_profile_label": full_payload.get("worker_profile_label"),
        "worker_job_name": full_payload.get("worker_job_name"),
        "configured_cpu": full_payload.get("configured_cpu"),
        "configured_memory_gib": full_payload.get("configured_memory_gib"),
        "memory_used_gib": full_payload.get("memory_used_gib"),
        "memory_limit_gib": full_payload.get("memory_limit_gib"),
        "memory_remaining_gib": full_payload.get("memory_remaining_gib"),
        "memory_used_pct": full_payload.get("memory_used_pct"),
        "peak_memory_used_gib": full_payload.get("peak_memory_used_gib"),
        "memory_history": full_payload.get("memory_history"),
        "code_export_package": full_payload.get("code_export_package"),
        "diagnostics": _compact_diagnostics(full_payload.get("diagnostics", {}), log_limit=20),
        "reporting": _shape_reporting(full_payload.get("reporting", {}), "compact"),
    }

    if response_level == "standard":
        standard = dict(compact)
        standard["components"] = full_payload.get("components")
        standard["top_candidates"] = list(full_payload.get("top_candidates", []))[:5]
        standard["diagnostics"] = _compact_diagnostics(full_payload.get("diagnostics", {}), log_limit=50)
        standard["reporting"] = _shape_reporting(full_payload.get("reporting", {}), "standard")
        return json_safe(standard)

    return json_safe(compact)


def _build_full_classical_response(
    run_id: str,
    optimizer,
    workbook_summary: dict | None,
    logs: list[str],
    mode: str = "classical_only",
    solver: str = "classical_heuristic",
    include_reporting_charts: bool = False,
    policy_result=None,
) -> dict[str, Any]:
    best = optimizer.sort_candidates(optimizer.classical_results).iloc[0]
    bitstring = str(best.get("bitstring", ""))
    bitvec = np.array(list(map(int, bitstring)), dtype=int) if bitstring else np.zeros(int(optimizer.n), dtype=int)

    if optimizer.portfolios_df is not None and len(optimizer.portfolios_df):
        selected_rows = optimizer.portfolios_df.loc[optimizer.portfolios_df["rank"].eq(1)].copy()
    else:
        selected_rows = pd.DataFrame(optimizer.exploded_portfolio_rows(1, "classical_heuristic", bitstring, bitvec))

    top_candidates = optimizer.sort_candidates(optimizer.classical_results).head(10)

    warnings = workbook_warnings(optimizer)
    diagnostics = {
        "service": Config.SERVICE_NAME,
        **mode_diagnostics(getattr(optimizer, "requested_run_mode", mode), mode),
        "legacy_optimizer": "QAOAOptimizerV61",
        "input_sheet_names": (workbook_summary or {}).get("input_sheet_names", []),
        "ignored_output_sheets": (workbook_summary or {}).get("ignored_output_sheets", []),
        "settings_count": int(len(getattr(optimizer, "settings", {}))),
        "asset_rows_loaded": int(len(getattr(optimizer, "assets_df", []))),
        "assets_referenced_by_options": int(len(getattr(optimizer, "asset_universe", []))),
        "fixed_options": int(len(getattr(optimizer, "fixed_options_df", []))),
        "variable_options": int(len(getattr(optimizer, "variable_options_df", []))),
        "classical_candidate_count": int(len(getattr(optimizer, "classical_results", []))),
        "qubo_shape": list(getattr(optimizer, "Q", np.array([])).shape),
        "qubo_nonzero_entries": int(np.count_nonzero(getattr(optimizer, "Q", np.array([])))),
        "qubo_constant": float(getattr(optimizer, "constant", 0.0)),
        "budget_usd": float(getattr(optimizer, "budget_usd", np.nan)),
        "lambda_budget": float(getattr(optimizer, "lambda_budget", np.nan)),
        "lambda_variance": float(getattr(optimizer, "lambda_variance", np.nan)),
        "fixed_variable_cross_terms_preserved": bool(
            len(getattr(optimizer, "fixed_options_df", [])) and int(getattr(optimizer, "n", 0)) > 0
        ),
        "qaoa_enabled": bool(getattr(optimizer, "enable_qaoa", False) and len(getattr(optimizer, "samples_df", []))),
        "qaoa_available": bool(len(getattr(optimizer, "samples_df", []))),
        "qaoa_status": _qaoa_status(optimizer),
        "qaoa_mode": _safe_attr(optimizer, "qaoa_mode"),
        "qaoa_candidate_count": int(len(getattr(optimizer, "samples_df", []))),
        "qaoa_p": _safe_attr(optimizer, "qaoa_p"),
        "qaoa_iterations": _safe_attr(optimizer, "qaoa_maxiter"),
        "qaoa_restarts": _safe_attr(optimizer, "qaoa_multistart_restarts"),
        "qaoa_exact_probabilities": bool(
            getattr(optimizer, "qaoa_sim_exact_probabilities", False)
            or getattr(optimizer, "qaoa_limited_exact_probabilities", False)
        ),
        "qaoa_runtime_sec": _safe_attr(optimizer, "qaoa_runtime_sec"),
        "export_mode": _export_mode(optimizer),
        "export_mode_diagnostics": _export_mode_diagnostics(optimizer),
        "circuit": _circuit_report(optimizer),
        "cost_column_used": _safe_attr(optimizer, "input_cost_column"),
        "cost_column_internal": _safe_attr(optimizer, "internal_cost_column"),
        "cost_column_normalized": bool(getattr(optimizer, "cost_column_normalized", False)),
        "cost_column_conflicting_row_count": int(getattr(optimizer, "cost_column_conflicting_row_count", 0) or 0),
        "workbook_warnings": warnings,
        "workbook_warning_count": len(warnings),
        "additional_type_constraints_count": int(
            getattr(optimizer, "additional_type_constraints_count", 0) or 0
        ),
        "additional_type_constraints": constraints_for_json(optimizer),
        "additional_type_budget_achievements": achievements_for_bitvec(optimizer, bitvec),
        "logs": list(logs or []),
    }
    diagnostics.update(candidate_export_diagnostics(optimizer))
    export_workbook_summary = build_workbook_summary(optimizer)
    if workbook_summary:
        export_workbook_summary.update(
            {
                "input_sheet_names": workbook_summary.get("input_sheet_names", []),
                "ignored_output_sheets": workbook_summary.get("ignored_output_sheets", []),
            }
        )
    code_export_package = build_qaoa_code_export_package(
        optimizer,
        mode=mode,
        solver=solver,
        workbook_summary=export_workbook_summary,
        policy_result=policy_result,
    )
    diagnostics["code_export_package_available"] = bool(code_export_package)

    return json_safe(
        {
            "run_id": run_id,
            "status": "completed",
            "model_version": Config.MODEL_VERSION,
            "mode": mode,
            "solver": solver,
            "binary_variables": int(optimizer.n),
            "best_bitstring": bitstring,
            "objective": _safe_get(best, "qubo_value"),
            "qubo_value": _safe_get(best, "qubo_value"),
            "selected_usd": _safe_get(best, "selected_usd"),
            "budget_gap": _safe_get(best, "budget_gap"),
            "components": {
                "return_term": _safe_get(best, "return_term"),
                "risk_term": _safe_get(best, "risk_term"),
                "budget_term": _safe_get(best, "budget_term"),
                "type_budget_term": _safe_get(best, "type_budget_term"),
                "qubo_reconstructed": _safe_get(best, "qubo_reconstructed"),
            },
            "portfolio_metrics": {
                key: _safe_get(best, key)
                for key in (
                    "fixed_usd",
                    "variable_selected_usd",
                    "num_options",
                    "num_fixed_options",
                    "num_variable_options",
                    "num_distinct_assets",
                    "portfolio_return",
                    "portfolio_vol",
                    "sharpe_like",
                    "cash_weight",
                    "portfolio_return_budget_normalized",
                    "portfolio_vol_budget_normalized",
                    "sharpe_like_budget_normalized",
                    "max_position_usd",
                )
            },
            "best_candidate": {key: _safe_get(best, key) for key in _best_metric_keys(optimizer) if key in best.index},
            "selected_blocks": _records_with_keys(selected_rows, _portfolio_row_keys(optimizer)),
            "top_candidates": _records_with_keys(top_candidates, _best_metric_keys(optimizer)),
            "code_export_package": code_export_package,
            "reporting": _build_reporting(optimizer, include_charts=include_reporting_charts),
            "diagnostics": diagnostics,
        }
    )


def _attach_policy_metadata(
    payload: dict[str, Any],
    usage_context,
    policy_result,
    license_info: dict[str, Any] | None,
    actual_runtime_sec: float | None,
) -> None:
    if license_info is not None:
        payload["license"] = license_info
    elif usage_context is not None:
        payload["license"] = usage_context.identity
        payload.setdefault("diagnostics", {})["usage_level"] = usage_context.usage_level_name
    else:
        payload["license"] = None
    if usage_context is not None:
        payload.setdefault("diagnostics", {})["usage_level"] = usage_context.usage_level_name
    if policy_result is not None:
        payload.setdefault("diagnostics", {})["estimated_runtime_sec"] = policy_result.estimated_runtime_sec
        payload["diagnostics"]["raw_estimated_runtime_sec"] = getattr(
            policy_result,
            "raw_estimated_runtime_sec",
            policy_result.estimated_runtime_sec,
        )
        payload["diagnostics"]["max_estimated_runtime_sec"] = getattr(policy_result, "max_estimated_runtime_sec", None)
        payload["diagnostics"]["runtime_estimate"] = runtime_estimate_payload(payload.get("mode"), policy_result)
        payload["diagnostics"]["eta_seconds_low"] = payload["diagnostics"]["runtime_estimate"].get("eta_seconds_low")
        payload["diagnostics"]["eta_seconds_high"] = payload["diagnostics"]["runtime_estimate"].get("eta_seconds_high")
        payload["diagnostics"]["n_qubits"] = getattr(policy_result, "n_qubits", None)
        payload["diagnostics"]["export_mode"] = getattr(policy_result, "export_mode", DEFAULT_EXPORT_MODE)
        payload["diagnostics"]["export_mode_diagnostics"] = getattr(
            policy_result,
            "export_mode_diagnostics",
            {},
        )
        payload["diagnostics"]["candidate_count"] = payload["diagnostics"].get(
            "classical_candidate_count",
            getattr(policy_result, "candidate_count", None),
        )
        payload["diagnostics"]["runtime_inputs"] = {
            "layers": policy_result.runtime_inputs.layers,
            "iterations": policy_result.runtime_inputs.iterations,
            "restarts": policy_result.runtime_inputs.restarts,
            "warm_start": policy_result.runtime_inputs.warm_start,
            "qaoa_shots": getattr(policy_result.runtime_inputs, "qaoa_shots", None),
            "qaoa_shots_display": getattr(policy_result, "effective_settings", {}).get("qaoa_shots_display"),
            "shots_mode": getattr(policy_result, "effective_settings", {}).get("shots_mode"),
            "restart_perturbation": getattr(policy_result.runtime_inputs, "restart_perturbation", None),
            "random_seed": getattr(policy_result.runtime_inputs, "random_seed", None),
            "export_mode": getattr(policy_result, "export_mode", DEFAULT_EXPORT_MODE),
        }
        payload["diagnostics"]["effective_settings"] = getattr(policy_result, "effective_settings", {})
        payload["diagnostics"]["random_seed"] = getattr(policy_result.runtime_inputs, "random_seed", None)
        if actual_runtime_sec is not None:
            estimated = float(policy_result.estimated_runtime_sec)
            payload["diagnostics"]["actual_runtime_sec"] = float(actual_runtime_sec)
            payload["diagnostics"]["runtime_ratio"] = (
                float(actual_runtime_sec) / estimated if estimated > 0 else None
            )
    elif actual_runtime_sec is not None:
        payload.setdefault("diagnostics", {})["actual_runtime_sec"] = float(actual_runtime_sec)


def _attach_run_metadata(payload: dict[str, Any], run_metadata: dict[str, Any] | None) -> None:
    if not run_metadata:
        return
    fields = (
        "worker_profile",
        "worker_profile_label",
        "worker_job_name",
        "configured_cpu",
        "configured_memory_gib",
        "memory_used_gib",
        "memory_limit_gib",
        "memory_remaining_gib",
        "memory_used_pct",
        "peak_memory_used_gib",
        "memory_history",
    )
    diagnostics = payload.setdefault("diagnostics", {})
    summary = payload.setdefault("reporting", {}).setdefault("summary", {})
    for field in fields:
        if field in run_metadata:
            payload[field] = run_metadata.get(field)
            diagnostics[field] = run_metadata.get(field)
            summary[field] = run_metadata.get(field)


def _compact_diagnostics(diagnostics: dict[str, Any], log_limit: int = 20) -> dict[str, Any]:
    keys = (
        "budget_usd",
        "requested_run_mode",
        "run_mode",
        "simulation_backend",
        "legacy_run_mode_alias",
        "hardware_replay",
        "lambda_budget",
        "lambda_variance",
        "variable_options",
        "fixed_options",
        "classical_candidate_count",
        "qubo_shape",
        "fixed_variable_cross_terms_preserved",
        "cost_column_used",
        "cost_column_internal",
        "cost_column_normalized",
        "cost_column_conflicting_row_count",
        "workbook_warnings",
        "workbook_warning_count",
        "additional_type_constraints_count",
        "additional_type_constraints",
        "additional_type_budget_achievements",
        "classical_export_requested_rows",
        "classical_export_actual_rows",
        "classical_export_cap_applied",
        "classical_export_cap_reason",
        "qaoa_export_requested_rows",
        "qaoa_export_actual_rows",
        "qaoa_export_cap_applied",
        "qaoa_export_cap_reason",
        "qaoa_exact_state_space",
        "qaoa_exact_states_evaluated",
        "qaoa_exact_states_exported",
        "qaoa_sampled_states_evaluated",
        "qaoa_sampled_states_exported",
        "worker_profile",
        "worker_profile_label",
        "worker_job_name",
        "configured_cpu",
        "configured_memory_gib",
        "memory_used_gib",
        "memory_limit_gib",
        "memory_remaining_gib",
        "memory_used_pct",
        "peak_memory_used_gib",
        "estimated_runtime_sec",
        "raw_estimated_runtime_sec",
        "max_estimated_runtime_sec",
        "runtime_estimate",
        "eta_seconds_low",
        "eta_seconds_high",
        "actual_runtime_sec",
        "runtime_ratio",
        "n_qubits",
        "candidate_count",
        "runtime_inputs",
        "effective_settings",
        "random_seed",
        "export_mode",
        "export_mode_diagnostics",
        "usage_level",
        "qaoa_enabled",
        "qaoa_available",
        "qaoa_status",
        "qaoa_mode",
        "qaoa_candidate_count",
        "qaoa_p",
        "qaoa_iterations",
        "qaoa_restarts",
        "qaoa_exact_probabilities",
        "qaoa_runtime_sec",
        "circuit",
        "code_export_package_available",
    )
    compact = {key: diagnostics.get(key) for key in keys if key in diagnostics}
    if "logs" in diagnostics:
        compact["logs"] = cap_logs(diagnostics.get("logs", []), log_limit)
    return compact


def cap_logs(logs: list[str] | tuple[str, ...] | None, limit: int) -> list[str]:
    raw_logs = [str(line) for line in (logs or [])]
    if limit <= 0:
        return []
    if len(raw_logs) <= limit:
        return raw_logs

    selected: set[int] = set()
    for idx, line in enumerate(raw_logs):
        lowered = line.lower()
        if any(pattern in lowered for pattern in IMPORTANT_LOG_PATTERNS):
            selected.add(idx)
        if len(selected) >= limit:
            break

    tail_start = max(0, len(raw_logs) - limit)
    for idx in range(tail_start, len(raw_logs)):
        if len(selected) >= limit:
            break
        selected.add(idx)

    return [raw_logs[idx] for idx in sorted(selected)]


def build_inspection_response(
    filename: str,
    optimizer,
    mode: str,
    usage_context,
    license_info: dict[str, Any],
    policy_result,
    logs: list[str],
    run_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    warnings = workbook_warnings(optimizer)
    diagnostics = {
        "service": Config.SERVICE_NAME,
        **mode_diagnostics(getattr(optimizer, "requested_run_mode", mode), mode),
        "usage_level": getattr(usage_context, "usage_level_name", None),
        "workbook_warnings": warnings,
        "workbook_warning_count": len(warnings),
        "runtime_inputs": {
            "layers": policy_result.runtime_inputs.layers,
            "iterations": policy_result.runtime_inputs.iterations,
            "restarts": policy_result.runtime_inputs.restarts,
            "warm_start": policy_result.runtime_inputs.warm_start,
            "qaoa_shots": getattr(policy_result.runtime_inputs, "qaoa_shots", None),
            "qaoa_shots_display": getattr(policy_result, "effective_settings", {}).get("qaoa_shots_display"),
            "shots_mode": getattr(policy_result, "effective_settings", {}).get("shots_mode"),
            "restart_perturbation": getattr(policy_result.runtime_inputs, "restart_perturbation", None),
            "random_seed": getattr(policy_result.runtime_inputs, "random_seed", None),
            "export_mode": getattr(policy_result, "export_mode", DEFAULT_EXPORT_MODE),
        },
        "effective_settings": getattr(policy_result, "effective_settings", {}),
        "random_seed": getattr(policy_result.runtime_inputs, "random_seed", None),
        "export_mode": getattr(policy_result, "export_mode", DEFAULT_EXPORT_MODE),
        "export_mode_diagnostics": getattr(policy_result, "export_mode_diagnostics", {}),
        "circuit": _circuit_report(optimizer),
        "cost_column_used": _safe_attr(optimizer, "input_cost_column"),
        "cost_column_internal": _safe_attr(optimizer, "internal_cost_column"),
        "cost_column_normalized": bool(getattr(optimizer, "cost_column_normalized", False)),
        "cost_column_conflicting_row_count": int(getattr(optimizer, "cost_column_conflicting_row_count", 0) or 0),
        "additional_type_constraints_count": int(getattr(optimizer, "additional_type_constraints_count", 0) or 0),
        "additional_type_constraints": constraints_for_json(optimizer),
        "logs": cap_logs(logs, 50),
    }
    if run_metadata:
        diagnostics.update(run_metadata)
    payload = {
        "status": "completed",
        "model_version": Config.MODEL_VERSION,
        "filename": filename,
        "license": license_info,
        "workbook_summary": build_workbook_summary(optimizer),
        "runtime_estimate": runtime_estimate_payload(mode, policy_result),
        "diagnostics": diagnostics,
    }
    if run_metadata:
        payload.update(run_metadata)
    return json_safe(payload)


def build_workbook_summary(optimizer) -> dict[str, Any]:
    n_qubits = _safe_attr(optimizer, "n")
    return json_safe(
        {
            "decision_variables": n_qubits,
            "n_qubits": n_qubits,
            "decision_state_space": _decision_state_space(n_qubits),
            "fixed_asset_blocks": _len_attr(optimizer, "fixed_options_df"),
            "variable_asset_blocks": _len_attr(optimizer, "variable_options_df"),
            "unique_tickers": int(len(getattr(optimizer, "asset_universe", []))),
            "budget": _safe_attr(optimizer, "budget_usd"),
            "currency_code": _currency_code(optimizer),
            "fixed_invested_amount": _sum_attr_array(optimizer, "fixed_cost"),
            "variable_candidate_universe": _sum_attr_array(optimizer, "opt_cost"),
            "qubo_shape": list(getattr(optimizer, "Q", np.array([])).shape),
            "assets_referenced_by_options": int(len(getattr(optimizer, "asset_universe", []))),
            "settings_count": int(len(getattr(optimizer, "settings", {}))),
            "cost_column_used": _safe_attr(optimizer, "input_cost_column"),
            "cost_column_internal": _safe_attr(optimizer, "internal_cost_column"),
            "cost_column_normalized": bool(getattr(optimizer, "cost_column_normalized", False)),
            "additional_type_constraints_count": int(getattr(optimizer, "additional_type_constraints_count", 0) or 0),
            "additional_type_constraints": constraints_for_json(optimizer),
        }
    )


def _shape_reporting(reporting: dict[str, Any], response_level: str) -> dict[str, Any]:
    if response_level == "compact":
        return {"summary": reporting.get("summary", {})}
    if response_level == "standard":
        return {
            "summary": reporting.get("summary", {}),
            "classical_candidates": reporting.get("classical_candidates", []),
            "solver_comparison": reporting.get("solver_comparison", []),
            "second_opinion": reporting.get("second_opinion", {}),
            "portfolio_contents": reporting.get("portfolio_contents", []),
            "circuit": reporting.get("circuit", {}),
        }
    return reporting


def _build_reporting(optimizer, include_charts: bool = False) -> dict[str, Any]:
    second_opinion = _qiskit_second_opinion_report(optimizer)
    summary = _build_reporting_summary(optimizer)
    summary["quantum_second_opinion_summary"] = second_opinion.get("summary")
    summary["second_opinion_available"] = bool(second_opinion.get("available"))
    summary["second_opinion_label"] = second_opinion.get("label")
    classical_candidates = _candidate_records(
        getattr(optimizer, "classical_results", pd.DataFrame()),
        optimizer=optimizer,
        sort_by="qubo_value",
        ascending=True,
        limit=20,
    )
    quantum_samples = _candidate_records(
        getattr(optimizer, "samples_df", pd.DataFrame()),
        optimizer=optimizer,
        sort_by="probability",
        ascending=False,
        limit=20,
    )
    qaoa_best_qubo = _candidate_records(
        getattr(optimizer, "qaoa_exact_best_qubo_df", pd.DataFrame()),
        optimizer=optimizer,
        sort_by="qubo_value",
        ascending=True,
        limit=20,
    )
    reporting = {
        "summary": summary,
        "classical_candidates": classical_candidates,
        "quantum_samples": quantum_samples,
        "qaoa_best_qubo": qaoa_best_qubo,
        "second_opinion": second_opinion,
        "solver_comparison": _solver_comparison_records(optimizer, second_opinion),
        "portfolio_contents": _portfolio_content_records(optimizer),
        "optimization_history": _records(_tail_df(getattr(optimizer, "history_df", pd.DataFrame()), 200)),
        "circuit": _circuit_report(optimizer),
        "charts": _build_reporting_charts(optimizer, second_opinion) if include_charts else {},
    }
    return json_safe(reporting)


def _build_reporting_summary(optimizer) -> dict[str, Any]:
    overview = getattr(optimizer, "overview_df", pd.DataFrame())
    classical = getattr(optimizer, "classical_results", pd.DataFrame())
    samples = getattr(optimizer, "samples_df", pd.DataFrame())
    history = getattr(optimizer, "history_df", pd.DataFrame())
    fixed_options = getattr(optimizer, "fixed_options_df", pd.DataFrame())
    variable_options = getattr(optimizer, "variable_options_df", pd.DataFrame())
    qaoa_configured = bool(getattr(optimizer, "enable_qaoa", False))
    qaoa_available = bool(samples is not None and len(samples))
    qaoa_enabled = bool(qaoa_configured and qaoa_available)
    best_overview = overview.iloc[0] if isinstance(overview, pd.DataFrame) and len(overview) else {}

    return {
        "classical_result_summary": _classical_result_summary(optimizer),
        "quantum_result_summary": _quantum_result_summary(optimizer),
        "top_n_exported": int(len(overview)) if isinstance(overview, pd.DataFrame) else 0,
        "classical_candidate_count": int(len(classical)) if isinstance(classical, pd.DataFrame) else 0,
        "qaoa_candidate_count": int(len(samples)) if isinstance(samples, pd.DataFrame) else 0,
        "qaoa_enabled": qaoa_enabled,
        "qaoa_configured": qaoa_configured,
        "qaoa_available": qaoa_available,
        "qaoa_status": _qaoa_status(optimizer),
        "qaoa_p": _safe_attr(optimizer, "qaoa_p"),
        "qaoa_mode": _safe_attr(optimizer, "qaoa_mode"),
        "export_mode": _export_mode(optimizer),
        "budget_lambda": _safe_attr(optimizer, "lambda_budget"),
        "risk_lambda": _safe_attr(optimizer, "lambda_variance"),
        "risk_free_rate": _safe_attr(optimizer, "risk_free"),
        "decision_variables": _safe_attr(optimizer, "n"),
        "decision_state_space": _decision_state_space(_safe_attr(optimizer, "n")),
        "fixed_asset_blocks": int(len(fixed_options)) if isinstance(fixed_options, pd.DataFrame) else 0,
        "variable_asset_blocks": int(len(variable_options)) if isinstance(variable_options, pd.DataFrame) else 0,
        "fixed_invested_usd": _sum_attr_array(optimizer, "fixed_cost"),
        "variable_candidate_usd_universe": _sum_attr_array(optimizer, "opt_cost"),
        "unique_tickers": int(len(getattr(optimizer, "asset_universe", []))),
        "best_overview_sharpe_like": _series_get(best_overview, "sharpe_like"),
        "best_overview_invested_usd": _series_get(best_overview, "selected_usd"),
        "best_overview_abs_budget_gap": _series_get(best_overview, "abs_budget_gap"),
        "best_overview_return_term": _series_get(best_overview, "return_term"),
        "best_overview_risk_term": _series_get(best_overview, "risk_term"),
        "best_overview_budget_term": _series_get(best_overview, "budget_term"),
        "best_overview_type_budget_term": _series_get(best_overview, "type_budget_term"),
        "additional_type_constraints_count": int(getattr(optimizer, "additional_type_constraints_count", 0) or 0),
        "additional_type_constraints": constraints_for_json(optimizer),
        "best_overview_cash_weight": _series_get(best_overview, "cash_weight"),
        "optimization_iterations": int(len(history)) if isinstance(history, pd.DataFrame) else 0,
    }


def _classical_result_summary(optimizer) -> dict[str, Any]:
    classical = getattr(optimizer, "classical_results", pd.DataFrame())
    if not isinstance(classical, pd.DataFrame) or len(classical) == 0:
        return {
            "title": "Classical Result Summary",
            "status": "Not available",
            "available": False,
            "source": "Classical_Candidates",
        }

    best = _sort_df(classical, optimizer, "qubo_value", True).iloc[0]
    return _candidate_summary(
        best,
        title="Classical Result Summary",
        status="Available",
        available=True,
        source="Classical_Candidates",
        solver="Classical Heuristic",
    )


def _quantum_result_summary(optimizer) -> dict[str, Any]:
    # Version 9 classical-only mode intentionally does not synthesize quantum
    # metrics from the classical optimum. This block exists so the frontend can
    # keep its side-by-side layout while QAOA remains disabled.
    samples = getattr(optimizer, "samples_df", pd.DataFrame())
    exact = getattr(optimizer, "qaoa_exact_best_qubo_df", pd.DataFrame())
    qaoa_available = (isinstance(samples, pd.DataFrame) and len(samples) > 0) or (
        isinstance(exact, pd.DataFrame) and len(exact) > 0
    )

    if not qaoa_available:
        return {
            "title": "Quantum Result Summary",
            "status": "Disabled / Not available",
            "available": False,
            "source": "QAOA disabled in Version 9 classical_only mode",
            "future_source": "QAOA_Samples and QAOA_Best_QUBO",
            "solver": None,
            "best_bitstring": None,
            "objective": None,
            "qubo_value": None,
            "selected_usd": None,
            "budget_gap": None,
            "abs_budget_gap": None,
            "return_term": None,
            "risk_term": None,
            "budget_term": None,
            "portfolio_return": None,
            "portfolio_vol": None,
            "sharpe_like": None,
            "cash_weight": None,
            "probability": None,
        }

    source_df = exact if isinstance(exact, pd.DataFrame) and len(exact) else samples
    best = _sort_df(source_df, optimizer, "qubo_value", True).iloc[0]
    return _candidate_summary(
        best,
        title="Quantum Result Summary",
        status="Available",
        available=True,
        source="QAOA_Best_QUBO" if isinstance(exact, pd.DataFrame) and len(exact) else "QAOA_Samples",
        solver=f"QAOA p={_safe_attr(optimizer, 'qaoa_p')} ({_safe_attr(optimizer, 'qaoa_mode')})",
    )


def _candidate_summary(
    row,
    *,
    title: str,
    status: str,
    available: bool,
    source: str,
    solver: str | None,
) -> dict[str, Any]:
    return {
        "title": title,
        "status": status,
        "available": available,
        "source": source,
        "solver": solver,
        "best_bitstring": _series_get(row, "bitstring"),
        "objective": _series_get(row, "qubo_value"),
        "qubo_value": _series_get(row, "qubo_value"),
        "selected_usd": _series_get(row, "selected_usd"),
        "budget_gap": _series_get(row, "budget_gap"),
        "abs_budget_gap": _series_get(row, "abs_budget_gap"),
        "return_term": _series_get(row, "return_term"),
        "risk_term": _series_get(row, "risk_term"),
        "budget_term": _series_get(row, "budget_term"),
        "type_budget_term": _series_get(row, "type_budget_term"),
        "additional_type_budget_achievements": _type_achievements_from_row(row),
        "portfolio_return": _series_get(row, "portfolio_return"),
        "portfolio_vol": _series_get(row, "portfolio_vol"),
        "sharpe_like": _series_get(row, "sharpe_like"),
        "cash_weight": _series_get(row, "cash_weight"),
        "probability": _series_get(row, "probability"),
    }


def _qiskit_second_opinion_report(optimizer) -> dict[str, Any]:
    export_mode = _export_mode(optimizer)
    label = _second_opinion_label(export_mode)
    source_label = _second_opinion_source_label(export_mode)
    if export_mode not in {EXPORT_MODE_QISKIT_EXPORT, EXPORT_MODE_IBM_EXTERNAL_RUN}:
        return json_safe(
            {
                "available": False,
                "enabled": False,
                "label": label,
                "source": "not_requested",
                "reason": "2nd opinion mode was not selected.",
                "summary": _empty_second_opinion_summary(label, "Not requested", source_label),
                "samples": [],
                "best_qubo": [],
                "portfolio_contents": [],
            }
        )

    if export_mode == EXPORT_MODE_IBM_EXTERNAL_RUN:
        return _ibm_hardware_second_opinion_report(optimizer, label=label, source_label=source_label)

    samples = getattr(optimizer, "samples_df", pd.DataFrame())
    exact = getattr(optimizer, "qaoa_exact_best_qubo_df", pd.DataFrame())
    if not bool(getattr(optimizer, "enable_qaoa", False)) or (
        (not isinstance(samples, pd.DataFrame) or len(samples) == 0)
        and (not isinstance(exact, pd.DataFrame) or len(exact) == 0)
    ):
        return json_safe(
            {
                "available": False,
                "enabled": True,
                "label": label,
                "source": "qiskit_statevector",
                "reason": "QAOA was not executed, so no Qiskit comparison can be built.",
                "summary": _empty_second_opinion_summary(label, "QAOA not executed", source_label),
                "samples": [],
                "best_qubo": [],
                "portfolio_contents": [],
            }
        )

    max_qubits = _qiskit_second_opinion_max_qubits()
    n_qubits = _safe_int(getattr(optimizer, "n", None)) or 0
    if n_qubits <= 0 or n_qubits > max_qubits:
        return json_safe(
            {
                "available": False,
                "enabled": True,
                "label": label,
                "source": "qiskit_statevector",
                "reason": f"Qiskit 2nd opinion statevector is capped at {max_qubits} qubits.",
                "n_qubits": n_qubits,
                "max_qubits": max_qubits,
                "summary": _empty_second_opinion_summary(label, "Qubit cap", source_label),
                "samples": [],
                "best_qubo": [],
                "portfolio_contents": [],
            }
        )

    try:
        probabilities_by_bitstring = _qiskit_statevector_probabilities_by_optimizer_bitstring(optimizer)
        if not probabilities_by_bitstring:
            raise ValueError("Qiskit returned no state probabilities.")

        top_probability_rows = []
        for rank, (bitstring, probability) in enumerate(
            sorted(probabilities_by_bitstring.items(), key=lambda item: (-item[1], item[0]))[:20],
            start=1,
        ):
            row = _candidate_row_for_bitstring(
                optimizer,
                bitstring,
                probability=probability,
                source="qiskit_statevector_second_opinion",
                selection_scope="Qiskit simulation top states by probability",
            )
            if row is not None:
                row["rank"] = rank
                top_probability_rows.append(row)

        best_source = exact if isinstance(exact, pd.DataFrame) and len(exact) else samples
        best_rows = []
        if isinstance(best_source, pd.DataFrame) and len(best_source):
            for rank, (_, candidate) in enumerate(
                _sort_df(best_source, optimizer, "qubo_value", True).head(20).iterrows(),
                start=1,
            ):
                bitstring = str(candidate.get("bitstring", "") or "")
                if not bitstring:
                    continue
                row = _candidate_row_for_bitstring(
                    optimizer,
                    bitstring,
                    probability=probabilities_by_bitstring.get(bitstring),
                    source="qiskit_statevector_second_opinion",
                    selection_scope="Qiskit simulation over QAOA best-QUBO candidate set",
                )
                if row is not None:
                    row["rank"] = rank
                    best_rows.append(row)

        sample_df = _sort_df(pd.DataFrame(top_probability_rows), optimizer, "probability", False)
        best_df = _sort_df(pd.DataFrame(best_rows), optimizer, "qubo_value", True)
        summary_row = best_df.iloc[0] if len(best_df) else (sample_df.iloc[0] if len(sample_df) else None)
        summary = (
            _candidate_summary(
                summary_row,
                title=label,
                status="Available",
                available=True,
                source=source_label,
                solver="Quantum / QAOA (2nd opinion)",
            )
            if summary_row is not None
            else _empty_second_opinion_summary(label, "No candidates", source_label)
        )
        portfolio_contents = _portfolio_rows_for_candidate(optimizer, summary_row, "qiskit_statevector_second_opinion") if summary_row is not None else []

        return json_safe(
            {
                "available": bool(summary_row is not None),
                "enabled": True,
                "label": label,
                "source": "qiskit_statevector",
                "provider": "local_simulation",
                "sdk": "qiskit",
                "simulation": True,
                "dry_run": True,
                "hardware_submission": "not_configured",
                "n_qubits": n_qubits,
                "max_qubits": max_qubits,
                "summary": summary,
                "samples": _records(sample_df),
                "best_qubo": _records(best_df),
                "portfolio_contents": portfolio_contents,
            }
        )
    except Exception as exc:  # noqa: BLE001 - optional reporting block should not break the run
        return json_safe(
            {
                "available": False,
                "enabled": True,
                "label": label,
                "source": "qiskit_statevector",
                "reason": f"Qiskit 2nd opinion unavailable: {type(exc).__name__}",
                "summary": _empty_second_opinion_summary(label, "Unavailable", source_label),
                "samples": [],
                "best_qubo": [],
                "portfolio_contents": [],
            }
        )


def _ibm_hardware_second_opinion_report(
    optimizer,
    *,
    label: str,
    source_label: str,
) -> dict[str, Any]:
    raw = _ibm_runtime_result(optimizer)
    if not raw:
        return json_safe(
            {
                "available": False,
                "enabled": True,
                "label": label,
                "source": "ibm_hardware",
                "reason": "IBM hardware execution was not available for this result.",
                "summary": _empty_second_opinion_summary(label, "Unavailable", source_label),
                "samples": [],
                "best_qubo": [],
                "portfolio_contents": [],
            }
        )

    if not raw.get("available"):
        return json_safe(
            {
                "available": False,
                "enabled": True,
                "label": label,
                "source": "ibm_hardware",
                "provider": raw.get("provider"),
                "sdk": raw.get("sdk"),
                "simulation": False,
                "dry_run": False,
                "hardware_submission": raw.get("hardware_submission"),
                "instance": raw.get("instance"),
                "backend_name": raw.get("backend_name"),
                "job_id": raw.get("job_id"),
                "shots": raw.get("shots"),
                "shots_source": raw.get("shots_source"),
                "comparability_note": raw.get("comparability_note"),
                "parse_status": raw.get("parse_status"),
                "timing": raw.get("timing"),
                "warnings": raw.get("warnings") or [],
                "reason": raw.get("reason"),
                "error": raw.get("error"),
                "result_snapshot": raw.get("result_snapshot"),
                "summary": _empty_second_opinion_summary(label, "Unavailable", source_label),
                "samples": [],
                "best_qubo": [],
                "portfolio_contents": [],
            }
        )

    probabilities_by_bitstring = dict(raw.get("probabilities") or {})
    measured_bitstrings = list(raw.get("measured_bitstrings_by_hits") or [])
    counts = dict(raw.get("counts") or {})
    if not measured_bitstrings:
        measured_bitstrings = [
            bitstring
            for bitstring, _value in sorted(
                counts.items(),
                key=lambda item: (-float(item[1]), item[0]),
            )
        ]

    sample_rows = []
    for rank, bitstring in enumerate(measured_bitstrings[:20], start=1):
        row = _candidate_row_for_bitstring(
            optimizer,
            bitstring,
            probability=probabilities_by_bitstring.get(bitstring),
            source="ibm_hardware_second_opinion",
            selection_scope="IBM hardware measured candidates sorted by hits",
        )
        if row is not None:
            row["rank"] = rank
            row["count"] = _safe_int(counts.get(bitstring))
            row["shots"] = _safe_int(raw.get("shots"))
            sample_rows.append(row)

    sample_df = _sort_df(pd.DataFrame(sample_rows), optimizer, "probability", False)
    if "count" in sample_df.columns:
        sample_df = sample_df.sort_values(by=["count", "qubo_value"], ascending=[False, True], kind="mergesort")

    best_df = _sort_df(pd.DataFrame(sample_rows), optimizer, "qubo_value", True)
    if len(best_df):
        best_df = best_df.head(20).copy()
        best_df["selection_scope"] = "IBM hardware measured candidates sorted by QUBO"
        if "rank" in best_df.columns:
            best_df = best_df.reset_index(drop=True)
            best_df["rank"] = np.arange(1, len(best_df) + 1)

    summary_row = best_df.iloc[0] if len(best_df) else (sample_df.iloc[0] if len(sample_df) else None)
    summary = (
        _candidate_summary(
            summary_row,
            title=label,
            status="Available",
            available=True,
            source=source_label,
            solver="Quantum / QAOA (2nd opinion)",
        )
        if summary_row is not None
        else _empty_second_opinion_summary(label, "No measured candidates", source_label)
    )
    portfolio_contents = (
        _portfolio_rows_for_candidate(optimizer, summary_row, "ibm_hardware_second_opinion")
        if summary_row is not None
        else []
    )

    return json_safe(
        {
            "available": bool(summary_row is not None and raw.get("available")),
            "enabled": True,
            "label": label,
            "source": "ibm_hardware",
            "provider": raw.get("provider"),
            "sdk": raw.get("sdk"),
            "simulation": False,
            "dry_run": False,
            "hardware_submission": raw.get("hardware_submission"),
            "instance": raw.get("instance"),
            "backend_name": raw.get("backend_name"),
            "job_id": raw.get("job_id"),
            "shots": raw.get("shots"),
            "shots_source": raw.get("shots_source"),
            "comparability_note": raw.get("comparability_note"),
            "parse_status": raw.get("parse_status"),
            "timing": raw.get("timing"),
            "warnings": raw.get("warnings") or [],
            "result_snapshot": raw.get("result_snapshot"),
            "summary": summary,
            "samples": _records(sample_df),
            "best_qubo": _records(best_df),
            "portfolio_contents": portfolio_contents,
        }
    )


def _second_opinion_label(export_mode: str | None) -> str:
    if export_mode == EXPORT_MODE_IBM_EXTERNAL_RUN:
        return "Quantum (2nd opinion) - IBM Hardware"
    if export_mode == EXPORT_MODE_QISKIT_EXPORT:
        return "Quantum (2nd opinion) - Qiskit simulation"
    return "Quantum (2nd opinion)"


def _second_opinion_source_label(export_mode: str | None) -> str:
    if export_mode == EXPORT_MODE_IBM_EXTERNAL_RUN:
        return "IBM Hardware"
    if export_mode == EXPORT_MODE_QISKIT_EXPORT:
        return "Qiskit simulation"
    return "Not requested"


def _empty_second_opinion_summary(title: str, status: str, source: str = "Qiskit simulation") -> dict[str, Any]:
    return {
        "title": title,
        "status": status,
        "available": False,
        "source": source,
        "solver": "Quantum / QAOA (2nd opinion)",
        "best_bitstring": None,
        "objective": None,
        "qubo_value": None,
        "selected_usd": None,
        "budget_gap": None,
        "abs_budget_gap": None,
        "return_term": None,
        "risk_term": None,
        "budget_term": None,
        "type_budget_term": None,
        "portfolio_return": None,
        "portfolio_vol": None,
        "sharpe_like": None,
        "cash_weight": None,
        "probability": None,
    }


def _qiskit_second_opinion_max_qubits() -> int:
    raw_value = os.getenv("QAOA_QISKIT_SECOND_OPINION_MAX_QUBITS", "20")
    try:
        return max(1, int(float(raw_value)))
    except (TypeError, ValueError):
        return 20


def _qiskit_statevector_probabilities_by_optimizer_bitstring(optimizer) -> dict[str, float]:
    from qiskit.quantum_info import Statevector

    circuit = build_qiskit_qaoa_circuit_from_optimizer(optimizer, measure=False, name="qaoa_rqp_second_opinion")
    n_qubits = int(getattr(optimizer, "n", 0) or 0)
    probabilities = np.asarray(Statevector.from_instruction(circuit).probabilities(), dtype=float).reshape(-1)
    total = float(np.sum(probabilities))
    if total > 0.0 and np.isfinite(total):
        probabilities = probabilities / total

    result: dict[str, float] = {}
    for index, probability in enumerate(probabilities):
        value = float(probability)
        if value <= 0.0:
            continue
        qiskit_key = format(index, f"0{n_qubits}b")
        optimizer_bitstring = qiskit_key[::-1]
        result[optimizer_bitstring] = result.get(optimizer_bitstring, 0.0) + value
    return result


def _ibm_runtime_result(optimizer) -> dict[str, Any]:
    raw = getattr(optimizer, "ibm_hardware_result", None)
    if isinstance(raw, dict):
        return json_safe(raw)
    return {}


def _ibm_preview_result(optimizer) -> dict[str, Any]:
    raw = getattr(optimizer, "ibm_runtime_preview", None)
    if isinstance(raw, dict):
        return json_safe(raw)
    return {}


def _candidate_row_for_bitstring(
    optimizer,
    bitstring: str,
    *,
    probability: float | None,
    source: str,
    selection_scope: str,
) -> dict[str, Any] | None:
    try:
        bits = np.array(list(map(int, str(bitstring))), dtype=int)
        stats = optimizer.portfolio_stats(bits)
        if getattr(optimizer, "qaoa_export_feasible_only", False) and not optimizer.row_is_feasible(stats):
            return None
        term_stats = optimizer.qubo_term_breakdown(bits)
        return {
            "bitstring": str(bitstring),
            "source": source,
            "selection_scope": selection_scope,
            "probability": None if probability is None else float(probability),
            "qubo_value": optimizer.qubo_value(bits),
            **term_stats,
            **stats,
        }
    except Exception:
        return None


def _type_achievements_from_row(row) -> list[dict[str, Any]]:
    achievements = []
    for prefix in ("type_a", "type_b", "type_c", "type_d", "type_e"):
        if _series_get(row, f"{prefix}_budget") is None:
            continue
        achievements.append(
            {
                "id": prefix,
                "name": _series_get(row, f"{prefix}_name"),
                "budget": _series_get(row, f"{prefix}_budget"),
                "fixed_exposure": _series_get(row, f"{prefix}_fixed"),
                "variable_selected_exposure": _series_get(row, f"{prefix}_variable_selected"),
                "total_achieved_exposure": _series_get(row, f"{prefix}_achieved"),
                "normalized_total_achieved": _series_get(row, f"{prefix}_normalized_achieved"),
                "achieved_raw": _series_get(row, f"{prefix}_achieved"),
                "achieved_normalized": _series_get(row, f"{prefix}_normalized_achieved"),
                "raw_deviation": _series_get(row, f"{prefix}_deviation"),
                "relative_deviation": _series_get(row, f"{prefix}_relative_deviation"),
                "penalty_contribution": _series_get(row, f"{prefix}_penalty"),
                "normalized_penalty_contribution": _series_get(row, f"{prefix}_penalty"),
            }
        )
    return achievements


def _build_reporting_charts(optimizer, second_opinion: dict[str, Any] | None = None) -> dict[str, str | None]:
    classical_breakdown = _qubo_breakdown_chart(optimizer)
    circuit = _circuit_report(optimizer)
    return {
        "risk_return_sharpe": _risk_return_chart(optimizer, metric="sharpe_like", title="Risk / Return - Sharpe Ratio"),
        "risk_return_qubo": _risk_return_chart(optimizer, metric="qubo_value", title="Risk / Return - QUBO Value"),
        "qubo_breakdown": classical_breakdown,
        "qubo_breakdown_classical": classical_breakdown,
        "qubo_breakdown_quantum": _quantum_qubo_breakdown_chart(optimizer),
        "qubo_breakdown_second_opinion": _second_opinion_qubo_breakdown_chart(second_opinion),
        "optimization_history": _optimization_history_chart(optimizer),
        "circuit_overview": _circuit_overview_chart(circuit),
        "solver_comparison": _solver_comparison_chart(optimizer, second_opinion),
    }


def _risk_return_chart(optimizer, metric: str, title: str) -> str | None:
    classical = _sort_df(getattr(optimizer, "classical_results", pd.DataFrame()), optimizer, "qubo_value", True).head(100)
    quantum = _sort_df(getattr(optimizer, "samples_df", pd.DataFrame()), optimizer, "probability", False).head(100)
    if not _has_columns(classical, ("portfolio_vol", "portfolio_return", metric)) and not _has_columns(
        quantum, ("portfolio_vol", "portfolio_return", metric)
    ):
        return None

    fig, ax = plt.subplots(figsize=(9, 5.5))
    _style_axis(fig, ax, title)
    scatter = None
    if _has_columns(classical, ("portfolio_vol", "portfolio_return", metric)):
        values = pd.to_numeric(classical[metric], errors="coerce").fillna(0.0)
        scatter = ax.scatter(
            classical["portfolio_vol"],
            classical["portfolio_return"],
            c=values,
            cmap="viridis",
            s=54,
            alpha=0.82,
            edgecolors="#F8FAFC",
            linewidths=0.5,
            marker="o",
            label="Classical",
        )
    if _has_columns(quantum, ("portfolio_vol", "portfolio_return", metric)):
        values = pd.to_numeric(quantum[metric], errors="coerce").fillna(0.0)
        scatter = ax.scatter(
            quantum["portfolio_vol"],
            quantum["portfolio_return"],
            c=values,
            cmap="plasma",
            s=74,
            alpha=0.75,
            edgecolors="#BAE6FD",
            linewidths=0.8,
            marker="D",
            label="Quantum",
        )

    ax.set_xlabel("Portfolio Volatility", color="#E5EEF8")
    ax.set_ylabel("Portfolio Return", color="#E5EEF8")
    if scatter is not None:
        cbar = fig.colorbar(scatter, ax=ax, shrink=0.82)
        cbar.ax.tick_params(colors="#A9B8D4")
        cbar.outline.set_edgecolor("#284061")
    ax.legend(facecolor="#101933", edgecolor="#284061", labelcolor="#E5EEF8")
    fig.tight_layout()
    return _figure_to_data_url(fig)


def _qubo_breakdown_chart(optimizer) -> str | None:
    df = _sort_df(getattr(optimizer, "classical_results", pd.DataFrame()), optimizer, "qubo_value", True).head(10)
    terms = tuple(
        term
        for term in ("return_term", "risk_term", "budget_term", "type_budget_term")
        if term != "type_budget_term" or term in df.columns
    )
    if df is None or len(df) == 0 or not all(term in df.columns for term in terms):
        return None

    fig, ax = plt.subplots(figsize=(10, 5.8))
    _style_axis(fig, ax, "QUBO Breakdown - Classical Top 10")
    x = np.arange(len(df))
    labels = [f"C{idx + 1}" for idx in range(len(df))]
    bottoms_pos = np.zeros(len(df))
    bottoms_neg = np.zeros(len(df))
    colors = {
        "return_term": "#2ED8A3",
        "risk_term": "#FFB04D",
        "budget_term": "#FF5E7A",
        "type_budget_term": "#A78BFA",
    }
    for term in terms:
        values = pd.to_numeric(df[term], errors="coerce").fillna(0.0).to_numpy(dtype=float)
        positive = np.where(values > 0, values, 0.0)
        negative = np.where(values < 0, values, 0.0)
        ax.bar(x, positive, bottom=bottoms_pos, color=colors[term], alpha=0.9, label=term)
        ax.bar(x, negative, bottom=bottoms_neg, color=colors[term], alpha=0.9)
        bottoms_pos += positive
        bottoms_neg += negative
    if "qubo_value" in df.columns:
        ax.plot(x, pd.to_numeric(df["qubo_value"], errors="coerce").fillna(0.0), color="#F8FAFC", marker="o", label="QUBO")
    ax.set_xticks(x, labels)
    ax.set_ylabel("Contribution", color="#E5EEF8")
    ax.legend(facecolor="#101933", edgecolor="#284061", labelcolor="#E5EEF8", ncol=4)
    fig.tight_layout()
    return _figure_to_data_url(fig)


def _quantum_qubo_breakdown_chart(optimizer) -> str | None:
    exact = getattr(optimizer, "qaoa_exact_best_qubo_df", pd.DataFrame())
    samples = getattr(optimizer, "samples_df", pd.DataFrame())
    source_df = exact if isinstance(exact, pd.DataFrame) and len(exact) else samples
    df = _sort_df(source_df, optimizer, "qubo_value", True).head(10)
    if df is None or len(df) == 0:
        return None
    return _stacked_qubo_breakdown_chart(df, "QUBO Breakdown - Quantum Top 10", "Q")


def _second_opinion_qubo_breakdown_chart(second_opinion: dict[str, Any] | None) -> str | None:
    if not isinstance(second_opinion, dict) or not second_opinion.get("available"):
        return None
    rows = second_opinion.get("best_qubo") or second_opinion.get("samples") or []
    df = pd.DataFrame(rows)
    if df is None or len(df) == 0:
        return None
    sort_col = "qubo_value" if "qubo_value" in df.columns else "probability"
    ascending = sort_col == "qubo_value"
    df = _sort_df(df, None, sort_col, ascending).head(10)
    return _stacked_qubo_breakdown_chart(df, "QUBO Breakdown - Quantum 2nd opinion Top 10", "Q2")


def _stacked_qubo_breakdown_chart(df: pd.DataFrame, title: str, label_prefix: str) -> str | None:
    terms = tuple(
        term
        for term in ("return_term", "risk_term", "budget_term", "type_budget_term")
        if term != "type_budget_term" or term in df.columns
    )
    if df is None or len(df) == 0 or not all(term in df.columns for term in terms):
        return None

    fig, ax = plt.subplots(figsize=(10, 5.8))
    _style_axis(fig, ax, title)
    x = np.arange(len(df))
    labels = [f"{label_prefix}{idx + 1}" for idx in range(len(df))]
    bottoms_pos = np.zeros(len(df))
    bottoms_neg = np.zeros(len(df))
    colors = {
        "return_term": "#2ED8A3",
        "risk_term": "#FFB04D",
        "budget_term": "#FF5E7A",
        "type_budget_term": "#A78BFA",
    }
    for term in terms:
        values = pd.to_numeric(df[term], errors="coerce").fillna(0.0).to_numpy(dtype=float)
        positive = np.where(values > 0, values, 0.0)
        negative = np.where(values < 0, values, 0.0)
        ax.bar(x, positive, bottom=bottoms_pos, color=colors[term], alpha=0.9, label=term)
        ax.bar(x, negative, bottom=bottoms_neg, color=colors[term], alpha=0.9)
        bottoms_pos += positive
        bottoms_neg += negative
    if "qubo_value" in df.columns:
        ax.plot(x, pd.to_numeric(df["qubo_value"], errors="coerce").fillna(0.0), color="#F8FAFC", marker="o", label="QUBO")
    ax.set_xticks(x, labels)
    ax.set_ylabel("Contribution", color="#E5EEF8")
    ax.legend(facecolor="#101933", edgecolor="#284061", labelcolor="#E5EEF8", ncol=4)
    fig.tight_layout()
    return _figure_to_data_url(fig)


def _optimization_history_chart(optimizer) -> str | None:
    history = getattr(optimizer, "history_df", pd.DataFrame())
    if history is None or len(history) == 0:
        return None

    df = history.copy()
    x_col = "iteration" if "iteration" in df.columns else None
    y_candidates = ("expected_qubo", "best_expected_qubo", "energy", "best_energy")
    y_cols = [col for col in y_candidates if col in df.columns]
    if x_col is None or not y_cols:
        return None

    x_values = pd.to_numeric(df[x_col], errors="coerce")
    fig, ax = plt.subplots(figsize=(9.5, 5.4))
    _style_axis(fig, ax, "QAOA Optimization History")
    plotted = False
    colors = {
        "expected_qubo": "#1EC8FF",
        "best_expected_qubo": "#2ED8A3",
        "energy": "#FFB04D",
        "best_energy": "#FF5E7A",
    }
    for col in y_cols:
        y_values = pd.to_numeric(df[col], errors="coerce")
        if y_values.notna().any():
            ax.plot(x_values, y_values, label=col, color=colors.get(col), linewidth=1.8)
            plotted = True
    if not plotted:
        plt.close(fig)
        return None
    ax.set_xlabel("Iteration", color="#E5EEF8")
    ax.set_ylabel("Objective / QUBO", color="#E5EEF8")
    ax.legend(facecolor="#101933", edgecolor="#284061", labelcolor="#E5EEF8")
    fig.tight_layout()
    return _figure_to_data_url(fig)


def _circuit_overview_chart(circuit: dict[str, Any]) -> str | None:
    if not circuit or not circuit.get("available"):
        return None
    metrics = {
        "1Q gates": circuit.get("one_qubit_gates"),
        "2Q gates": circuit.get("two_qubit_gates"),
        "2Q depth": circuit.get("sequential_2q_depth"),
        "total gates": circuit.get("total_gates"),
    }
    clean = {key: value for key, value in metrics.items() if value is not None}
    if not clean:
        return None
    fig, ax = plt.subplots(figsize=(8, 5.2))
    _style_axis(fig, ax, "Circuit Overview")
    ax.bar(list(clean.keys()), [float(value) for value in clean.values()], color=["#1EC8FF", "#7C3AED", "#FFB04D", "#2ED8A3"])
    ax.set_ylabel("Estimated Count", color="#E5EEF8")
    if circuit.get("counts_are_estimated"):
        ax.text(0.01, 0.98, "estimated counts", transform=ax.transAxes, va="top", ha="left", color="#A9B8D4", fontsize=9)
    fig.tight_layout()
    return _figure_to_data_url(fig)


def _solver_comparison_chart(optimizer, second_opinion: dict[str, Any] | None = None) -> str | None:
    if second_opinion is None:
        second_opinion = _qiskit_second_opinion_report(optimizer)
    comparison = pd.DataFrame(_solver_comparison_records(optimizer, second_opinion))
    metrics = ("qubo_value", "portfolio_return", "portfolio_vol", "sharpe_like")
    if comparison is None or len(comparison) == 0 or "solver" not in comparison.columns:
        return None

    fig, axes = plt.subplots(2, 2, figsize=(10, 7))
    fig.patch.set_facecolor("#050816")
    labels = comparison["solver"].map(_display_solver_label).astype(str).tolist()
    for ax, metric in zip(axes.flat, metrics):
        _style_axis(fig, ax, metric)
        if metric not in comparison.columns:
            ax.text(0.5, 0.5, "No data", ha="center", va="center", color="#E5EEF8", transform=ax.transAxes)
            continue
        values = pd.to_numeric(comparison[metric], errors="coerce").fillna(0.0).tolist()
        palette = ["#1EC8FF", "#7C3AED", "#D97706", "#2ED8A3", "#FF5E7A"]
        bars = ax.bar(labels, values, color=palette[: len(labels)], alpha=0.9)
        for bar, value in zip(bars, values):
            offset = 3 if value >= 0 else -12
            va = "bottom" if value >= 0 else "top"
            ax.annotate(
                f"{float(value):.3f}",
                xy=(bar.get_x() + bar.get_width() / 2, value),
                xytext=(0, offset),
                textcoords="offset points",
                ha="center",
                va=va,
                color="#E5EEF8",
                fontsize=8,
            )
        ax.tick_params(axis="x", rotation=12)
    fig.suptitle("Solver Comparison", color="#E5EEF8", fontsize=14, fontweight="bold")
    fig.tight_layout(rect=(0, 0, 1, 0.96))
    return _figure_to_data_url(fig)


def _style_axis(fig, ax, title: str) -> None:
    fig.patch.set_facecolor("#050816")
    ax.set_facecolor("#0A1022")
    ax.set_title(title, color="#1EC8FF", fontweight="bold")
    ax.tick_params(colors="#A9B8D4")
    for spine in ax.spines.values():
        spine.set_color("#284061")
    ax.grid(True, color="#233A68", alpha=0.35)


def _figure_to_data_url(fig) -> str:
    buffer = BytesIO()
    fig.savefig(buffer, format="png", dpi=140, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)
    buffer.seek(0)
    encoded = base64.b64encode(buffer.read()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _candidate_records(
    df: pd.DataFrame,
    optimizer=None,
    sort_by: str = "qubo_value",
    ascending: bool = True,
    limit: int = 20,
) -> list[dict[str, Any]]:
    return _records(_sort_df(df, optimizer, sort_by, ascending).head(limit))


def _portfolio_content_records(optimizer) -> list[dict[str, Any]]:
    classical = getattr(optimizer, "classical_results", pd.DataFrame())
    records = []
    if isinstance(classical, pd.DataFrame) and len(classical):
        best = _sort_df(classical, optimizer, "qubo_value", True).iloc[0]
        records.extend(_portfolio_rows_for_candidate(optimizer, best, "classical_heuristic"))

    qaoa_best = _best_qaoa_candidate(optimizer)
    if qaoa_best is not None:
        records.extend(_portfolio_rows_for_candidate(optimizer, qaoa_best, "qaoa_best_qubo"))

    return json_safe(records)


def _export_mode(optimizer) -> str:
    export_mode = str(getattr(optimizer, "export_mode", DEFAULT_EXPORT_MODE) or DEFAULT_EXPORT_MODE)
    if export_mode not in {
        EXPORT_MODE_INTERNAL_ONLY,
        EXPORT_MODE_QISKIT_EXPORT,
        EXPORT_MODE_IBM_EXTERNAL_RUN,
    }:
        return DEFAULT_EXPORT_MODE
    return export_mode


def _export_mode_diagnostics(optimizer) -> dict[str, Any]:
    export_mode = _export_mode(optimizer)
    diagnostics = getattr(optimizer, "export_mode_diagnostics", None)
    if isinstance(diagnostics, dict) and diagnostics:
        payload = dict(diagnostics)
    else:
        payload = {
            "requested_export_mode": export_mode,
            "export_mode": export_mode,
            "export_mode_label": EXPORT_MODE_LABELS.get(export_mode, export_mode),
            "qiskit_export_requested": export_mode == EXPORT_MODE_QISKIT_EXPORT,
            "ibm_external_run_requested": export_mode == EXPORT_MODE_IBM_EXTERNAL_RUN,
            "hardware_submission": "not_configured",
        }
    payload.setdefault("export_mode", export_mode)
    payload.setdefault("export_mode_label", EXPORT_MODE_LABELS.get(export_mode, export_mode))
    payload.setdefault("hardware_submission", "not_configured")
    ibm_runtime_settings = getattr(optimizer, "ibm_runtime_settings", None)
    if isinstance(ibm_runtime_settings, dict):
        payload.setdefault("ibm_instance", ibm_runtime_settings.get("instance"))
        payload.setdefault("ibm_backend", ibm_runtime_settings.get("backend_name"))
        payload.setdefault("ibm_backend_selection", ibm_runtime_settings.get("backend_selection"))
        payload.setdefault("ibm_fractional_gates", ibm_runtime_settings.get("fractional_gates_enabled"))
        payload.setdefault("ibm_fractional_mode_label", ibm_runtime_settings.get("fractional_mode_label"))
        payload.setdefault(
            "ibm_parallelization", ibm_runtime_settings.get("parallelized_construction_enabled")
        )
        payload.setdefault("ibm_construction_mode_label", ibm_runtime_settings.get("construction_mode_label"))
        payload.setdefault("ibm_hardware_shots", ibm_runtime_settings.get("hardware_shots"))
        payload.setdefault("ibm_hardware_shots_source", ibm_runtime_settings.get("hardware_shots_source"))
        payload.setdefault("comparability_note", ibm_runtime_settings.get("comparability_note"))
    return json_safe(payload)


def _ibm_export_report(optimizer, *, qaoa_executed: bool) -> dict[str, Any]:
    export_mode = _export_mode(optimizer)
    diagnostics = _export_mode_diagnostics(optimizer)
    ibm_runtime_settings = getattr(optimizer, "ibm_runtime_settings", {}) or {}
    use_fractional_gates = bool(ibm_runtime_settings.get("fractional_gates_enabled"))
    parallelize_cost_terms = bool(ibm_runtime_settings.get("parallelized_construction_enabled"))
    preview_result = _ibm_preview_result(optimizer)
    if not qaoa_executed:
        if export_mode == EXPORT_MODE_IBM_EXTERNAL_RUN and preview_result.get("available"):
            selected_preview = dict(preview_result.get("selected_preview") or {})
            metadata = dict(
                selected_preview.get("pretranspile")
                or qaoa_ibm_circuit_metadata(
                    optimizer,
                    use_fractional_gates=use_fractional_gates,
                    parallelize_cost_terms=parallelize_cost_terms,
                )
            )
            post = dict(selected_preview.get("posttranspile") or {})
            metadata.update(
                json_safe(
                    {
                        "available": True,
                        "provider": preview_result.get("provider", "ibm_quantum_platform"),
                        "sdk": preview_result.get("sdk", "qiskit"),
                        "export_mode": export_mode,
                        "export_mode_label": diagnostics.get("export_mode_label"),
                        "dry_run": True,
                        "simulation": False,
                        "hardware_submission": "preview_only",
                        "instance": preview_result.get("instance"),
                        "backend_name": preview_result.get("backend_name"),
                        "backend_details": preview_result.get("backend_details"),
                        "job_id": None,
                        "shots": None,
                        "shots_source": diagnostics.get("ibm_hardware_shots_source"),
                        "comparability_note": diagnostics.get("comparability_note"),
                        "parse_status": "preview_only",
                        "warnings": selected_preview.get("warnings") or [],
                        "posttranspile": post,
                        "transpiled_depth": post.get("depth"),
                        "transpiled_size": post.get("size"),
                        "transpiled_gate_counts": post.get("gate_counts"),
                        "transpiled_total_gates": post.get("total_gates"),
                        "transpiled_two_qubit_gates": post.get("two_qubit_gates"),
                        "transpiled_sequential_2q_depth": post.get("sequential_2q_depth"),
                        "preview_comparison": preview_result.get("comparison") or {},
                        "depth_reference": preview_result.get("depth_reference") or {},
                    }
                )
            )
            return json_safe(metadata)
        return json_safe(
            {
                "available": False,
                "provider": "ibm_quantum",
                "sdk": "qiskit",
                "export_mode": export_mode,
                "export_mode_label": diagnostics.get("export_mode_label"),
                "reason": "QAOA was not executed for this response.",
                "hardware_submission": "not_configured",
            }
        )
    if export_mode == EXPORT_MODE_QISKIT_EXPORT:
        metadata = qaoa_ibm_circuit_metadata(optimizer, use_fractional_gates=use_fractional_gates)
        metadata["export_mode"] = export_mode
        metadata["export_mode_label"] = diagnostics.get("export_mode_label")
        return json_safe(metadata)
    if export_mode == EXPORT_MODE_IBM_EXTERNAL_RUN:
        runtime_result = _ibm_runtime_result(optimizer)
        metadata = dict(
            runtime_result.get("pretranspile")
            or qaoa_ibm_circuit_metadata(optimizer, use_fractional_gates=use_fractional_gates)
        )
        post = dict(runtime_result.get("posttranspile") or {})
        metadata.update(
            json_safe(
                {
                    "available": bool(runtime_result.get("available")),
                    "provider": runtime_result.get("provider", "ibm_quantum"),
                    "sdk": runtime_result.get("sdk", "qiskit"),
                    "export_mode": export_mode,
                    "export_mode_label": diagnostics.get("export_mode_label"),
                    "dry_run": False,
                    "simulation": False,
                    "hardware_submission": runtime_result.get("hardware_submission", "requested"),
                    "instance": runtime_result.get("instance"),
                    "backend_name": runtime_result.get("backend_name"),
                    "backend_details": runtime_result.get("backend_details"),
                    "job_id": runtime_result.get("job_id"),
                    "shots": runtime_result.get("shots"),
                    "shots_source": runtime_result.get("shots_source"),
                    "comparability_note": runtime_result.get("comparability_note"),
                    "parse_status": runtime_result.get("parse_status"),
                    "error": runtime_result.get("error"),
                    "result_snapshot": runtime_result.get("result_snapshot"),
                    "timing": runtime_result.get("timing"),
                    "warnings": runtime_result.get("warnings") or [],
                    "counts": runtime_result.get("counts") or {},
                    "counts_qiskit": runtime_result.get("counts_qiskit") or {},
                    "posttranspile": post,
                    "transpiled_depth": post.get("depth"),
                    "transpiled_size": post.get("size"),
                    "transpiled_gate_counts": post.get("gate_counts"),
                    "transpiled_total_gates": post.get("total_gates"),
                    "transpiled_two_qubit_gates": post.get("two_qubit_gates"),
                    "transpiled_sequential_2q_depth": post.get("sequential_2q_depth"),
                    "depth_reference": runtime_result.get("depth_reference") or {},
                    "reason": runtime_result.get("reason"),
                }
            )
        )
        return json_safe(metadata)
    return json_safe(
        {
            "available": False,
            "provider": "ibm_quantum",
            "sdk": "qiskit",
            "export_mode": export_mode,
            "export_mode_label": diagnostics.get("export_mode_label"),
            "reason": "Qiskit export was not requested for this run.",
            "hardware_submission": "not_configured",
        }
    )


def _circuit_report(optimizer) -> dict[str, Any]:
    n_qubits = _safe_int(getattr(optimizer, "n", None))
    layers = _safe_int(getattr(optimizer, "qaoa_preview_layers", None))
    if layers is None:
        layers = _safe_int(getattr(optimizer, "qaoa_p", None))
    qubo = getattr(optimizer, "Q", np.array([]))
    requested_run_mode = str(getattr(optimizer, "requested_run_mode", "") or "").strip().lower()
    run_mode = str(getattr(optimizer, "run_mode", "") or "").strip().lower()
    qaoa_requested = requested_run_mode in QAOA_MODES or run_mode in QAOA_MODES
    qaoa_configured = bool(getattr(optimizer, "enable_qaoa", False))
    qaoa_available = bool(len(getattr(optimizer, "samples_df", [])))
    qaoa_executed = qaoa_configured or qaoa_available
    export_mode = _export_mode(optimizer)
    export_diagnostics = _export_mode_diagnostics(optimizer)
    ibm_runtime_settings = getattr(optimizer, "ibm_runtime_settings", {}) or {}
    use_fractional_gates = bool(ibm_runtime_settings.get("fractional_gates_enabled"))
    parallelize_cost_terms = bool(ibm_runtime_settings.get("parallelized_construction_enabled"))
    preview_result = _ibm_preview_result(optimizer)
    selected_preview = dict(preview_result.get("selected_preview") or {})
    preview_post = dict(selected_preview.get("posttranspile") or {})
    if not qaoa_requested and not qaoa_executed:
        return json_safe(
            {
                "available": False,
                "reason": "QAOA circuit metrics are unavailable because QAOA was not executed for this response.",
                "n_qubits": n_qubits,
                "layers": layers,
                "export_mode": export_mode,
                "export_mode_label": export_diagnostics.get("export_mode_label"),
                "mixer_type": "x_mixer",
                "cost_terms": _qubo_nonzero_count(qubo),
                "qubo_nonzero_entries": _qubo_nonzero_count(qubo),
                "counts_are_estimated": False,
                "shots_mode": "disabled",
                "qaoa_shots": _safe_int(getattr(optimizer, "qaoa_shots", None)),
                "qaoa_shots_display": "not_applicable",
                "ibm": _ibm_export_report(optimizer, qaoa_executed=False),
            }
        )

    try:
        one_qubit_cost_terms, two_qubit_cost_terms, qubo_nonzero_entries = _qubo_term_counts(qubo)
        n_qubits_int = max(int(n_qubits or 0), 0)
        layers_int = max(int(layers or 0), 0)
        qiskit_metadata = qaoa_ibm_circuit_metadata(
            optimizer,
            use_fractional_gates=use_fractional_gates,
            parallelize_cost_terms=parallelize_cost_terms,
            allow_preview_placeholders=not qaoa_executed,
        )
        qiskit_available = bool(qiskit_metadata.get("qiskit_available"))
        total_gates = (
            _safe_int(qiskit_metadata.get("logical_total_gates_without_measurements"))
            if qiskit_available
            else None
        )
        one_qubit_gates = (
            _safe_int(qiskit_metadata.get("logical_one_qubit_gates_without_measurements"))
            if qiskit_available
            else None
        )
        two_qubit_gates = (
            _safe_int(qiskit_metadata.get("logical_two_qubit_gates_without_measurements"))
            if qiskit_available
            else None
        )
        sequential_2q_depth = (
            _safe_int(qiskit_metadata.get("logical_sequential_2q_depth_without_measurements"))
            if qiskit_available
            else None
        )
        logical_depth = (
            _safe_int(qiskit_metadata.get("qiskit_depth_without_measurements"))
            if qiskit_available
            else None
        )
        if total_gates is None:
            initial_hadamards = n_qubits_int
            mixer_rx = layers_int * n_qubits_int
            cost_rz = layers_int * (one_qubit_cost_terms + two_qubit_cost_terms)
            two_qubit_gates = layers_int * two_qubit_cost_terms * 2
            one_qubit_gates = initial_hadamards + mixer_rx + cost_rz
            total_gates = one_qubit_gates + two_qubit_gates
            sequential_2q_depth = layers_int * two_qubit_cost_terms * 2
            logical_depth = initial_hadamards + layers_int * (
                max(1, one_qubit_cost_terms) + max(1, two_qubit_cost_terms * 3) + 1
            )
        exact_probabilities = bool(
            getattr(optimizer, "qaoa_sim_exact_probabilities", False)
            or getattr(optimizer, "qaoa_limited_exact_probabilities", False)
        )
        qaoa_mode = str(getattr(optimizer, "qaoa_mode", "") or "")
        qaoa_shots = _safe_int(getattr(optimizer, "qaoa_shots", None))
        exact_mode_requested = run_mode == "qaoa_lightning_sim"
        shots_mode = (
            "exact"
            if exact_probabilities or qaoa_mode == "exact_probs" or exact_mode_requested
            else "sampling"
        )
        return json_safe(
            {
                "available": True,
                "n_qubits": n_qubits_int,
                "layers": layers_int,
                "export_mode": export_mode,
                "export_mode_label": export_diagnostics.get("export_mode_label"),
                "mixer_type": "x_mixer",
                "cost_terms": int(one_qubit_cost_terms + two_qubit_cost_terms),
                "qubo_nonzero_entries": int(qubo_nonzero_entries),
                "one_qubit_cost_terms": int(one_qubit_cost_terms),
                "two_qubit_cost_terms": int(two_qubit_cost_terms),
                "total_gates": int(total_gates or 0),
                "one_qubit_gates": int(one_qubit_gates or 0),
                "two_qubit_gates": int(two_qubit_gates or 0),
                "sequential_2q_depth": int(sequential_2q_depth or 0),
                "estimated_circuit_depth": int(logical_depth or 0),
                "metric_source": "qiskit_logical_circuit" if qiskit_available else "structural_formula",
                "fractional_gates_enabled": bool(use_fractional_gates),
                "fractional_mode_label": (
                    "Prefer fractional gates" if use_fractional_gates else "Standard basis"
                ),
                "parallelized_construction_enabled": bool(parallelize_cost_terms),
                "construction_mode_label": (
                    "Parallelized construction"
                    if parallelize_cost_terms
                    else "Current / standard construction"
                ),
                "shots_mode": shots_mode,
                "qaoa_shots": None if shots_mode == "exact" else qaoa_shots,
                "qaoa_shots_display": "exact" if shots_mode == "exact" else (str(qaoa_shots) if qaoa_shots is not None else None),
                "counts_are_estimated": not qiskit_available,
                "preview_backend_name": preview_result.get("backend_name"),
                "preview_backend_details": preview_result.get("backend_details"),
                "preview_fractional_gates_enabled": selected_preview.get("fractional_gates_enabled"),
                "preview_fractional_mode_label": selected_preview.get("fractional_mode_label"),
                "preview_parallelized_construction_enabled": selected_preview.get("parallelized_construction_enabled"),
                "preview_construction_mode_label": selected_preview.get("construction_mode_label"),
                "preview_transpiled_depth": preview_post.get("depth"),
                "preview_transpiled_size": preview_post.get("size"),
                "preview_transpiled_total_gates": preview_post.get("total_gates"),
                "preview_transpiled_two_qubit_gates": preview_post.get("two_qubit_gates"),
                "preview_transpiled_sequential_2q_depth": preview_post.get("sequential_2q_depth"),
                "preview_warnings": selected_preview.get("warnings") or [],
                "preview_comparison": preview_result.get("comparison") or {},
                "preview_available": bool(selected_preview),
                "preview_fallback_reason": preview_result.get("fallback_reason"),
                "preview_selected_failure": preview_result.get("selected_failure") or {},
                "preview_mode_failures": preview_result.get("mode_failures") or {},
                "ibm": _ibm_export_report(optimizer, qaoa_executed=qaoa_executed),
            }
        )
    except Exception as exc:
        return json_safe(
            {
                "available": False,
                "reason": f"Circuit metrics could not be computed: {type(exc).__name__}",
                "n_qubits": n_qubits,
                "layers": layers,
                "export_mode": export_mode,
                "export_mode_label": export_diagnostics.get("export_mode_label"),
                "counts_are_estimated": False,
                "shots_mode": "unknown",
                "qaoa_shots": _safe_int(getattr(optimizer, "qaoa_shots", None)),
                "qaoa_shots_display": None,
                "ibm": _ibm_export_report(optimizer, qaoa_executed=False),
            }
        )


def _qubo_term_counts(qubo) -> tuple[int, int, int]:
    matrix = np.asarray(qubo, dtype=float)
    if matrix.ndim != 2 or matrix.shape[0] == 0:
        return 0, 0, 0
    diagonal_terms = int(np.count_nonzero(np.abs(np.diag(matrix)) > 1e-12))
    upper = np.triu(matrix, k=1)
    two_qubit_terms = int(np.count_nonzero(np.abs(upper) > 1e-12))
    return diagonal_terms, two_qubit_terms, int(np.count_nonzero(np.abs(matrix) > 1e-12))


def _qubo_nonzero_count(qubo) -> int | None:
    try:
        return int(np.count_nonzero(np.abs(np.asarray(qubo, dtype=float)) > 1e-12))
    except Exception:
        return None


def _sort_df(df: pd.DataFrame, optimizer=None, sort_by: str = "qubo_value", ascending: bool = True) -> pd.DataFrame:
    if df is None or len(df) == 0:
        return pd.DataFrame() if df is None else df.copy()
    copy = df.copy()
    if sort_by in copy.columns:
        return copy.sort_values(sort_by, ascending=ascending, na_position="last").reset_index(drop=True)
    if sort_by == "qubo_value" and optimizer is not None:
        try:
            return optimizer.sort_candidates(copy).reset_index(drop=True)
        except Exception:
            pass
    return copy.reset_index(drop=True)


def _records(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df is None or len(df) == 0:
        return []
    df = add_indicative_cost_alias_to_frame(df)
    return json_safe(df.replace({np.inf: np.nan, -np.inf: np.nan}).to_dict(orient="records"))


def _solver_comparison_records(optimizer, second_opinion: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    comparison = getattr(optimizer, "solver_comparison_df", pd.DataFrame())
    if comparison is None or len(comparison) == 0:
        comparison = pd.DataFrame()
    else:
        comparison = comparison.copy()
        if "solver" in comparison.columns:
            comparison["solver"] = comparison["solver"].map(_display_solver_label)

    rows = _dedupe_solver_rows(_records(comparison))
    summary = (second_opinion or {}).get("summary") if isinstance(second_opinion, dict) else None
    if isinstance(summary, dict) and summary.get("available"):
        second_opinion_row = json_safe(
            {
                "solver": "Quantum / QAOA (2nd opinion)",
                "bitstring": summary.get("best_bitstring"),
                "selection_scope": f"{summary.get('source') or 'Qiskit simulation'} comparison",
                "qubo_value": summary.get("qubo_value"),
                "return_term": summary.get("return_term"),
                "risk_term": summary.get("risk_term"),
                "budget_term": summary.get("budget_term"),
                "type_budget_term": summary.get("type_budget_term"),
                "selected_usd": summary.get("selected_usd"),
                "budget_gap": summary.get("budget_gap"),
                "abs_budget_gap": summary.get("abs_budget_gap"),
                "portfolio_return": summary.get("portfolio_return"),
                "portfolio_vol": summary.get("portfolio_vol"),
                "sharpe_like": summary.get("sharpe_like"),
                "cash_weight": summary.get("cash_weight"),
                "probability": summary.get("probability"),
            }
        )
        if not any(_display_solver_label(row.get("solver")) == "Quantum / QAOA (2nd opinion)" for row in rows):
            rows.append(second_opinion_row)
    return _dedupe_solver_rows(rows)


def _display_solver_label(value: Any) -> str:
    text = str(value or "")
    lowered = text.lower()
    if "qiskit" in lowered or "second_opinion" in lowered or "second opinion" in lowered or "2nd opinion" in lowered:
        return "Quantum / QAOA (2nd opinion)"
    if "qaoa" in lowered or "pennylane" in lowered:
        return "Quantum / QAOA"
    return text or "n/a"


def _dedupe_solver_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        solver = _display_solver_label(row.get("solver"))
        if solver in seen:
            continue
        copy = dict(row)
        copy["solver"] = solver
        deduped.append(copy)
        seen.add(solver)
    return deduped


def _tail_df(df: pd.DataFrame, limit: int) -> pd.DataFrame:
    if df is None or len(df) == 0:
        return pd.DataFrame()
    return df.tail(limit).copy()


def _has_columns(df: pd.DataFrame, columns: tuple[str, ...]) -> bool:
    return df is not None and len(df) > 0 and all(column in df.columns for column in columns)


def _safe_attr(obj, name: str):
    return json_safe(getattr(obj, name, None))


def _safe_int(value) -> int | None:
    try:
        if value is None or pd.isna(value):
            return None
        return int(value)
    except Exception:
        return None


def _series_get(row, key: str):
    if isinstance(row, pd.Series):
        return json_safe(row.get(key, None))
    if isinstance(row, dict):
        return json_safe(row.get(key, None))
    return None


def _sum_attr_array(obj, name: str) -> float:
    values = getattr(obj, name, [])
    try:
        return float(np.asarray(values, dtype=float).sum()) if len(values) else 0.0
    except Exception:
        return 0.0


def _len_attr(obj, name: str) -> int:
    try:
        return int(len(getattr(obj, name, [])))
    except Exception:
        return 0


def _currency_code(optimizer) -> str:
    settings = getattr(optimizer, "settings", {}) or {}
    for key in ("currency_code", "currency", "budget_currency"):
        value = settings.get(key) if isinstance(settings, dict) else None
        if value not in (None, ""):
            return str(value).strip().upper()
    return "USD"


def _decision_state_space(n_value) -> str | None:
    try:
        n = int(n_value)
        return f"2^{n} = {(1 << n):,} bitstrings"
    except Exception:
        return None


def _safe_get(row, key: str):
    return row.get(key, None)


def _records_with_keys(df: pd.DataFrame, keys: tuple[str, ...]) -> list[dict[str, Any]]:
    if df is None or len(df) == 0:
        return []
    df = add_indicative_cost_alias_to_frame(df)
    present = [key for key in keys if key in df.columns]
    return df[present].to_dict(orient="records")


def _qaoa_status(optimizer) -> str:
    if bool(getattr(optimizer, "enable_qaoa", False)) and int(len(getattr(optimizer, "samples_df", []))) > 0:
        return "available"
    return "disabled_or_not_available_in_version_7_classical_only"


def _best_qaoa_candidate(optimizer):
    exact = getattr(optimizer, "qaoa_exact_best_qubo_df", pd.DataFrame())
    samples = getattr(optimizer, "samples_df", pd.DataFrame())
    source_df = exact if isinstance(exact, pd.DataFrame) and len(exact) else samples
    if not isinstance(source_df, pd.DataFrame) or len(source_df) == 0:
        return None
    return _sort_df(source_df, optimizer, "qubo_value", True).iloc[0]


def _portfolio_rows_for_candidate(optimizer, row, source: str) -> list[dict[str, Any]]:
    bitstring = str(_series_get(row, "bitstring") or "")
    if not bitstring:
        return []
    try:
        bitvec = np.array(list(map(int, bitstring)), dtype=int)
        rows = optimizer.exploded_portfolio_rows(1, source, bitstring, bitvec)
        return _records(pd.DataFrame(rows))
    except Exception:
        return []
