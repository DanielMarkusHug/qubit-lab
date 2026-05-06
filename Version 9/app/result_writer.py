"""Convert optimizer objects into stable JSON responses."""

from __future__ import annotations

import base64
from io import BytesIO
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from app.config import Config
from app.cost_columns import INDICATIVE_COST_COLUMN, LEGACY_COST_COLUMN, add_indicative_cost_alias_to_frame
from app.schemas import json_safe
from app.type_constraints import (
    achievements_for_bitvec,
    constraints_for_json,
    type_budget_term_columns,
    type_candidate_columns,
    type_size_columns,
)
from app.usage_policy import runtime_estimate_payload
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
) -> dict[str, Any]:
    full_payload = _build_full_classical_response(
        run_id,
        optimizer,
        workbook_summary,
        logs,
        mode=mode,
        solver=solver,
        include_reporting_charts=response_level == "full",
    )
    _attach_policy_metadata(full_payload, usage_context, policy_result, license_info, actual_runtime_sec)
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
        "qaoa_exact_probabilities": bool(getattr(optimizer, "qaoa_limited_exact_probabilities", False)),
        "qaoa_runtime_sec": _safe_attr(optimizer, "qaoa_runtime_sec"),
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


def _compact_diagnostics(diagnostics: dict[str, Any], log_limit: int = 20) -> dict[str, Any]:
    keys = (
        "budget_usd",
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
) -> dict[str, Any]:
    warnings = workbook_warnings(optimizer)
    return json_safe(
        {
            "status": "completed",
            "model_version": Config.MODEL_VERSION,
            "filename": filename,
            "license": license_info,
            "workbook_summary": build_workbook_summary(optimizer),
            "runtime_estimate": runtime_estimate_payload(mode, policy_result),
            "diagnostics": {
                "service": Config.SERVICE_NAME,
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
                },
                "effective_settings": getattr(policy_result, "effective_settings", {}),
                "random_seed": getattr(policy_result.runtime_inputs, "random_seed", None),
                "cost_column_used": _safe_attr(optimizer, "input_cost_column"),
                "cost_column_internal": _safe_attr(optimizer, "internal_cost_column"),
                "cost_column_normalized": bool(getattr(optimizer, "cost_column_normalized", False)),
                "cost_column_conflicting_row_count": int(
                    getattr(optimizer, "cost_column_conflicting_row_count", 0) or 0
                ),
                "additional_type_constraints_count": int(
                    getattr(optimizer, "additional_type_constraints_count", 0) or 0
                ),
                "additional_type_constraints": constraints_for_json(optimizer),
                "logs": cap_logs(logs, 50),
            },
        }
    )


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
            "portfolio_contents": reporting.get("portfolio_contents", []),
            "circuit": reporting.get("circuit", {}),
        }
    return reporting


def _build_reporting(optimizer, include_charts: bool = False) -> dict[str, Any]:
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
        "summary": _build_reporting_summary(optimizer),
        "classical_candidates": classical_candidates,
        "quantum_samples": quantum_samples,
        "qaoa_best_qubo": qaoa_best_qubo,
        "solver_comparison": _records(getattr(optimizer, "solver_comparison_df", pd.DataFrame())),
        "portfolio_contents": _portfolio_content_records(optimizer),
        "optimization_history": _records(_tail_df(getattr(optimizer, "history_df", pd.DataFrame()), 200)),
        "circuit": _circuit_report(optimizer),
        "charts": _build_reporting_charts(optimizer) if include_charts else {},
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
                "achieved_raw": _series_get(row, f"{prefix}_achieved"),
                "achieved_normalized": _series_get(row, f"{prefix}_normalized_achieved"),
                "raw_deviation": _series_get(row, f"{prefix}_deviation"),
                "relative_deviation": _series_get(row, f"{prefix}_relative_deviation"),
                "normalized_penalty_contribution": _series_get(row, f"{prefix}_penalty"),
            }
        )
    return achievements


