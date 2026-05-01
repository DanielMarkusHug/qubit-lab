"""Classical-only Version 8 execution path."""

from __future__ import annotations

from pathlib import Path

from app.qubo_builder import build_qubo_from_workbook, load_legacy_optimizer_symbols


def run_classical_only(workbook_path: Path):
    logs: list[str] = []
    optimizer = build_qubo_from_workbook(workbook_path, logs.append)
    return run_classical_optimizer(optimizer, logs)


def run_classical_optimizer(optimizer, logs: list[str] | None = None):
    logs = logs if logs is not None else []

    if not optimizer.enable_classical:
        _, optimization_error = load_legacy_optimizer_symbols()
        raise optimization_error(
            "Classical search was disabled by runtime limits after QUBO construction. "
            f"binary_variables={optimizer.n}, classical_max_qubits_allowed={optimizer.classical_max_qubits_allowed}"
        )

    optimizer.run_classical_search()
    optimizer.generate_results()

    if optimizer.classical_results is None or len(optimizer.classical_results) == 0:
        _, optimization_error = load_legacy_optimizer_symbols()
        raise optimization_error("Classical search completed but returned no candidate portfolios.")

    return optimizer, logs
