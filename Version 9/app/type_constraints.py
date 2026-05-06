"""Version 9 additional exact type-budget constraints.

This module intentionally layers the Version 9 extension around the existing
V6.1 optimizer object instead of changing the shared optimizer core. The QUBO
math below follows the requested portfolio-level normalized exact target term:

    lambda_k * ((fixed_type_exposure_k + sum_i type_size_i * x_i) / budget_k - 1)^2
"""

from __future__ import annotations

from types import MethodType
from typing import Any, Callable

import numpy as np
import pandas as pd


TYPE_SLOTS: tuple[dict[str, str], ...] = (
    {"id": "type_a", "default_label": "Type A", "size_column": "Type A Size"},
    {"id": "type_b", "default_label": "Type B", "size_column": "Type B Size"},
    {"id": "type_c", "default_label": "Type C", "size_column": "Type C Size"},
    {"id": "type_d", "default_label": "Type D", "size_column": "Type D Size"},
    {"id": "type_e", "default_label": "Type E", "size_column": "Type E Size"},
)


def apply_additional_type_constraints(
    optimizer,
    *,
    error_cls: type[Exception] = ValueError,
    log_callback: Callable[[str], None] | None = None,
):
    """Parse active constraints, augment the QUBO, and attach diagnostics hooks."""

    constraints = parse_additional_type_constraints(optimizer, error_cls=error_cls)
    optimizer.additional_type_constraints = constraints
    optimizer.additional_type_constraints_count = len(constraints)

    if log_callback is not None:
        log_callback(f"Additional type constraints: {len(constraints)}")

    if not constraints:
        return optimizer

    q = np.asarray(getattr(optimizer, "Q", np.zeros((0, 0))), dtype=float).copy()
    constant_delta = 0.0
    for constraint in constraints:
        penalty = float(constraint["penalty"])
        b = np.asarray(constraint["normalized_sizes"], dtype=float)
        c = float(constraint["fixed_normalized_offset"])
        if len(b) != q.shape[0]:
            raise error_cls(
                f"{constraint['size_column']} length mismatch: expected {q.shape[0]} variable rows, got {len(b)}."
            )
        for i in range(len(b)):
            q[i, i] += penalty * (2.0 * c * b[i] + b[i] ** 2)
            for j in range(i + 1, len(b)):
                q[i, j] += 2.0 * penalty * b[i] * b[j]
        constant_delta += penalty * c**2
        if log_callback is not None:
            log_callback(
                "Additional type constraint "
                f"{constraint['id']} ({constraint['label']}): "
                f"budget={constraint['budget']}, penalty={constraint['penalty']}, "
                f"fixed_exposure={constraint['fixed_exposure']}, "
                f"size_column={constraint['size_column']}"
            )

    optimizer.Q = q
    optimizer.constant = float(getattr(optimizer, "constant", 0.0) + constant_delta)
    optimizer.qubo_meta = dict(getattr(optimizer, "qubo_meta", {}) or {})
    optimizer.qubo_meta["additional_type_constraints"] = constraints_for_json(optimizer)
    optimizer.qubo_meta["additional_type_constraints_constant_delta"] = float(constant_delta)

    _extend_candidate_columns(optimizer)
    _wrap_optimizer_diagnostics(optimizer)
    return optimizer