def _build_reporting_charts(optimizer) -> dict[str, str | None]:
    classical_breakdown = _qubo_breakdown_chart(optimizer)
    circuit = _circuit_report(optimizer)
    return {
        "risk_return_sharpe": _risk_return_chart(optimizer, metric="sharpe_like", title="Risk / Return - Sharpe Ratio"),
        "risk_return_qubo": _risk_return_chart(optimizer, metric="qubo_value", title="Risk / Return - QUBO Value"),
        "qubo_breakdown": classical_breakdown,
        "qubo_breakdown_classical": classical_breakdown,
        "qubo_breakdown_quantum": _quantum_qubo_breakdown_chart(optimizer),
        "optimization_history": _optimization_history_chart(optimizer),
        "circuit_overview": _circuit_overview_chart(circuit),
        "solver_comparison": _solver_comparison_chart(optimizer),
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
    row = _best_qaoa_candidate(optimizer)
    if row is None:
        return None
    return _single_qubo_breakdown_chart(row, "QUBO Breakdown - Best Quantum Candidate")


def _single_qubo_breakdown_chart(row, title: str) -> str | None:
    terms = ["return_term", "risk_term", "budget_term"]
    if _series_get(row, "type_budget_term") is not None:
        terms.append("type_budget_term")
    values = []
    for term in terms:
        value = _series_get(row, term)
        if value is None:
            return None
        values.append(float(value))
    qubo_value = _series_get(row, "qubo_value")
    if qubo_value is None:
        return None

    labels = ["Return", "Risk", "Budget"]
    if "type_budget_term" in terms:
        labels.append("Type")
    labels.append("QUBO")
    heights = values + [float(qubo_value)]
    colors = ["#2ED8A3", "#FFB04D", "#FF5E7A"]
    if "type_budget_term" in terms:
        colors.append("#A78BFA")
    colors.append("#1EC8FF")
    fig, ax = plt.subplots(figsize=(8, 5.2))
    _style_axis(fig, ax, title)
    ax.bar(labels, heights, color=colors, alpha=0.9)
    ax.axhline(0, color="#F8FAFC", linewidth=0.8, alpha=0.65)
    bitstring = _series_get(row, "bitstring")
    probability = _series_get(row, "probability")
    subtitle = f"bitstring={bitstring}"
    if probability is not None:
        subtitle += f"  probability={float(probability):.4f}"
    ax.text(0.01, 0.98, subtitle, transform=ax.transAxes, va="top", ha="left", color="#A9B8D4", fontsize=9)
    ax.set_ylabel("Contribution / QUBO", color="#E5EEF8")
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


def _solver_comparison_chart(optimizer) -> str | None:
    comparison = getattr(optimizer, "solver_comparison_df", pd.DataFrame())
    metrics = ("qubo_value", "portfolio_return", "portfolio_vol", "sharpe_like")
    if comparison is None or len(comparison) == 0 or "solver" not in comparison.columns:
        return None

    fig, axes = plt.subplots(2, 2, figsize=(10, 7))
    fig.patch.set_facecolor("#050816")
    labels = comparison["solver"].astype(str).tolist()
    for ax, metric in zip(axes.flat, metrics):
        _style_axis(fig, ax, metric)
        if metric not in comparison.columns:
            ax.text(0.5, 0.5, "No data", ha="center", va="center", color="#E5EEF8", transform=ax.transAxes)
            continue
        values = pd.to_numeric(comparison[metric], errors="coerce").fillna(0.0).tolist()
        ax.bar(labels, values, color=["#1EC8FF", "#7C3AED", "#2ED8A3"][: len(labels)], alpha=0.9)
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


def _circuit_report(optimizer) -> dict[str, Any]:
    n_qubits = _safe_int(getattr(optimizer, "n", None))
    layers = _safe_int(getattr(optimizer, "qaoa_p", None))
    qubo = getattr(optimizer, "Q", np.array([]))
    qaoa_configured = bool(getattr(optimizer, "enable_qaoa", False))
    qaoa_available = bool(len(getattr(optimizer, "samples_df", [])))
    if not qaoa_configured and not qaoa_available:
        return json_safe(
            {
                "available": False,
                "reason": "QAOA circuit metrics are unavailable because QAOA was not executed for this response.",
                "n_qubits": n_qubits,
                "layers": layers,
                "mixer_type": "x_mixer",
                "cost_terms": _qubo_nonzero_count(qubo),
                "qubo_nonzero_entries": _qubo_nonzero_count(qubo),
                "counts_are_estimated": False,
                "shots_mode": "disabled",
                "qaoa_shots": _safe_int(getattr(optimizer, "qaoa_shots", None)),
                "qaoa_shots_display": "not_applicable",
            }
        )

    try:
        one_qubit_cost_terms, two_qubit_cost_terms, qubo_nonzero_entries = _qubo_term_counts(qubo)
        n_qubits_int = max(int(n_qubits or 0), 0)
        layers_int = max(int(layers or 0), 0)
        initial_hadamards = n_qubits_int
        mixer_rx = layers_int * n_qubits_int
        cost_rz = layers_int * (one_qubit_cost_terms + two_qubit_cost_terms)
        two_qubit_gates = layers_int * two_qubit_cost_terms * 2
        one_qubit_gates = initial_hadamards + mixer_rx + cost_rz
        total_gates = one_qubit_gates + two_qubit_gates
        sequential_2q_depth = layers_int * two_qubit_cost_terms * 2
        estimated_circuit_depth = initial_hadamards + layers_int * (
            max(1, one_qubit_cost_terms) + max(1, two_qubit_cost_terms * 3) + 1
        )
        exact_probabilities = bool(getattr(optimizer, "qaoa_limited_exact_probabilities", False))
        qaoa_mode = str(getattr(optimizer, "qaoa_mode", "") or "")
        shots_mode = "exact" if exact_probabilities or qaoa_mode == "exact_probs" else "sampling"
        qaoa_shots = _safe_int(getattr(optimizer, "qaoa_shots", None))
        return json_safe(
            {
                "available": True,
                "n_qubits": n_qubits_int,
                "layers": layers_int,
                "mixer_type": "x_mixer",
                "cost_terms": int(one_qubit_cost_terms + two_qubit_cost_terms),
                "qubo_nonzero_entries": int(qubo_nonzero_entries),
                "one_qubit_cost_terms": int(one_qubit_cost_terms),
                "two_qubit_cost_terms": int(two_qubit_cost_terms),
                "total_gates": int(total_gates),
                "one_qubit_gates": int(one_qubit_gates),
                "two_qubit_gates": int(two_qubit_gates),
                "sequential_2q_depth": int(sequential_2q_depth),
                "estimated_circuit_depth": int(estimated_circuit_depth),
                "shots_mode": shots_mode,
                "qaoa_shots": None if shots_mode == "exact" else qaoa_shots,
                "qaoa_shots_display": "exact" if shots_mode == "exact" else (str(qaoa_shots) if qaoa_shots is not None else None),
                "counts_are_estimated": True,
            }
        )
    except Exception as exc:
        return json_safe(
            {
                "available": False,
                "reason": f"Circuit metrics could not be computed: {type(exc).__name__}",
                "n_qubits": n_qubits,
                "layers": layers,
                "counts_are_estimated": False,
                "shots_mode": "unknown",
                "qaoa_shots": _safe_int(getattr(optimizer, "qaoa_shots", None)),
                "qaoa_shots_display": None,
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
