"""Framework-neutral QAOA code export packages and renderers."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from app.config import Config
from app.cost_columns import INDICATIVE_COST_COLUMN
from app.schemas import ApiError, json_safe
from app.type_constraints import TYPE_SLOTS, constraints_for_json


PACKAGE_SCHEMA = "qaoa-rqp-code-export-package"
PACKAGE_SCHEMA_VERSION = 1
LEGAL_URL = "https://qubit-lab.ch/legal"

TARGET_QISKIT_NOTEBOOK = "qiskit_notebook"
TARGET_QISKIT_PY = "qiskit_py"
TARGET_PENNYLANE_NOTEBOOK = "pennylane_notebook"
TARGET_CIRQ_NOTEBOOK = "cirq_notebook"
TARGET_QUANTINUUM_NOTEBOOK = "quantinuum_notebook"


@dataclass(frozen=True)
class CodeExportTarget:
    value: str
    label: str
    filename: str
    content_type: str
    min_level_id: int
    enabled: bool = True


@dataclass(frozen=True)
class RenderedCodeExport:
    filename: str
    content_type: str
    content: str


CODE_EXPORT_TARGETS: dict[str, CodeExportTarget] = {
    TARGET_QISKIT_NOTEBOOK: CodeExportTarget(
        value=TARGET_QISKIT_NOTEBOOK,
        label="Qiskit Notebook",
        filename="qaoa_rqp_qiskit.ipynb",
        content_type="application/x-ipynb+json",
        min_level_id=2,
    ),
    TARGET_QISKIT_PY: CodeExportTarget(
        value=TARGET_QISKIT_PY,
        label="Qiskit Python",
        filename="qaoa_rqp_qiskit.py",
        content_type="text/x-python; charset=utf-8",
        min_level_id=2,
    ),
    TARGET_PENNYLANE_NOTEBOOK: CodeExportTarget(
        value=TARGET_PENNYLANE_NOTEBOOK,
        label="PennyLane Notebook",
        filename="qaoa_rqp_pennylane.ipynb",
        content_type="application/x-ipynb+json",
        min_level_id=2,
    ),
    TARGET_CIRQ_NOTEBOOK: CodeExportTarget(
        value=TARGET_CIRQ_NOTEBOOK,
        label="Cirq Notebook",
        filename="qaoa_rqp_cirq.ipynb",
        content_type="application/x-ipynb+json",
        min_level_id=3,
    ),
    TARGET_QUANTINUUM_NOTEBOOK: CodeExportTarget(
        value=TARGET_QUANTINUUM_NOTEBOOK,
        label="Quantinuum Notebook",
        filename="qaoa_rqp_quantinuum.ipynb",
        content_type="application/x-ipynb+json",
        min_level_id=5,
        enabled=False,
    ),
}


def code_export_targets_payload() -> list[dict[str, Any]]:
    return [
        {
            "value": target.value,
            "label": target.label,
            "filename": target.filename,
            "content_type": target.content_type,
            "min_level_id": target.min_level_id,
            "enabled": target.enabled,
        }
        for target in CODE_EXPORT_TARGETS.values()
    ]


def validate_code_export_target(target_value: str | None, usage_context=None) -> CodeExportTarget:
    target_key = str(target_value or "").strip().lower()
    target = CODE_EXPORT_TARGETS.get(target_key)
    if target is None:
        raise ApiError(
            400,
            "unsupported_code_export_target",
            "Unsupported code export target.",
            {
                "target": target_key or None,
                "supported_targets": list(CODE_EXPORT_TARGETS),
            },
        )
    if not target.enabled:
        raise ApiError(
            501,
            "code_export_target_not_enabled",
            "This code export target is not enabled yet.",
            {"target": target.value, "label": target.label},
        )
    if usage_context is not None and _usage_level_id(usage_context) < target.min_level_id:
        raise ApiError(
            403,
            "code_export_not_allowed",
            "This code export target is not available for the current usage level.",
            {
                "target": target.value,
                "required_min_level_id": target.min_level_id,
                "usage_level": getattr(usage_context, "usage_level_name", None),
                "usage_level_id": _usage_level_id(usage_context),
            },
        )
    return target


def build_qaoa_code_export_package(
    optimizer,
    *,
    mode: str,
    solver: str,
    workbook_summary: dict[str, Any] | None = None,
    policy_result=None,
) -> dict[str, Any] | None:
    gammas = _float_list(getattr(optimizer, "best_gammas", None))
    betas = _float_list(getattr(optimizer, "best_betas", None))
    if not gammas or not betas:
        return None

    n_qubits = int(getattr(optimizer, "n", 0) or 0)
    if n_qubits <= 0:
        return None

    try:
        h_terms, j_terms, offset = optimizer._qubo_to_ising(optimizer.Q, optimizer.constant)
    except Exception:
        return None

    workbook_summary = workbook_summary or {}
    fixed_df = getattr(optimizer, "fixed_options_df", pd.DataFrame())
    variable_df = getattr(optimizer, "variable_options_df", pd.DataFrame())
    fixed_assets = _asset_rows(fixed_df, role="fixed")
    variable_assets = _asset_rows(variable_df, role="variable")
    best_bitstring = _best_qaoa_bitstring(optimizer) or _best_classical_bitstring(optimizer)
    effective_settings = getattr(policy_result, "effective_settings", {}) if policy_result is not None else {}
    qaoa_shots = effective_settings.get("qaoa_shots", getattr(optimizer, "qaoa_shots", None))
    shots_mode = effective_settings.get("shots_mode") or _shots_mode(optimizer)

    package = {
        "schema": PACKAGE_SCHEMA,
        "schema_version": PACKAGE_SCHEMA_VERSION,
        "generator": {
            "tool": "QAOA Rapid Quantum Prototyping",
            "organization": "qubit-lab.ch",
            "model_version": Config.MODEL_VERSION,
            "service": Config.SERVICE_NAME,
            "legal_url": LEGAL_URL,
        },
        "use_case": {
            "source": "pre-optimized Excel workbook",
            "mode": mode,
            "solver": solver,
            "n_qubits": n_qubits,
            "fixed_positions": _safe_len(fixed_df),
            "variable_positions": _safe_len(variable_df),
            "asset_variable_positions": _safe_len(variable_df),
            "total_solver_qubits": n_qubits,
            "budget_usd": _float_or_none(getattr(optimizer, "budget_usd", None)),
            "lambda_budget": _float_or_none(getattr(optimizer, "lambda_budget", None)),
            "lambda_variance": _float_or_none(getattr(optimizer, "lambda_variance", None)),
            "risk_free_rate": _float_or_none(getattr(optimizer, "risk_free", None)),
            "additional_type_constraints_count": int(getattr(optimizer, "additional_type_constraints_count", 0) or 0),
            "workbook_summary": workbook_summary,
        },
        "qaoa": {
            "layers": int(len(gammas)),
            "gammas": gammas,
            "betas": betas,
            "shots_mode": _str_or_none(shots_mode),
            "qaoa_shots": _int_or_none(qaoa_shots),
            "qaoa_shots_display": effective_settings.get("qaoa_shots_display"),
            "best_bitstring": best_bitstring,
            "qaoa_mode": _str_or_none(getattr(optimizer, "qaoa_mode", None)),
            "simulation_backend": _str_or_none(getattr(optimizer, "simulation_backend", None)),
            "max_export_rows": _int_or_none(getattr(optimizer, "qaoa_max_export_rows", None)),
            "export_sort_by": _str_or_none(getattr(optimizer, "qaoa_export_sort_by", None)),
            "total_states_considered": _int_or_none(getattr(optimizer, "qaoa_total_states_considered", None)),
            "total_nonzero_states": _int_or_none(getattr(optimizer, "qaoa_total_nonzero_states", None)),
        },
        "ising": {
            "h_terms": _float_list(h_terms),
            "j_terms": _j_terms_list(j_terms),
            "offset": _float_or_none(offset),
        },
        "bit_order": {
            "optimizer_bitstring_order": "q0...qN-1",
            "qiskit_counts_key_order": "cN-1...c0",
            "counts_decoder": "reverse_qiskit_count_key",
        },
        "assets": {
            "fixed_assets": fixed_assets,
            "variable_assets": variable_assets,
        },
        "market_data": {
            "covariance": _covariance_package(optimizer, fixed_df, variable_df),
        },
        "type_budgets": constraints_for_json(optimizer),
        "decision_variables": variable_assets,
    }

    if policy_result is not None:
        package["runtime_settings"] = {
            "layers": policy_result.runtime_inputs.layers,
            "iterations": policy_result.runtime_inputs.iterations,
            "restarts": policy_result.runtime_inputs.restarts,
            "warm_start": policy_result.runtime_inputs.warm_start,
            "random_seed": policy_result.runtime_inputs.random_seed,
            "qaoa_shots": _int_or_none(qaoa_shots),
            "qaoa_shots_display": effective_settings.get("qaoa_shots_display"),
            "shots_mode": _str_or_none(shots_mode),
            "effective_settings": effective_settings,
        }

    return json_safe(package)


def extract_code_export_package(payload: dict[str, Any]) -> dict[str, Any]:
    candidate = payload.get("package") or payload.get("code_export_package")
    if candidate is None and isinstance(payload.get("result"), dict):
        candidate = payload["result"].get("code_export_package")
    if candidate is None:
        candidate = payload
    if not isinstance(candidate, dict):
        raise ApiError(400, "code_export_package_missing", "A code export package is required.")
    validate_code_export_package(candidate)
    return json_safe(candidate)


def validate_code_export_package(package: dict[str, Any]) -> None:
    if package.get("schema") != PACKAGE_SCHEMA:
        raise ApiError(
            400,
            "invalid_code_export_package",
            "The code export package has an unsupported schema.",
            {"schema": package.get("schema"), "expected_schema": PACKAGE_SCHEMA},
        )
    if int(package.get("schema_version", 0) or 0) != PACKAGE_SCHEMA_VERSION:
        raise ApiError(
            400,
            "invalid_code_export_package",
            "The code export package has an unsupported schema version.",
            {
                "schema_version": package.get("schema_version"),
                "expected_schema_version": PACKAGE_SCHEMA_VERSION,
            },
        )
    n_qubits = int(package.get("use_case", {}).get("n_qubits") or package.get("n_qubits") or 0)
    gammas = package.get("qaoa", {}).get("gammas")
    betas = package.get("qaoa", {}).get("betas")
    h_terms = package.get("ising", {}).get("h_terms")
    if n_qubits <= 0 or not isinstance(gammas, list) or not isinstance(betas, list) or not isinstance(h_terms, list):
        raise ApiError(
            400,
            "invalid_code_export_package",
            "The code export package is missing QAOA circuit parameters.",
        )


def render_code_export(package: dict[str, Any], target_value: str, usage_context=None) -> RenderedCodeExport:
    target = validate_code_export_target(target_value, usage_context)
    validate_code_export_package(package)
    if target.value == TARGET_QISKIT_NOTEBOOK:
        content = _notebook_json(
            [
                _markdown_cell(_header_markdown(package, target.label)),
                _code_cell(_dependency_install_cell(target.label)),
                _code_cell(_package_cell(package)),
                _code_cell(_portfolio_analysis_code()),
                _code_cell(_qiskit_builder_code(include_demo=True)),
                _code_cell(_qiskit_statevector_code()),
                _code_cell(_qiskit_optional_hardware_code()),
            ]
        )
    elif target.value == TARGET_QISKIT_PY:
        content = _qiskit_py(package)
    elif target.value == TARGET_PENNYLANE_NOTEBOOK:
        content = _notebook_json(
            [
                _markdown_cell(_header_markdown(package, target.label)),
                _code_cell(_dependency_install_cell(target.label)),
                _code_cell(_package_cell(package)),
                _code_cell(_portfolio_analysis_code()),
                _code_cell(_pennylane_builder_code()),
            ]
        )
    elif target.value == TARGET_CIRQ_NOTEBOOK:
        content = _notebook_json(
            [
                _markdown_cell(_header_markdown(package, target.label)),
                _code_cell(_dependency_install_cell(target.label)),
                _code_cell(_package_cell(package)),
                _code_cell(_portfolio_analysis_code()),
                _code_cell(_cirq_builder_code()),
            ]
        )
    else:
        raise ApiError(501, "code_export_target_not_enabled", "This code export target is not enabled yet.")
    return RenderedCodeExport(
        filename=target.filename,
        content_type=target.content_type,
        content=content,
    )


def _header_markdown(package: dict[str, Any], label: str) -> str:
    use_case = package.get("use_case", {})
    qaoa = package.get("qaoa", {})
    runtime = package.get("runtime_settings", {})
    sections = [
        f"# {_export_title(label)}",
        "## QAOA Rapid Quantum Prototyping by qubit-lab.ch",
        (
            "This file was generated from a pre-optimized Excel use case. "
            "It reconstructs the final optimized QAOA circuit from the exported "
            "Ising coefficients and optimized angle parameters."
        ),
        "## Intended Use\n\n- Technical review\n- Reproducibility checks\n- Further experimentation outside the RQP web interface",
        "\n".join(
            [
                "## Run Summary",
                f"- Fixed positions: {_display_value(use_case.get('fixed_positions'))}",
                f"- Variable positions / asset qubits: {_display_value(use_case.get('variable_positions'))}",
                f"- Total solver qubits: {_display_value(use_case.get('total_solver_qubits') or use_case.get('n_qubits'))}",
                f"- Budget: {_money_value(use_case.get('budget_usd'))}",
                f"- Budget penalty lambda: {_display_value(use_case.get('lambda_budget'))}",
                f"- Variance penalty lambda: {_display_value(use_case.get('lambda_variance'))}",
                f"- QAOA layers: {_display_value(qaoa.get('layers'))}",
                f"- Shots mode: {_display_value(qaoa.get('qaoa_shots_display') or qaoa.get('shots_mode'))}",
                f"- Candidate export cap: {_display_value(qaoa.get('max_export_rows'))}",
                f"- Candidate export sort: {_display_value(qaoa.get('export_sort_by'))}",
                f"- Restarts: {_display_value(runtime.get('restarts'))}",
                f"- Optimizer iterations: {_display_value(runtime.get('iterations'))}",
                f"- Warm start: {_display_value(runtime.get('warm_start'))}",
                f"- Random seed: {_display_value(runtime.get('random_seed'))}",
                f"- Additional subtype budgets: {_display_value(use_case.get('additional_type_constraints_count'))}",
            ]
        ),
        _dependency_text(label),
        f"Copyright (c) qubit-lab.ch.\n\nLegal terms: {LEGAL_URL}",
    ]
    return "\n\n".join(section for section in sections if section)


def _python_header(package: dict[str, Any], label: str) -> str:
    text = _header_markdown(package, label)
    return "\"\"\"\n" + text + "\n\"\"\"\n"


def _dependency_text(label: str) -> str:
    lowered = label.lower()
    if "qiskit" in lowered:
        return (
            "## Expected Dependencies\n\n"
            "- qiskit\n- numpy\n- matplotlib (optional, for plots)\n"
            "- qiskit-ibm-runtime (optional IBM hardware cell)"
        )
    if "pennylane" in lowered:
        return "## Expected Dependencies\n\n- pennylane\n- numpy\n- matplotlib (optional, for plots)"
    if "cirq" in lowered:
        return "## Expected Dependencies\n\n- cirq\n- numpy\n- matplotlib (optional, for plots)"
    return ""


def _export_title(label: str) -> str:
    lowered = label.lower()
    if "qiskit" in lowered:
        return "Qiskit Export"
    if "pennylane" in lowered:
        return "PennyLane Export"
    if "cirq" in lowered:
        return "Cirq Export"
    if "quantinuum" in lowered:
        return "Quantinuum Export"
    return label


def _display_value(value) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:.6g}"
    return str(value)


def _money_value(value) -> str:
    numeric = _float_or_none(value)
    if numeric is None:
        return "n/a"
    return f"{numeric:,.0f}"


def _package_cell(package: dict[str, Any]) -> str:
    package_json = json.dumps(package, indent=2, sort_keys=True)
    return (
        "# Cell purpose: load the self-contained export package used by all later cells.\n"
        "# It contains the pre-optimized use case parameters, Ising terms,\n"
        "# optimized QAOA angles, fixed and variable assets, covariance data,\n"
        "# exact subtype budgets, bit-order metadata,\n"
        "# and decision-variable labels.\n"
        "import json\n\n"
        "PACKAGE = json.loads(r'''\n"
        f"{package_json}\n"
        "''')\n"
    )


def _dependency_install_cell(label: str) -> str:
    lowered = label.lower()
    if "qiskit" in lowered:
        install = "%pip install qiskit numpy matplotlib"
        optional = "%pip install qiskit-ibm-runtime"
    elif "pennylane" in lowered:
        lines = [
            "# Cell purpose: install the packages required by this generated notebook.",
            "# PennyLane 0.44 is tested here with Python 3.11+.",
            "# If this cell raises, switch the notebook kernel to Python 3.11 or newer.",
            "import sys",
            "if sys.version_info < (3, 11):",
            "    raise RuntimeError(",
            "        f\"This PennyLane export needs a Python 3.11+ Jupyter kernel; \"",
            "        f\"the active kernel is Python {sys.version.split()[0]}.\"",
            "    )",
            '%pip install "pennylane>=0.44,<0.45" numpy matplotlib',
        ]
        return "\n".join(lines) + "\n"
    elif "cirq" in lowered:
        install = "%pip install cirq numpy matplotlib"
        optional = None
    else:
        install = "%pip install numpy matplotlib"
        optional = None
    lines = [
        "# Cell purpose: install the packages required by this generated notebook.",
        "# Run this cell once if imports fail. Restart/re-run the kernel after installation if needed.",
        install,
    ]
    if optional:
        lines.extend(
            [
                "",
                "# Optional IBM Runtime support for the hardware submission cell:",
                f"# {optional}",
            ]
        )
    return "\n".join(lines) + "\n"


def _portfolio_analysis_code() -> str:
    return r'''
# Cell purpose: reconstruct the selected full portfolio and report financial metrics.
# These helpers are framework-neutral and are reused by the Qiskit, PennyLane, and Cirq cells.
import math
import time
import numpy as np


def _package_asset_rows(package, key):
    assets = package.get("assets", {}) or {}
    if key in assets:
        return list(assets.get(key) or [])
    if key == "variable_assets":
        return list(package.get("decision_variables") or [])
    return []


def _as_float(value, default=0.0):
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(result):
        return default
    return result


def _as_int(value, default=None):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _fmt_money(value):
    return f"{_as_float(value):,.0f}"


def _fmt_decimal(value, digits=6):
    value = _as_float(value, float("nan"))
    if not math.isfinite(value):
        return "n/a"
    return f"{value:.{digits}g}"


def _fmt_pct(value):
    value = _as_float(value, float("nan"))
    if not math.isfinite(value):
        return "n/a"
    return f"{100.0 * value:.3f}%"


def _short(value, width=28):
    text = "" if value is None else str(value)
    return text if len(text) <= width else text[: max(width - 1, 1)] + "..."


def _bitstring_bits(bitstring, n_qubits):
    if bitstring is None:
        return "0" * int(n_qubits)
    text = "".join(ch for ch in str(bitstring).strip() if ch in "01")
    if len(text) < int(n_qubits):
        text = text.ljust(int(n_qubits), "0")
    return text[: int(n_qubits)]


def reconstructed_qubo_value(package, bitstring):
    """Reconstruct the optimizer QUBO objective from exported Ising terms."""
    n_qubits = int((package.get("use_case") or {}).get("n_qubits") or 0)
    bits = _bitstring_bits(bitstring, n_qubits)
    z_values = np.asarray([1.0 - 2.0 * int(bit) for bit in bits], dtype=float)
    ising = package.get("ising") or {}
    h_terms = np.asarray(ising.get("h_terms") or [], dtype=float)
    if len(h_terms) < n_qubits:
        h_terms = np.pad(h_terms, (0, n_qubits - len(h_terms)))
    total = _as_float(ising.get("offset"))
    total += float(np.dot(h_terms[:n_qubits], z_values))
    for term in ising.get("j_terms") or []:
        if len(term) < 3:
            continue
        i = _as_int(term[0], -1)
        j = _as_int(term[1], -1)
        coeff = _as_float(term[2])
        if 0 <= i < n_qubits and 0 <= j < n_qubits:
            total += coeff * float(z_values[i]) * float(z_values[j])
    return float(total)


def _candidate_scope_limit(package, available_count):
    available = max(0, int(available_count or 0))
    if available == 0:
        return 0
    qaoa = package.get("qaoa") or {}
    max_export_rows = _as_int(qaoa.get("max_export_rows"), None)
    qaoa_shots = _as_int(qaoa.get("qaoa_shots"), None)
    limit = max_export_rows if max_export_rows and max_export_rows > 0 else 5000
    if qaoa_shots and qaoa_shots > 0:
        limit = min(limit, qaoa_shots)
    return max(1, min(int(limit), available))


def _candidate_display_limit(package, available_count):
    return max(1, min(10, int(available_count or 0)))


def candidate_views_from_probabilities(package, probability_items):
    n_qubits = int((package.get("use_case") or {}).get("n_qubits") or 0)
    rows = []
    for bitstring, probability in probability_items:
        normalized_bitstring = _bitstring_bits(bitstring, n_qubits)
        rows.append(
            {
                "bitstring": normalized_bitstring,
                "probability": _as_float(probability),
                "qubo_value": reconstructed_qubo_value(package, normalized_bitstring),
            }
        )

    rows_by_probability = sorted(
        rows,
        key=lambda row: (row["probability"], -row["qubo_value"]),
        reverse=True,
    )
    scope_limit = _candidate_scope_limit(package, len(rows_by_probability))
    candidate_pool = rows_by_probability[:scope_limit]
    display_limit = _candidate_display_limit(package, len(candidate_pool))
    top_probability = candidate_pool[:display_limit]
    top_qubo = sorted(
        candidate_pool,
        key=lambda row: (row["qubo_value"], -row["probability"], row["bitstring"]),
    )[:display_limit]
    return candidate_pool, top_probability, top_qubo


def print_candidate_table(title, rows):
    print(f"\n{title}")
    if not rows:
        print("  No candidates available.")
        return
    print("Rank  Bitstring                             Probability       QUBO value")
    for rank, row in enumerate(rows, start=1):
        print(
            f"{rank:>4d}  "
            f"{_short(row.get('bitstring'), 35):35s} "
            f"{_fmt_decimal(row.get('probability'), 8):>12s} "
            f"{_fmt_decimal(row.get('qubo_value'), 8):>16s}"
        )


def selected_full_portfolio(package, bitstring):
    n_qubits = int((package.get("use_case") or {}).get("n_qubits") or 0)
    bits = _bitstring_bits(bitstring, n_qubits)
    fixed_rows = [dict(row, selected=True, bit="-") for row in _package_asset_rows(package, "fixed_assets")]
    variable_rows = []
    for idx, row in enumerate(_package_asset_rows(package, "variable_assets")):
        bit = bits[idx] if idx < len(bits) else "0"
        if bit == "1":
            variable_rows.append(dict(row, selected=True, bit=bit))
    return fixed_rows + variable_rows


def _covariance_lookup(package):
    covariance = ((package.get("market_data") or {}).get("covariance") or {})
    tickers = [str(ticker) for ticker in covariance.get("tickers") or []]
    matrix = covariance.get("matrix") or []
    return {
        (row_ticker, col_ticker): _as_float(matrix[i][j])
        for i, row_ticker in enumerate(tickers)
        for j, col_ticker in enumerate(tickers)
        if i < len(matrix) and j < len(matrix[i])
    }


def _asset_cost(row):
    return _as_float(row.get("indicative_market_cost_usd"))


def _asset_return(row):
    return _as_float(row.get("expected_return_proxy"))


def _asset_vol(row):
    return _as_float(row.get("annual_volatility"))


def _asset_ticker(row):
    return str(row.get("ticker") or "")


def _asset_type_size(row, size_column):
    type_sizes = row.get("type_sizes") or {}
    return _as_float(type_sizes.get(size_column))


def portfolio_metrics(package, bitstring):
    use_case = package.get("use_case") or {}
    budget = _as_float(use_case.get("budget_usd"))
    risk_free = _as_float(use_case.get("risk_free_rate"))
    assets = selected_full_portfolio(package, bitstring)
    fixed_usd = sum(_asset_cost(row) for row in assets if row.get("role") == "fixed")
    variable_usd = sum(_asset_cost(row) for row in assets if row.get("role") != "fixed")
    invested = fixed_usd + variable_usd
    costs = np.asarray([_asset_cost(row) for row in assets], dtype=float)
    returns = np.asarray([_asset_return(row) for row in assets], dtype=float)
    cov_lookup = _covariance_lookup(package)
    cov = np.zeros((len(assets), len(assets)), dtype=float)
    for i, row_i in enumerate(assets):
        for j, row_j in enumerate(assets):
            key = (_asset_ticker(row_i), _asset_ticker(row_j))
            if key in cov_lookup:
                cov[i, j] = cov_lookup[key]
            elif i == j:
                cov[i, j] = _asset_vol(row_i) ** 2

    if invested > 0.0 and len(assets):
        weights = costs / invested
        portfolio_return = float(weights @ returns)
        portfolio_var = float(weights @ cov @ weights) if len(cov) else 0.0
        portfolio_vol = math.sqrt(max(portfolio_var, 0.0))
        sharpe_like = (
            float("nan")
            if portfolio_vol == 0.0
            else float((portfolio_return - risk_free) / portfolio_vol)
        )
    else:
        portfolio_return = 0.0
        portfolio_vol = 0.0
        sharpe_like = float("nan")

    if budget > 0.0 and len(assets):
        budget_weights = costs / budget
        cash_weight = 1.0 - invested / budget
        budget_return = float(budget_weights @ returns + cash_weight * risk_free)
        budget_var = float(budget_weights @ cov @ budget_weights) if len(cov) else 0.0
        budget_vol = math.sqrt(max(budget_var, 0.0))
        budget_sharpe = (
            float("nan")
            if budget_vol == 0.0
            else float((budget_return - risk_free) / budget_vol)
        )
    else:
        cash_weight = float("nan")
        budget_return = float("nan")
        budget_vol = float("nan")
        budget_sharpe = float("nan")

    type_budget_rows = []
    for constraint in package.get("type_budgets") or []:
        if not constraint.get("active", True):
            continue
        size_column = constraint.get("size_column")
        target = _as_float(constraint.get("budget"))
        fixed_exposure = sum(
            _asset_type_size(row, size_column) for row in assets if row.get("role") == "fixed"
        )
        variable_exposure = sum(
            _asset_type_size(row, size_column) for row in assets if row.get("role") != "fixed"
        )
        achieved = fixed_exposure + variable_exposure
        deviation = achieved - target
        type_budget_rows.append(
            {
                "label": constraint.get("label") or constraint.get("name") or size_column,
                "size_column": size_column,
                "budget": target,
                "fixed_exposure": fixed_exposure,
                "variable_exposure": variable_exposure,
                "achieved": achieved,
                "deviation": deviation,
                "achieved_pct": float("nan") if target == 0.0 else achieved / target,
            }
        )

    return {
        "assets": assets,
        "fixed_usd": fixed_usd,
        "variable_usd": variable_usd,
        "invested_usd": invested,
        "budget_usd": budget,
        "budget_gap": invested - budget,
        "cash_weight": cash_weight,
        "portfolio_return": portfolio_return,
        "portfolio_vol": portfolio_vol,
        "sharpe_like": sharpe_like,
        "portfolio_return_budget_normalized": budget_return,
        "portfolio_vol_budget_normalized": budget_vol,
        "sharpe_like_budget_normalized": budget_sharpe,
        "type_budgets": type_budget_rows,
    }


def print_portfolio_report(
    package,
    bitstring,
    *,
    probability=None,
    qubo_value=None,
    runtime_seconds=None,
    runtime_label="Execution runtime",
):
    report = portfolio_metrics(package, bitstring)
    print("\nSelected portfolio report")
    print("-------------------------")
    print("Bitstring:", bitstring)
    if probability is not None:
        print("Readout probability:", _fmt_decimal(probability, 8))
    if qubo_value is not None:
        print("Reconstructed QUBO objective:", _fmt_decimal(qubo_value, 8))
    if runtime_seconds is not None:
        print(f"{runtime_label}: {_fmt_decimal(runtime_seconds, 6)} seconds")
    print(f"Invested assets vs budget: {_fmt_money(report['invested_usd'])} / {_fmt_money(report['budget_usd'])}")
    print(f"Budget gap: {_fmt_money(report['budget_gap'])}")
    print(f"Full portfolio return: {_fmt_pct(report['portfolio_return'])}")
    print(f"Full portfolio volatility: {_fmt_pct(report['portfolio_vol'])}")
    print(f"Sharpe-like ratio: {_fmt_decimal(report['sharpe_like'], 6)}")
    print(f"Budget-normalized return: {_fmt_pct(report['portfolio_return_budget_normalized'])}")
    print(f"Budget-normalized volatility: {_fmt_pct(report['portfolio_vol_budget_normalized'])}")
    print(f"Budget-normalized Sharpe-like ratio: {_fmt_decimal(report['sharpe_like_budget_normalized'], 6)}")

    if report["type_budgets"]:
        print("\nSubtype budgets")
        print("Label                         Achieved       Budget       Deviation     Achieved %")
        for row in report["type_budgets"]:
            print(
                f"{_short(row['label'], 28):28s} "
                f"{_fmt_money(row['achieved']):>12s} "
                f"{_fmt_money(row['budget']):>12s} "
                f"{_fmt_money(row['deviation']):>12s} "
                f"{_fmt_pct(row['achieved_pct']):>10s}"
            )

    print("\nSelected full portfolio")
    print("Role      Bit  Ticker        Cost USD     Return    Vol       Label")
    for row in report["assets"]:
        print(
            f"{_short(row.get('role'), 9):9s} "
            f"{str(row.get('bit', '-')):>3s} "
            f"{_short(row.get('ticker'), 11):11s} "
            f"{_fmt_money(_asset_cost(row)):>12s} "
            f"{_fmt_pct(_asset_return(row)):>8s} "
            f"{_fmt_pct(_asset_vol(row)):>8s} "
            f"{_short(row.get('option_label') or row.get('company'), 36)}"
        )
    return report


def plot_portfolio_summary(package, report):
    try:
        import matplotlib.pyplot as plt
    except Exception as exc:
        print("Plot skipped:", type(exc).__name__, exc)
        return

    labels = ["Fixed", "Variable"]
    values = [report.get("fixed_usd", 0.0), report.get("variable_usd", 0.0)]
    cash = report.get("budget_usd", 0.0) - report.get("invested_usd", 0.0)
    if abs(cash) > 1e-9:
        labels.append("Cash / gap")
        values.append(cash)

    has_type_budgets = bool(report.get("type_budgets"))
    fig_width = 11 if has_type_budgets else 6
    fig, axes = plt.subplots(1, 2 if has_type_budgets else 1, figsize=(fig_width, 4))
    if not isinstance(axes, np.ndarray):
        axes = np.asarray([axes])

    axes[0].bar(labels, values, color=["#64748b", "#2563eb", "#f59e0b"][: len(labels)])
    axes[0].set_title("Invested assets vs budget")
    axes[0].set_ylabel("USD")
    axes[0].tick_params(axis="x", rotation=20)

    if has_type_budgets:
        type_labels = [_short(row["label"], 18) for row in report["type_budgets"]]
        achieved = [row["achieved"] for row in report["type_budgets"]]
        budgets = [row["budget"] for row in report["type_budgets"]]
        x = np.arange(len(type_labels))
        width = 0.38
        axes[1].bar(x - width / 2, achieved, width, label="Achieved", color="#2563eb")
        axes[1].bar(x + width / 2, budgets, width, label="Budget", color="#94a3b8")
        axes[1].set_title("Subtype budgets")
        axes[1].set_xticks(x, type_labels, rotation=20, ha="right")
        axes[1].legend()

    fig.tight_layout()
    backend = str(plt.get_backend()).lower()
    if "agg" in backend:
        print("Plot created with a non-interactive backend. Use fig.savefig(...) if you want to persist it.")
        plt.close(fig)
    else:
        plt.show()
    return fig
'''.strip()


def _qiskit_builder_code(*, include_demo: bool) -> str:
    code = r'''
# Cell purpose: build the optimized QAOA circuit in Qiskit from exported Ising terms and angles.
import numpy as np
from qiskit import QuantumCircuit, transpile


def optimizer_bitstring_from_qiskit_key(key, n_qubits=None):
    """Convert Qiskit's cN-1...c0 key order into optimizer q0...qN-1 order."""
    bitstring = str(key).replace(" ", "")
    if n_qubits is not None:
        bitstring = bitstring.zfill(int(n_qubits))[-int(n_qubits):]
    return bitstring[::-1]


