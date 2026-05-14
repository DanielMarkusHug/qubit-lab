"""IBM/Qiskit circuit export helpers for optimized QAOA runs."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from importlib import metadata
from typing import Mapping

import numpy as np


class QiskitUnavailableError(RuntimeError):
    """Raised when Qiskit-specific export is requested without Qiskit installed."""


@dataclass(frozen=True)
class QAOAOperation:
    """Backend-neutral operation record in optimizer qubit order."""

    name: str
    qubits: tuple[int, ...]
    angle: float | None = None


QAOA_ENTANGLING_STANDARD = "standard_basis"
QAOA_ENTANGLING_FRACTIONAL = "fractional_gates"
QAOA_CONSTRUCTION_CURRENT = "current_standard_construction"
QAOA_CONSTRUCTION_PARALLELIZED = "parallelized_construction"


def qaoa_operation_plan(
    n_qubits: int,
    h_terms,
    j_terms: Mapping[tuple[int, int], float],
    gammas,
    betas,
    *,
    use_fractional_gates: bool = False,
    parallelize_cost_terms: bool = False,
) -> list[QAOAOperation]:
    """Return the QAOA circuit operations before measurement.

    Qubit index 0 is the leftmost bit in optimizer bitstrings. This mirrors the
    PennyLane circuit used by ``qaoa_optimizer_V6_1_core``.
    """

    n = int(n_qubits)
    if n <= 0:
        raise ValueError("QAOA circuit export requires at least one qubit.")

    gammas_arr = np.asarray(gammas, dtype=float).reshape(-1)
    betas_arr = np.asarray(betas, dtype=float).reshape(-1)
    if len(gammas_arr) != len(betas_arr):
        raise ValueError("QAOA gammas and betas must have the same number of layers.")
    if len(gammas_arr) == 0:
        raise ValueError("QAOA circuit export requires at least one layer.")

    h_arr = np.asarray(h_terms, dtype=float).reshape(-1)
    if len(h_arr) != n:
        raise ValueError("QAOA h_terms length must match n_qubits.")

    operations: list[QAOAOperation] = [QAOAOperation("h", (wire,)) for wire in range(n)]
    normalized_j_terms = _sorted_j_terms(j_terms)
    entangling_rounds = (
        _parallel_entangling_rounds(normalized_j_terms)
        if parallelize_cost_terms
        else [normalized_j_terms]
    )
    for gamma, beta in zip(gammas_arr, betas_arr):
        gamma_value = float(gamma)
        beta_value = float(beta)
        for wire, coeff in enumerate(h_arr):
            if abs(float(coeff)) > 1e-12:
                operations.append(QAOAOperation("rz", (wire,), 2.0 * gamma_value * float(coeff)))
        for round_terms in entangling_rounds:
            if use_fractional_gates:
                for (control, target), coeff in round_terms:
                    if abs(float(coeff)) > 1e-12:
                        angle = 2.0 * gamma_value * float(coeff)
                        operations.append(QAOAOperation("rzz", (control, target), angle))
            else:
                for (control, target), coeff in round_terms:
                    if abs(float(coeff)) > 1e-12:
                        operations.append(QAOAOperation("cx", (control, target)))
                for (_control, target), coeff in round_terms:
                    if abs(float(coeff)) > 1e-12:
                        angle = 2.0 * gamma_value * float(coeff)
                        operations.append(QAOAOperation("rz", (target,), angle))
                for (control, target), coeff in round_terms:
                    if abs(float(coeff)) > 1e-12:
                        operations.append(QAOAOperation("cx", (control, target)))
        for wire in range(n):
            operations.append(QAOAOperation("rx", (wire,), 2.0 * beta_value))
    return operations


def qaoa_operation_counts(operations: list[QAOAOperation]) -> dict[str, int]:
    """Count circuit operations by gate name."""

    counts = Counter(operation.name for operation in operations)
    return {name: int(count) for name, count in sorted(counts.items())}


def qaoa_ibm_circuit_metadata(
    optimizer,
    *,
    qasm_preview_chars: int = 2000,
    use_fractional_gates: bool = False,
    parallelize_cost_terms: bool = False,
    allow_preview_placeholders: bool = False,
) -> dict[str, object]:
    """Return IBM/Qiskit-facing dry-run circuit metadata."""

    try:
        gammas, betas, parameter_source = _resolved_angles_for_circuit(
            optimizer,
            allow_preview_placeholders=allow_preview_placeholders,
        )
        h_terms, j_terms, _offset = optimizer._qubo_to_ising(optimizer.Q, optimizer.constant)
        operations = qaoa_operation_plan(
            int(optimizer.n),
            h_terms,
            j_terms,
            gammas,
            betas,
            use_fractional_gates=use_fractional_gates,
            parallelize_cost_terms=parallelize_cost_terms,
        )
        counts = qaoa_operation_counts(operations)
        metadata_payload = {
            "available": True,
            "provider": "ibm_quantum",
            "sdk": "qiskit",
            "export_mode": "qiskit_export",
            "export_format": "QuantumCircuit",
            "dry_run": True,
            "qiskit_available": False,
            "n_qubits": int(optimizer.n),
            "layers": int(len(gammas)),
            "operation_count": int(len(operations)),
            "gate_counts": counts,
            "measurement_required_for_sampler": True,
            "measurement_qubit_to_clbit": "q[i] -> c[i]",
            "optimizer_bitstring_order": "q0...qN-1",
            "qiskit_counts_key_order": "cN-1...c0",
            "counts_decoder": "reverse_qiskit_count_key",
            "hardware_submission": "not_configured",
            "fractional_gates_requested": bool(use_fractional_gates),
            "fractional_gates_enabled": bool(use_fractional_gates),
            "parameter_source": parameter_source,
            "preview_placeholder_angles": bool(parameter_source == "preview_placeholder"),
            "fractional_mode_label": (
                "Prefer fractional gates" if use_fractional_gates else "Standard basis"
            ),
            "parallelized_construction_requested": bool(parallelize_cost_terms),
            "parallelized_construction_enabled": bool(parallelize_cost_terms),
            "construction_mode_label": (
                "Parallelized construction"
                if parallelize_cost_terms
                else "Current / standard construction"
            ),
        }
        try:
            measured_circuit = build_qiskit_qaoa_circuit(
                int(optimizer.n),
                h_terms,
                j_terms,
                gammas,
                betas,
                measure=True,
                use_fractional_gates=use_fractional_gates,
                parallelize_cost_terms=parallelize_cost_terms,
            )
            unmeasured_circuit = build_qiskit_qaoa_circuit(
                int(optimizer.n),
                h_terms,
                j_terms,
                gammas,
                betas,
                measure=False,
                use_fractional_gates=use_fractional_gates,
                parallelize_cost_terms=parallelize_cost_terms,
            )
            logical_without = _circuit_metrics(unmeasured_circuit)
            logical_with = _circuit_metrics(measured_circuit)
            metadata_payload.update(
                {
                    "qiskit_available": True,
                    "qiskit_version": _package_version("qiskit"),
                    "qiskit_ibm_runtime_version": _package_version("qiskit-ibm-runtime"),
                    "qiskit_depth_without_measurements": int(unmeasured_circuit.depth() or 0),
                    "qiskit_depth_with_measurements": int(measured_circuit.depth() or 0),
                    "qiskit_size_without_measurements": int(unmeasured_circuit.size()),
                    "qiskit_size_with_measurements": int(measured_circuit.size()),
                    "qiskit_gate_counts_without_measurements": _count_ops_dict(unmeasured_circuit),
                    "qiskit_gate_counts_with_measurements": _count_ops_dict(measured_circuit),
                    "logical_total_gates_without_measurements": logical_without.get("total_gates"),
                    "logical_total_gates_with_measurements": logical_with.get("total_gates"),
                    "logical_two_qubit_gates_without_measurements": logical_without.get("two_qubit_gates"),
                    "logical_two_qubit_gates_with_measurements": logical_with.get("two_qubit_gates"),
                    "logical_one_qubit_gates_without_measurements": logical_without.get("one_qubit_gates"),
                    "logical_one_qubit_gates_with_measurements": logical_with.get("one_qubit_gates"),
                    "logical_sequential_2q_depth_without_measurements": logical_without.get("sequential_2q_depth"),
                    "logical_sequential_2q_depth_with_measurements": logical_with.get("sequential_2q_depth"),
                    "classical_bits": int(measured_circuit.num_clbits),
                    "openqasm3": _openqasm3_preview(measured_circuit, qasm_preview_chars),
                }
            )
        except QiskitUnavailableError:
            metadata_payload["qiskit_unavailable_reason"] = "qiskit_not_installed"
        except Exception as exc:  # noqa: BLE001 - keep response serialization robust
            metadata_payload["qiskit_unavailable_reason"] = type(exc).__name__
        return metadata_payload
    except Exception as exc:  # noqa: BLE001 - metadata should never break result serialization
        return {
            "available": False,
            "provider": "ibm_quantum",
            "sdk": "qiskit",
            "export_mode": "qiskit_export",
            "reason": f"IBM circuit metadata unavailable: {type(exc).__name__}",
            "hardware_submission": "not_configured",
        }


def build_qiskit_qaoa_circuit(
    n_qubits: int,
    h_terms,
    j_terms: Mapping[tuple[int, int], float],
    gammas,
    betas,
    *,
    measure: bool = True,
    name: str = "qaoa_rqp",
    use_fractional_gates: bool = False,
    parallelize_cost_terms: bool = False,
):
    """Build a Qiskit ``QuantumCircuit`` for the optimized QAOA angles."""

    try:
        from qiskit import QuantumCircuit
    except Exception as exc:  # noqa: BLE001 - expose as stable app exception
        raise QiskitUnavailableError("Qiskit is not installed in this environment.") from exc

    operations = qaoa_operation_plan(
        n_qubits,
        h_terms,
        j_terms,
        gammas,
        betas,
        use_fractional_gates=use_fractional_gates,
        parallelize_cost_terms=parallelize_cost_terms,
    )
    circuit = QuantumCircuit(int(n_qubits), name=name)
    for operation in operations:
        if operation.name == "h":
            circuit.h(operation.qubits[0])
        elif operation.name == "rz":
            circuit.rz(float(operation.angle), operation.qubits[0])
        elif operation.name == "rx":
            circuit.rx(float(operation.angle), operation.qubits[0])
        elif operation.name == "cx":
            circuit.cx(operation.qubits[0], operation.qubits[1])
        elif operation.name == "rzz":
            circuit.rzz(float(operation.angle), operation.qubits[0], operation.qubits[1])
        else:
            raise ValueError(f"Unsupported QAOA operation: {operation.name}")
    if measure:
        circuit.measure_all()
    circuit.metadata = {
        "qaoa_rqp_export": True,
        "optimizer_bitstring_order": "q0...qN-1",
        "qiskit_counts_key_order": "cN-1...c0",
        "counts_decoder": "reverse_qiskit_count_key",
        "fractional_gates_requested": bool(use_fractional_gates),
        "parallelized_construction_requested": bool(parallelize_cost_terms),
    }
    return circuit


def build_qiskit_qaoa_circuit_from_optimizer(
    optimizer,
    *,
    measure: bool = True,
    name: str = "qaoa_rqp",
    use_fractional_gates: bool = False,
    parallelize_cost_terms: bool = False,
    allow_preview_placeholders: bool = False,
):
    """Build a Qiskit circuit from an optimizer that has completed QAOA."""

    gammas, betas, _parameter_source = _resolved_angles_for_circuit(
        optimizer,
        allow_preview_placeholders=allow_preview_placeholders,
    )
    h_terms, j_terms, _offset = optimizer._qubo_to_ising(optimizer.Q, optimizer.constant)
    return build_qiskit_qaoa_circuit(
        int(optimizer.n),
        h_terms,
        j_terms,
        gammas,
        betas,
        measure=measure,
        name=name,
        use_fractional_gates=use_fractional_gates,
        parallelize_cost_terms=parallelize_cost_terms,
    )


def optimizer_bitstring_from_qiskit_key(key: str, n_qubits: int | None = None) -> str:
    """Convert a Qiskit counts key into the app's q0...qN-1 bitstring order."""

    clean = str(key).replace(" ", "")
    if clean.startswith("0x"):
        if n_qubits is None:
            raise ValueError("n_qubits is required for hexadecimal Qiskit count keys.")
        clean = format(int(clean, 16), f"0{int(n_qubits)}b")
    if not clean or any(char not in {"0", "1"} for char in clean):
        raise ValueError(f"Unsupported Qiskit count key: {key!r}")
    if n_qubits is not None:
        width = int(n_qubits)
        if len(clean) > width:
            raise ValueError(f"Qiskit count key {key!r} is wider than n_qubits={width}.")
        clean = clean.zfill(width)
    return clean[::-1]