def parse_additional_type_constraints(optimizer, *, error_cls: type[Exception] = ValueError) -> list[dict[str, Any]]:
    settings = getattr(optimizer, "settings", {}) or {}
    count_raw = _setting(settings, "Additional Type Constraints", "additional_type_constraints")
    count = _parse_constraint_count(count_raw, error_cls=error_cls)
    optimizer.additional_type_constraints_requested = count
    if count == 0:
        return []

    variable_df = getattr(optimizer, "variable_options_df", pd.DataFrame())
    fixed_df = getattr(optimizer, "fixed_options_df", pd.DataFrame())
    constraints: list[dict[str, Any]] = []
    for index, slot in enumerate(TYPE_SLOTS[:count]):
        display = slot["default_label"]
        label_raw = _setting(settings, f"{display} Name", f"{slot['id']}_name")
        label = str(label_raw).strip() if not _missing(label_raw) else display
        budget = _required_float_setting(
            settings,
            f"{display} Budget",
            f"{slot['id']}_budget",
            error_cls=error_cls,
            positive=True,
        )
        penalty = _required_float_setting(
            settings,
            f"{display} Budget Penalty",
            f"{slot['id']}_budget_penalty",
            error_cls=error_cls,
            positive=False,
        )
        if penalty < 0.0:
            raise error_cls(f"{display} Budget Penalty must be >= 0, got {penalty!r}.")

        size_column = slot["size_column"]
        if size_column not in variable_df.columns:
            raise error_cls(
                f"{size_column} column is required when Additional Type Constraints is {count}."
            )

        variable_sizes = _numeric_size_column(variable_df, size_column, error_cls=error_cls)
        fixed_sizes = (
            _numeric_size_column(fixed_df, size_column, error_cls=error_cls)
            if isinstance(fixed_df, pd.DataFrame) and size_column in fixed_df.columns
            else np.zeros(len(fixed_df), dtype=float)
        )
        normalized_sizes = variable_sizes / budget
        fixed_exposure = float(fixed_sizes.sum()) if len(fixed_sizes) else 0.0
        fixed_normalized_exposure = fixed_exposure / float(budget)
        constraints.append(
            {
                "id": slot["id"],
                "slot": index + 1,
                "label": label,
                "name": label,
                "default_label": display,
                "size_column": size_column,
                "budget": float(budget),
                "penalty": float(penalty),
                "raw_sizes": variable_sizes.astype(float),
                "fixed_raw_sizes": fixed_sizes.astype(float),
                "normalized_sizes": normalized_sizes.astype(float),
                "fixed_exposure": fixed_exposure,
                "fixed_normalized_exposure": fixed_normalized_exposure,
                "fixed_normalized_offset": fixed_normalized_exposure - 1.0,
                "active": True,
            }
        )
    return constraints


def constraints_for_json(optimizer) -> list[dict[str, Any]]:
    rows = []
    for constraint in getattr(optimizer, "additional_type_constraints", []) or []:
        raw_sizes = np.asarray(constraint.get("raw_sizes", []), dtype=float)
        fixed_sizes = np.asarray(constraint.get("fixed_raw_sizes", []), dtype=float)
        fixed_exposure = float(constraint.get("fixed_exposure", fixed_sizes.sum() if len(fixed_sizes) else 0.0))
        budget = float(constraint["budget"])
        rows.append(
            {
                "id": constraint["id"],
                "name": constraint["label"],
                "label": constraint["label"],
                "size_column": constraint["size_column"],
                "budget": budget,
                "penalty": float(constraint["penalty"]),
                "active": bool(constraint.get("active", True)),
                "variable_size_sum": float(raw_sizes.sum()) if len(raw_sizes) else 0.0,
                "fixed_size_sum": float(fixed_sizes.sum()) if len(fixed_sizes) else 0.0,
                "fixed_exposure": fixed_exposure,
                "fixed_normalized_exposure": float(fixed_exposure / budget) if budget else 0.0,
                "baseline_no_variable_exposure": fixed_exposure,
                "baseline_no_variable_normalized": float(fixed_exposure / budget) if budget else 0.0,
            }
        )
    return rows


def achievements_for_bitvec(optimizer, bitvec) -> list[dict[str, Any]]:
    x = np.asarray(bitvec, dtype=float)
    rows = []
    for constraint in getattr(optimizer, "additional_type_constraints", []) or []:
        raw_sizes = np.asarray(constraint["raw_sizes"], dtype=float)
        normalized_sizes = np.asarray(constraint["normalized_sizes"], dtype=float)
        budget = float(constraint["budget"])
        penalty = float(constraint["penalty"])
        fixed_exposure = float(constraint.get("fixed_exposure", 0.0))
        variable_selected = float(np.dot(raw_sizes, x)) if len(raw_sizes) else 0.0
        achieved = fixed_exposure + variable_selected
        normalized = (
            float(constraint.get("fixed_normalized_exposure", fixed_exposure / budget))
            + (float(np.dot(normalized_sizes, x)) if len(normalized_sizes) else 0.0)
        )
        deviation = achieved - budget
        relative = normalized - 1.0
        contribution = float(penalty * relative**2)
        rows.append(
            {
                "id": constraint["id"],
                "name": constraint["label"],
                "label": constraint["label"],
                "budget": budget,
                "penalty": penalty,
                "penalty_weight": penalty,
                "fixed_exposure": fixed_exposure,
                "variable_selected_exposure": variable_selected,
                "total_achieved_exposure": achieved,
                "normalized_total_achieved": normalized,
                "achieved_raw": achieved,
                "achieved_normalized": normalized,
                "raw_deviation": float(deviation),
                "relative_deviation": float(relative),
                "penalty_contribution": contribution,
                "normalized_penalty_contribution": contribution,
                "active": True,
            }
        )
    return rows