def build_qaoa_circuit(package, measure=False):
    use_case = package["use_case"]
    qaoa = package["qaoa"]
    ising = package["ising"]
    n_qubits = int(use_case["n_qubits"])
    gammas = np.asarray(qaoa["gammas"], dtype=float)
    betas = np.asarray(qaoa["betas"], dtype=float)
    h_terms = np.asarray(ising["h_terms"], dtype=float)
    j_terms = [(int(i), int(j), float(coeff)) for i, j, coeff in ising["j_terms"]]

    qc = QuantumCircuit(n_qubits, n_qubits if measure else 0)
    for wire in range(n_qubits):
        qc.h(wire)

    for gamma, beta in zip(gammas, betas):
        for wire, coeff in enumerate(h_terms):
            if abs(float(coeff)) > 1e-12:
                qc.rz(2.0 * float(gamma) * float(coeff), wire)
        for control, target, coeff in j_terms:
            if abs(float(coeff)) > 1e-12:
                qc.cx(control, target)
                qc.rz(2.0 * float(gamma) * float(coeff), target)
                qc.cx(control, target)
        for wire in range(n_qubits):
            qc.rx(2.0 * float(beta), wire)

    if measure:
        qc.measure(range(n_qubits), range(n_qubits))
    return qc


def print_circuit_summary(qc, measured=None, transpiled=None, draw_qubit_limit=8):
    print(
        f"QAOA circuit: {qc.num_qubits} qubits, "
        f"depth={qc.depth()}, operations={sum(qc.count_ops().values())}"
    )
    print("Gate counts:", dict(qc.count_ops()))
    if measured is not None:
        print("Measured depth:", measured.depth())
    if transpiled is not None:
        print("Transpiled depth:", transpiled.depth())
        print("Transpiled gate counts:", dict(transpiled.count_ops()))
    if qc.num_qubits <= draw_qubit_limit:
        print(qc)
    else:
        print(
            f"Full text circuit diagram skipped for {qc.num_qubits} qubits. "
            f"Call qc.draw('text', fold=120) manually if you want the full diagram."
        )