def qiskit_counts_to_optimizer_probabilities(counts: Mapping[str, int | float], n_qubits: int) -> dict[str, float]:
    """Normalize Qiskit counts into optimizer-order bitstring probabilities."""

    total = float(sum(float(value) for value in counts.values()))
    if total <= 0.0:
        return {}
    probabilities: dict[str, float] = {}
    for key, value in counts.items():
        bitstring = optimizer_bitstring_from_qiskit_key(str(key), n_qubits)
        probabilities[bitstring] = probabilities.get(bitstring, 0.0) + float(value) / total
    return dict(sorted(probabilities.items()))


def _openqasm3_preview(circuit, max_chars: int) -> dict[str, object]:
    try:
        from qiskit import qasm3

        qasm = str(qasm3.dumps(circuit))
    except Exception as exc:  # noqa: BLE001 - optional export detail
        return {
            "available": False,
            "reason": type(exc).__name__,
        }
    max_len = max(0, int(max_chars))
    return {
        "available": True,
        "format": "openqasm3",
        "length": int(len(qasm)),
        "truncated": bool(len(qasm) > max_len),
        "preview": qasm[:max_len],
    }


def _count_ops_dict(circuit) -> dict[str, int]:
    return {str(name): int(count) for name, count in circuit.count_ops().items()}