def type_candidate_columns(optimizer) -> list[str]:
    columns: list[str] = ["type_budget_term", "avg_type_budget_term_per_option"]
    for constraint in getattr(optimizer, "additional_type_constraints", []) or []:
        prefix = constraint["id"]
        columns.extend(
            [
                f"{prefix}_name",
                f"{prefix}_achieved",
                f"{prefix}_normalized_achieved",
                f"{prefix}_fixed",
                f"{prefix}_variable_selected",
                f"{prefix}_budget",
                f"{prefix}_deviation",
                f"{prefix}_relative_deviation",
                f"{prefix}_penalty",
            ]
        )
    return columns


def type_size_columns(optimizer) -> list[str]:
    return [constraint["size_column"] for constraint in getattr(optimizer, "additional_type_constraints", []) or []]


def type_budget_term_columns(optimizer) -> list[str]:
    return [f"{constraint['id']}_penalty" for constraint in getattr(optimizer, "additional_type_constraints", []) or []]


def type_budget_metrics_for_bitvec(optimizer, bitvec) -> dict[str, Any]:
    achievements = achievements_for_bitvec(optimizer, bitvec)
    total = float(sum(row["normalized_penalty_contribution"] for row in achievements))
    metrics: dict[str, Any] = {"type_budget_term": total}
    for row in achievements:
        prefix = row["id"]
        metrics.update(
            {
                f"{prefix}_name": row["name"],
                f"{prefix}_achieved": row["total_achieved_exposure"],
                f"{prefix}_normalized_achieved": row["normalized_total_achieved"],
                f"{prefix}_fixed": row["fixed_exposure"],
                f"{prefix}_variable_selected": row["variable_selected_exposure"],
                f"{prefix}_budget": row["budget"],
                f"{prefix}_deviation": row["raw_deviation"],
                f"{prefix}_relative_deviation": row["relative_deviation"],
                f"{prefix}_penalty": row["penalty_contribution"],
            }
        )
    return metrics


def _wrap_optimizer_diagnostics(optimizer) -> None:
    if getattr(optimizer, "_additional_type_constraints_wrapped", False):
        return

    original_terms = optimizer.qubo_term_breakdown
    original_stats = optimizer.portfolio_stats
    original_exploded = optimizer.exploded_portfolio_rows

    def qubo_term_breakdown(self, bitvec):
        base = dict(original_terms(bitvec))
        type_metrics = type_budget_metrics_for_bitvec(self, bitvec)
        type_term = float(type_metrics.get("type_budget_term", 0.0))
        base.update(type_metrics)
        base["qubo_reconstructed"] = float(base.get("qubo_reconstructed", 0.0) + type_term)
        denom = max(int(np.asarray(bitvec, dtype=float).sum()) + len(getattr(self, "fixed_cost", [])), 1)
        base["avg_type_budget_term_per_option"] = float(type_term / denom)
        return base

    def portfolio_stats(self, bitvec):
        base = dict(original_stats(bitvec))
        base.update(type_budget_metrics_for_bitvec(self, bitvec))
        return base

    def exploded_portfolio_rows(self, rank, source, bitstring, bitvec):
        rows = list(original_exploded(rank, source, bitstring, bitvec))
        _attach_type_sizes_to_portfolio_rows(self, rows)
        return rows

    optimizer.qubo_term_breakdown = MethodType(qubo_term_breakdown, optimizer)
    optimizer.portfolio_stats = MethodType(portfolio_stats, optimizer)
    optimizer.exploded_portfolio_rows = MethodType(exploded_portfolio_rows, optimizer)
    optimizer._additional_type_constraints_wrapped = True