'''.strip()
    if include_demo:
        code += r'''


qc = build_qaoa_circuit(PACKAGE, measure=False)
qc_measured = build_qaoa_circuit(PACKAGE, measure=True)
transpiled = transpile(qc_measured, optimization_level=1)
print_circuit_summary(qc, qc_measured, transpiled)
'''.rstrip()
    return code


def _qiskit_statevector_code() -> str:
    return r'''
# Cell purpose: run a local Qiskit statevector readout and summarize the selected portfolio.
from qiskit.quantum_info import Statevector


readout_start = time.perf_counter()
state = Statevector.from_instruction(qc)
probabilities = state.probabilities_dict()
readout_runtime_seconds = time.perf_counter() - readout_start
n_qubits = int(PACKAGE["use_case"]["n_qubits"])
probability_items = [
    (optimizer_bitstring_from_qiskit_key(key, n_qubits), float(probability))
    for key, probability in probabilities.items()
]
candidate_pool, top_probability_rows, top_qubo_rows = candidate_views_from_probabilities(PACKAGE, probability_items)

print("Best bitstring from QAOA RQP:", PACKAGE["qaoa"].get("best_bitstring"))
print(f"Candidate comparison pool: {len(candidate_pool)} states capped by shots/max candidates when available.")
print_candidate_table("Top simulated states by probability", top_probability_rows)
print_candidate_table("Top simulated states by reconstructed QUBO objective", top_qubo_rows)