def _circuit_metrics(circuit) -> dict[str, int | None]:
    counts = _count_ops_dict(circuit)
    total_gates = int(sum(int(value) for value in counts.values()))
    two_qubit_gates = sum(
        1 for instruction in getattr(circuit, "data", []) if _operation_qubits(instruction) == 2
    )
    return {
        "total_gates": total_gates,
        "two_qubit_gates": int(two_qubit_gates),
        "one_qubit_gates": int(max(total_gates - int(two_qubit_gates), 0)),
        "sequential_2q_depth": _two_qubit_depth(circuit),
    }


def _operation_qubits(instruction) -> int:
    operation = getattr(instruction, "operation", None)
    if operation is None and isinstance(instruction, tuple) and instruction:
        operation = instruction[0]
    value = getattr(operation, "num_qubits", None)
    if value is not None:
        return int(value)
    qubits = getattr(instruction, "qubits", None)
    if qubits is not None:
        return len(qubits)
    if isinstance(instruction, tuple) and len(instruction) >= 2:
        return len(instruction[1])
    return 0


def _two_qubit_depth(circuit) -> int | None:
    try:
        return int(
            circuit.depth(
                filter_function=lambda instruction: _operation_qubits(instruction) == 2,
            )
        )
    except TypeError:
        try:
            return int(circuit.depth(lambda instruction: _operation_qubits(instruction) == 2))
        except Exception:
            return None
    except Exception:
        return None