def _attach_type_sizes_to_portfolio_rows(optimizer, rows: list[dict[str, Any]]) -> None:
    constraints = getattr(optimizer, "additional_type_constraints", []) or []
    if not constraints:
        return

    fixed_by_decision_id: dict[str, int] = {}
    fixed_df = getattr(optimizer, "fixed_options_df", pd.DataFrame())
    if isinstance(fixed_df, pd.DataFrame) and "decision_id" in fixed_df.columns:
        for idx, decision_id in enumerate(fixed_df["decision_id"].astype(str).tolist()):
            fixed_by_decision_id[decision_id] = idx

    for row in rows:
        role = str(row.get("decision_role", "") or "").lower()
        variable_idx = _safe_int(row.get("variable_bit_index"))
        fixed_idx = fixed_by_decision_id.get(str(row.get("decision_id", "")))
        for constraint in constraints:
            column = constraint["size_column"]
            value = 0.0
            if role == "variable" and variable_idx is not None:
                raw = np.asarray(constraint.get("raw_sizes", []), dtype=float)
                if 0 <= variable_idx < len(raw):
                    value = float(raw[variable_idx])
            elif role == "fixed" and fixed_idx is not None:
                fixed_raw = np.asarray(constraint.get("fixed_raw_sizes", []), dtype=float)
                if 0 <= fixed_idx < len(fixed_raw):
                    value = float(fixed_raw[fixed_idx])
            row[column] = value


def _extend_candidate_columns(optimizer) -> None:
    columns = list(getattr(optimizer, "candidate_cols", []) or [])
    for column in type_candidate_columns(optimizer):
        if column not in columns:
            columns.append(column)
    optimizer.candidate_cols = columns


def _setting(settings: dict, *keys: str):
    if not isinstance(settings, dict):
        return None
    normalized = {_normalize_key(key): value for key, value in settings.items()}
    for key in keys:
        exact = settings.get(key)
        if not _missing(exact):
            return exact
        value = normalized.get(_normalize_key(key))
        if not _missing(value):
            return value
    return None


def _required_float_setting(
    settings: dict,
    display_key: str,
    snake_key: str,
    *,
    error_cls: type[Exception],
    positive: bool,
) -> float:
    raw = _setting(settings, display_key, snake_key)
    if _missing(raw):
        raise error_cls(f"{display_key} is required for an active additional type constraint.")
    try:
        value = float(raw)
    except (TypeError, ValueError) as exc:
        raise error_cls(f"{display_key} must be numeric, got {raw!r}.") from exc
    if not np.isfinite(value):
        raise error_cls(f"{display_key} must be finite, got {raw!r}.")
    if positive and value <= 0.0:
        raise error_cls(f"{display_key} must be > 0, got {value!r}.")
    return float(value)


def _parse_constraint_count(raw, *, error_cls: type[Exception]) -> int:
    if _missing(raw):
        return 0
    try:
        value = float(raw)
    except (TypeError, ValueError) as exc:
        raise error_cls(f"Additional Type Constraints must be an integer from 0 to 5, got {raw!r}.") from exc
    if not np.isfinite(value) or not value.is_integer():
        raise error_cls(f"Additional Type Constraints must be an integer from 0 to 5, got {raw!r}.")
    count = int(value)
    if count < 0 or count > len(TYPE_SLOTS):
        raise error_cls(f"Additional Type Constraints must be between 0 and 5, got {count}.")
    return count


def _numeric_size_column(df: pd.DataFrame, column: str, *, error_cls: type[Exception]) -> np.ndarray:
    if column not in df.columns:
        raise error_cls(f"{column} column is required for an active additional type constraint.")
    series = df[column]
    non_empty = series.notna() & series.astype(str).str.strip().ne("")
    numeric = pd.to_numeric(series, errors="coerce")
    bad = non_empty & numeric.isna()
    if bad.any():
        tickers = []
        if "Ticker" in df.columns:
            tickers = df.loc[bad, "Ticker"].astype(str).head(20).tolist()
        suffix = f" Bad rows: {tickers}" if tickers else ""
        raise error_cls(f"{column} values must be numeric.{suffix}")
    return numeric.fillna(0.0).astype(float).to_numpy()


def _normalize_key(value: Any) -> str:
    return "".join(ch for ch in str(value).strip().lower() if ch.isalnum())


def _missing(value: Any) -> bool:
    if value is None:
        return True
    try:
        return bool(pd.isna(value))
    except Exception:
        return False


def _safe_int(value: Any) -> int | None:
    try:
        if value is None or pd.isna(value):
            return None
        return int(float(value))
    except Exception:
        return None