selected_row = top_probability_rows[0] if top_probability_rows else {}
selected_bitstring = selected_row.get("bitstring") or PACKAGE["qaoa"].get("best_bitstring")
selected_probability = selected_row.get("probability")
selected_qubo_value = selected_row.get("qubo_value")
report = print_portfolio_report(
    PACKAGE,
    selected_bitstring,
    probability=selected_probability,
    qubo_value=selected_qubo_value,
    runtime_seconds=readout_runtime_seconds,
    runtime_label="Qiskit statevector readout runtime",
)
_ = plot_portfolio_summary(PACKAGE, report)
'''.strip()


def _qiskit_optional_hardware_code() -> str:
    return r'''
# Cell purpose: optional IBM Runtime submission for users who intentionally configure credentials.
# This cell reads credentials from environment variables only. Set IBM_QUANTUM_TOKEN before running
# if you want to submit to IBM Quantum.
import os

token = os.environ.get("IBM_QUANTUM_TOKEN")
if not token:
    print("IBM_QUANTUM_TOKEN is not set. Skipping hardware submission.")
else:
    try:
        from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler

        service = QiskitRuntimeService(channel="ibm_quantum", token=token)
        backend = service.least_busy(operational=True, simulator=False)
        print("Selected backend:", backend.name)
        hardware_circuit = transpile(qc_measured, backend=backend, optimization_level=1)
        sampler = Sampler(mode=backend)
        job = sampler.run([hardware_circuit])
        print("Submitted job:", job.job_id())
    except Exception as exc:
        print("IBM Runtime submission was not completed:", type(exc).__name__, exc)