def _package_version(package_name: str) -> str | None:
    try:
        return str(metadata.version(package_name))
    except metadata.PackageNotFoundError:
        return None


def _sorted_j_terms(j_terms: Mapping[tuple[int, int], float]) -> list[tuple[tuple[int, int], float]]:
    return sorted(
        [((int(i), int(j)), float(coeff)) for (i, j), coeff in dict(j_terms).items()],
        key=lambda item: (item[0][0], item[0][1]),
    )


def _parallel_entangling_rounds(
    normalized_j_terms: list[tuple[tuple[int, int], float]]
) -> list[list[tuple[tuple[int, int], float]]]:
    pending = list(normalized_j_terms)
    rounds: list[list[tuple[tuple[int, int], float]]] = []
    while pending:
        occupied: set[int] = set()
        current_round: list[tuple[tuple[int, int], float]] = []
        remaining: list[tuple[tuple[int, int], float]] = []
        for edge, coeff in pending:
            control, target = edge
            if control in occupied or target in occupied:
                remaining.append((edge, coeff))
                continue
            current_round.append((edge, coeff))
            occupied.add(control)
            occupied.add(target)
        if not current_round:
            current_round.append(pending[0])
            remaining = pending[1:]
        rounds.append(current_round)
        pending = remaining
    return rounds


def _final_angles(values, name: str) -> np.ndarray:
    angles = np.asarray(values, dtype=float).reshape(-1)
    if len(angles) == 0 or not np.all(np.isfinite(angles)):
        raise ValueError(f"Optimizer does not contain finite {name}.")
    return angles


def _preview_layer_count(optimizer) -> int | None:
    for attr_name in ("qaoa_preview_layers", "qaoa_p"):
        try:
            value = int(getattr(optimizer, attr_name, 0) or 0)
        except Exception:
            value = 0
        if value > 0:
            return value
    return None


def _preview_placeholder_angles(layer_count: int) -> tuple[np.ndarray, np.ndarray]:
    layers = int(layer_count or 0)
    if layers <= 0:
        raise ValueError("QAOA preview circuit requires at least one layer.")
    gammas = np.full(layers, np.pi / 7.0, dtype=float)
    betas = np.full(layers, np.pi / 5.0, dtype=float)
    return gammas, betas


def _resolved_angles_for_circuit(
    optimizer,
    *,
    allow_preview_placeholders: bool = False,
) -> tuple[np.ndarray, np.ndarray, str]:
    best_gammas = getattr(optimizer, "best_gammas", None)
    best_betas = getattr(optimizer, "best_betas", None)
    try:
        return (
            _final_angles(best_gammas, "best_gammas"),
            _final_angles(best_betas, "best_betas"),
            "optimized",
        )
    except ValueError:
        if not allow_preview_placeholders:
            raise
    preview_layers = _preview_layer_count(optimizer)
    if preview_layers is None:
        raise ValueError("Optimizer does not contain optimized QAOA angles or preview layers.")
    gammas, betas = _preview_placeholder_angles(preview_layers)
    return gammas, betas, "preview_placeholder"