'''.strip()


def _qiskit_py(package: dict[str, Any]) -> str:
    header = _python_header(package, "Qiskit Python")
    main_code = r'''
from qiskit.quantum_info import Statevector


def main():
    qc = build_qaoa_circuit(PACKAGE, measure=False)
    qc_measured = build_qaoa_circuit(PACKAGE, measure=True)
    transpiled = transpile(qc_measured, optimization_level=1)
    print_circuit_summary(qc, qc_measured, transpiled)
    readout_start = time.perf_counter()
    state = Statevector.from_instruction(qc)
    probabilities = state.probabilities_dict()
    readout_runtime_seconds = time.perf_counter() - readout_start
    n_qubits = int(PACKAGE["use_case"]["n_qubits"])
    probability_items = [
        (optimizer_bitstring_from_qiskit_key(key, n_qubits), float(probability))
        for key, probability in probabilities.items()
    ]
    candidate_pool, top_probability_rows, top_qubo_rows = candidate_views_from_probabilities(PACKAGE, probability_items)
    print("Best bitstring from QAOA RQP:", PACKAGE["qaoa"].get("best_bitstring"))
    print(f"Candidate comparison pool: {len(candidate_pool)} states capped by shots/max candidates when available.")
    print_candidate_table("Top simulated states by probability", top_probability_rows)
    print_candidate_table("Top simulated states by reconstructed QUBO objective", top_qubo_rows)
    selected_row = top_probability_rows[0] if top_probability_rows else {}
    selected_bitstring = selected_row.get("bitstring") or PACKAGE["qaoa"].get("best_bitstring")
    selected_probability = selected_row.get("probability")
    selected_qubo_value = selected_row.get("qubo_value")
    report = print_portfolio_report(
        PACKAGE,
        selected_bitstring,
        probability=selected_probability,
        qubo_value=selected_qubo_value,
        runtime_seconds=readout_runtime_seconds,
        runtime_label="Qiskit statevector readout runtime",
    )
    _ = plot_portfolio_summary(PACKAGE, report)


if __name__ == "__main__":
    main()
'''.strip()
    return "\n".join(
        [
            header,
            _package_cell(package),
            "",
            _portfolio_analysis_code(),
            "",
            _qiskit_builder_code(include_demo=False),
            "",
            main_code,
            "",
        ]
    )


def _pennylane_builder_code() -> str:
    return r'''
# Cell purpose: build and run the optimized QAOA circuit with PennyLane, then report the portfolio.
import sys
import numpy as np

if sys.version_info < (3, 11):
    raise RuntimeError(
        f"This PennyLane export needs a Python 3.11+ Jupyter kernel; "
        f"the active kernel is Python {sys.version.split()[0]}. "
        "Switch kernels, then run the first install cell again."
    )

import pennylane as qml


use_case = PACKAGE["use_case"]
qaoa = PACKAGE["qaoa"]
ising = PACKAGE["ising"]
N_QUBITS = int(use_case["n_qubits"])
GAMMAS = np.asarray(qaoa["gammas"], dtype=float)
BETAS = np.asarray(qaoa["betas"], dtype=float)
H_TERMS = np.asarray(ising["h_terms"], dtype=float)
J_TERMS = [(int(i), int(j), float(coeff)) for i, j, coeff in ising["j_terms"]]

dev = qml.device("default.qubit", wires=N_QUBITS)


def apply_layer(gamma, beta):
    for wire, coeff in enumerate(H_TERMS):
        if abs(float(coeff)) > 1e-12:
            qml.RZ(2.0 * float(gamma) * float(coeff), wires=wire)
    for control, target, coeff in J_TERMS:
        if abs(float(coeff)) > 1e-12:
            qml.CNOT(wires=[control, target])
            qml.RZ(2.0 * float(gamma) * float(coeff), wires=target)
            qml.CNOT(wires=[control, target])
    for wire in range(N_QUBITS):
        qml.RX(2.0 * float(beta), wires=wire)


@qml.qnode(dev)
def circuit():
    for wire in range(N_QUBITS):
        qml.Hadamard(wires=wire)
    for gamma, beta in zip(GAMMAS, BETAS):
        apply_layer(gamma, beta)
    return qml.probs(wires=range(N_QUBITS))


readout_start = time.perf_counter()
probs = np.asarray(circuit(), dtype=float)
readout_runtime_seconds = time.perf_counter() - readout_start
probability_items = [
    (format(int(idx), f"0{N_QUBITS}b"), float(probability))
    for idx, probability in enumerate(probs)
]
candidate_pool, top_probability_rows, top_qubo_rows = candidate_views_from_probabilities(PACKAGE, probability_items)
print("Best bitstring from QAOA RQP:", qaoa.get("best_bitstring"))
print(f"Candidate comparison pool: {len(candidate_pool)} states capped by shots/max candidates when available.")
print_candidate_table("Top simulated states by probability", top_probability_rows)
print_candidate_table("Top simulated states by reconstructed QUBO objective", top_qubo_rows)

selected_row = top_probability_rows[0] if top_probability_rows else {}
selected_bitstring = selected_row.get("bitstring") or qaoa.get("best_bitstring")
selected_probability = selected_row.get("probability")
selected_qubo_value = selected_row.get("qubo_value")
report = print_portfolio_report(
    PACKAGE,
    selected_bitstring,
    probability=selected_probability,
    qubo_value=selected_qubo_value,
    runtime_seconds=readout_runtime_seconds,
    runtime_label="PennyLane probability readout runtime",
)
_ = plot_portfolio_summary(PACKAGE, report)
'''.strip()


def _cirq_builder_code() -> str:
    return r'''
# Cell purpose: build and run the optimized QAOA circuit with Cirq, then report the portfolio.
import numpy as np
import cirq


use_case = PACKAGE["use_case"]
qaoa = PACKAGE["qaoa"]
ising = PACKAGE["ising"]
N_QUBITS = int(use_case["n_qubits"])
GAMMAS = np.asarray(qaoa["gammas"], dtype=float)
BETAS = np.asarray(qaoa["betas"], dtype=float)
H_TERMS = np.asarray(ising["h_terms"], dtype=float)
J_TERMS = [(int(i), int(j), float(coeff)) for i, j, coeff in ising["j_terms"]]
qubits = cirq.LineQubit.range(N_QUBITS)


def build_circuit(measure=False):
    circuit = cirq.Circuit()
    circuit.append(cirq.H.on_each(*qubits))
    for gamma, beta in zip(GAMMAS, BETAS):
        for wire, coeff in enumerate(H_TERMS):
            if abs(float(coeff)) > 1e-12:
                circuit.append(cirq.rz(2.0 * float(gamma) * float(coeff)).on(qubits[wire]))
        for control, target, coeff in J_TERMS:
            if abs(float(coeff)) > 1e-12:
                circuit.append(cirq.CNOT(qubits[control], qubits[target]))
                circuit.append(cirq.rz(2.0 * float(gamma) * float(coeff)).on(qubits[target]))
                circuit.append(cirq.CNOT(qubits[control], qubits[target]))
        for wire in range(N_QUBITS):
            circuit.append(cirq.rx(2.0 * float(beta)).on(qubits[wire]))
    if measure:
        circuit.append(cirq.measure(*qubits, key="q"))
    return circuit


circuit = build_circuit(measure=False)
operation_count = sum(1 for _ in circuit.all_operations())
print(f"Cirq QAOA circuit: {N_QUBITS} qubits, moments={len(circuit)}, operations={operation_count}")
if N_QUBITS <= 8:
    print(circuit)
else:
    print(
        f"Full text circuit diagram skipped for {N_QUBITS} qubits. "
        "Print circuit manually if you want the full diagram."
    )
simulator = cirq.Simulator()
readout_start = time.perf_counter()
result = simulator.simulate(circuit)
state = np.asarray(result.final_state_vector)
probs = np.square(np.abs(state)).astype(float)
readout_runtime_seconds = time.perf_counter() - readout_start
probability_items = [
    (format(int(idx), f"0{N_QUBITS}b"), float(probability))
    for idx, probability in enumerate(probs)
]
candidate_pool, top_probability_rows, top_qubo_rows = candidate_views_from_probabilities(PACKAGE, probability_items)
print("Best bitstring from QAOA RQP:", qaoa.get("best_bitstring"))
print(f"Candidate comparison pool: {len(candidate_pool)} states capped by shots/max candidates when available.")
print_candidate_table("Top simulated states by probability", top_probability_rows)
print_candidate_table("Top simulated states by reconstructed QUBO objective", top_qubo_rows)

selected_row = top_probability_rows[0] if top_probability_rows else {}
selected_bitstring = selected_row.get("bitstring") or qaoa.get("best_bitstring")
selected_probability = selected_row.get("probability")
selected_qubo_value = selected_row.get("qubo_value")
report = print_portfolio_report(
    PACKAGE,
    selected_bitstring,
    probability=selected_probability,
    qubo_value=selected_qubo_value,
    runtime_seconds=readout_runtime_seconds,
    runtime_label="Cirq statevector readout runtime",
)
_ = plot_portfolio_summary(PACKAGE, report)
'''.strip()


def _notebook_json(cells: list[dict[str, Any]]) -> str:
    notebook = {
        "cells": cells,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {
                "name": "python",
                "pygments_lexer": "ipython3",
            },
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    return json.dumps(notebook, indent=2)


def _markdown_cell(source: str) -> dict[str, Any]:
    return {"cell_type": "markdown", "metadata": {}, "source": source}


def _code_cell(source: str) -> dict[str, Any]:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": source,
    }


def _float_list(value) -> list[float]:
    if value is None:
        return []
    arr = np.asarray(value, dtype=float).reshape(-1)
    return [float(item) for item in arr.tolist()]


def _j_terms_list(j_terms) -> list[list[float]]:
    rows = []
    for key, value in (j_terms or {}).items():
        i, j = key
        rows.append([int(i), int(j), float(value)])
    return sorted(rows, key=lambda row: (row[0], row[1]))


def _asset_rows(df, *, role: str) -> list[dict[str, Any]]:
    if not isinstance(df, pd.DataFrame) or len(df) == 0:
        return []
    rows = []
    type_size_columns = [slot["size_column"] for slot in TYPE_SLOTS]
    for idx, row in df.reset_index(drop=True).iterrows():
        type_sizes = {
            column: _float_or_none(row.get(column))
            for column in type_size_columns
            if column in df.columns and _float_or_none(row.get(column)) is not None
        }
        rows.append(
            {
                "index": int(idx),
                "role": role,
                "decision_id": _str_or_none(row.get("decision_id")),
                "ticker": _str_or_none(row.get("Ticker")),
                "company": _str_or_none(row.get("Company")),
                "option_label": _str_or_none(row.get("Option Label")),
                "indicative_market_cost_usd": _float_or_none(row.get(INDICATIVE_COST_COLUMN)),
                "expected_return_proxy": _float_or_none(row.get("Expected Return Proxy")),
                "annual_volatility": _float_or_none(row.get("Annual Volatility")),
                "shares": _float_or_none(row.get("Shares")),
                "decision_role": _str_or_none(row.get("Decision Role")),
                "type_sizes": type_sizes,
            }
        )
    return json_safe(rows)


def _covariance_package(optimizer, fixed_df, variable_df) -> dict[str, Any]:
    cov_df = getattr(optimizer, "annual_cov_df", pd.DataFrame())
    if not isinstance(cov_df, pd.DataFrame) or cov_df.empty:
        return {"basis": "ticker", "annualized": True, "tickers": [], "matrix": []}

    tickers: list[str] = []
    for df in (fixed_df, variable_df):
        if not isinstance(df, pd.DataFrame) or "Ticker" not in df.columns:
            continue
        for raw in df["Ticker"].tolist():
            ticker = str(raw).strip() if raw is not None else ""
            if ticker and ticker not in tickers:
                tickers.append(ticker)

    matrix: list[list[float]] = []
    for row_ticker in tickers:
        row_values = []
        for col_ticker in tickers:
            try:
                value = cov_df.loc[row_ticker, col_ticker]
            except Exception:
                value = 0.0
            numeric = _float_or_none(value)
            row_values.append(numeric if numeric is not None else 0.0)
        matrix.append(row_values)
    return json_safe({"basis": "ticker", "annualized": True, "tickers": tickers, "matrix": matrix})


def _best_qaoa_bitstring(optimizer) -> str | None:
    exact = getattr(optimizer, "qaoa_exact_best_qubo_df", pd.DataFrame())
    samples = getattr(optimizer, "samples_df", pd.DataFrame())
    for df in (exact, samples):
        if isinstance(df, pd.DataFrame) and len(df) and "bitstring" in df.columns:
            return str(df.iloc[0].get("bitstring"))
    return None


def _best_classical_bitstring(optimizer) -> str | None:
    classical = getattr(optimizer, "classical_results", pd.DataFrame())
    if isinstance(classical, pd.DataFrame) and len(classical) and "bitstring" in classical.columns:
        try:
            return str(optimizer.sort_candidates(classical).iloc[0].get("bitstring"))
        except Exception:
            return str(classical.iloc[0].get("bitstring"))
    return None


def _shots_mode(optimizer) -> str:
    if bool(getattr(optimizer, "qaoa_sim_exact_probabilities", False) or getattr(optimizer, "qaoa_limited_exact_probabilities", False)):
        return "exact"
    if getattr(optimizer, "samples_df", None) is not None:
        return "sampling"
    return "unknown"


def _usage_level_id(usage_context) -> int:
    try:
        return int(float((getattr(usage_context, "usage_level", {}) or {}).get("level_id", 0)))
    except (TypeError, ValueError):
        return 0


def _safe_len(value) -> int:
    try:
        return int(len(value))
    except TypeError:
        return 0


def _float_or_none(value) -> float | None:
    if value is None:
        return None
    try:
        result = float(value)
        if not np.isfinite(result):
            return None
        return result
    except (TypeError, ValueError):
        return None


def _int_or_none(value) -> int | None:
    if value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _str_or_none(value) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text if text else None
