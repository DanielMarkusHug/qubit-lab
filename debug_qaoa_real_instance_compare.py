#!/usr/bin/env python3
"""
Compare PennyLane exact probabilities to an independent NumPy statevector
simulation on the real workbook-derived QUBO instance.

This is stronger than the tiny synthetic checks because it uses the actual
portfolio instance, but still removes the optimizer entirely.

Example:
    MPLCONFIGDIR=/tmp/matplotlib .venv/bin/python3 debug_qaoa_real_instance_compare.py \
      "Version 3/parametric_assets_only_input_small.xlsx"
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np

try:
    import pennylane as qml
except ImportError as exc:  # pragma: no cover - explicit runtime failure
    raise SystemExit("PennyLane is required to run this comparison.") from exc

from qaoa_optimizer_V4_core import QAOAOptimizerV4


def rx(theta: float) -> np.ndarray:
    c = math.cos(theta / 2.0)
    s = math.sin(theta / 2.0)
    return np.array([[c, -1j * s], [-1j * s, c]], dtype=complex)


def apply_single_qubit_gate(state: np.ndarray, gate: np.ndarray, wire: int, n: int) -> np.ndarray:
    tensor = state.reshape((2,) * n)
    tensor = np.moveaxis(tensor, wire, 0)
    tensor = np.tensordot(gate, tensor, axes=([1], [0]))
    tensor = np.moveaxis(tensor, 0, wire)
    return tensor.reshape(-1)


def diag_ising_energies(n: int, h: np.ndarray, J: dict[tuple[int, int], float]) -> np.ndarray:
    dim = 1 << n
    energies = np.zeros(dim, dtype=float)
    for idx in range(dim):
        bits = np.array([(idx >> shift) & 1 for shift in range(n - 1, -1, -1)], dtype=float)
        z = 1.0 - 2.0 * bits
        energy = float(np.dot(h, z))
        for (i, j), coeff in J.items():
            energy += float(coeff) * float(z[i] * z[j])
        energies[idx] = energy
    return energies


def numpy_qaoa_probs(n: int, h: np.ndarray, J: dict[tuple[int, int], float], gammas: np.ndarray, betas: np.ndarray) -> np.ndarray:
    dim = 1 << n
    state = np.ones(dim, dtype=complex) / np.sqrt(dim)
    diag_e = diag_ising_energies(n, h, J)

    for gamma, beta in zip(gammas, betas):
        state = np.exp(-1j * float(gamma) * diag_e) * state
        gate = rx(2.0 * float(beta))
        for wire in range(n):
            state = apply_single_qubit_gate(state, gate, wire, n)

    probs = np.abs(state) ** 2
    return probs / probs.sum()


def pennylane_qaoa_probs(n: int, h: np.ndarray, J: dict[tuple[int, int], float], gammas: np.ndarray, betas: np.ndarray) -> np.ndarray:
    dev = qml.device("lightning.qubit", wires=n, shots=None)

    def apply_layer(gamma, beta):
        for i, coeff in enumerate(h):
            if abs(coeff) > 1e-12:
                qml.RZ(2.0 * float(gamma) * float(coeff), wires=i)
        for (i, j), coeff in J.items():
            if abs(coeff) > 1e-12:
                qml.CNOT(wires=[i, j])
                qml.RZ(2.0 * float(gamma) * float(coeff), wires=j)
                qml.CNOT(wires=[i, j])
        for wire in range(n):
            qml.RX(2.0 * float(beta), wires=wire)

    @qml.qnode(dev)
    def circuit():
        for wire in range(n):
            qml.Hadamard(wires=wire)
        for gamma, beta in zip(gammas, betas):
            apply_layer(gamma, beta)
        return qml.probs(wires=range(n))

    return np.asarray(circuit(), dtype=float)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Compare PennyLane to independent NumPy simulation on a real workbook instance.")
    parser.add_argument("workbook", help="Path to workbook")
    parser.add_argument("--p", type=int, default=1)
    parser.add_argument("--gamma", type=float, nargs="+", default=[0.033333])
    parser.add_argument("--beta", type=float, nargs="+", default=[1.466077])
    parser.add_argument("--max-qubits", type=int, default=16)
    return parser


def main():
    args = build_parser().parse_args()
    workbook = Path(args.workbook)
    if not workbook.exists():
        raise SystemExit(f"Workbook not found: {workbook}")
    if len(args.gamma) != args.p or len(args.beta) != args.p:
        raise SystemExit("Provide exactly p gamma values and p beta values.")

    opt = QAOAOptimizerV4(str(workbook))
    opt.load_input()
    opt.build_qubo()

    if opt.n > args.max_qubits:
        raise SystemExit(f"Refusing direct exact comparison for n={opt.n}; raise --max-qubits if needed.")

    h, J, _ = QAOAOptimizerV4._qubo_to_ising(opt.Q, opt.constant)
    gammas = np.asarray(args.gamma, dtype=float)
    betas = np.asarray(args.beta, dtype=float)

    numpy_probs = numpy_qaoa_probs(opt.n, h, J, gammas, betas)
    penny_probs = pennylane_qaoa_probs(opt.n, h, J, gammas, betas)

    abs_diff = np.abs(numpy_probs - penny_probs)
    worst = float(np.max(abs_diff))
    worst_idx = int(np.argmax(abs_diff))
    worst_bitstring = format(worst_idx, f"0{opt.n}b")

    top_numpy = int(np.argmax(numpy_probs))
    top_penny = int(np.argmax(penny_probs))

    print("\nReal-Instance PennyLane vs NumPy Comparison")
    print("=" * 80)
    print(f"Workbook: {workbook}")
    print(f"n: {opt.n}")
    print(f"p: {args.p}")
    print(f"gammas: {gammas.tolist()}")
    print(f"betas: {betas.tolist()}")
    print(f"max |p_numpy - p_pennylane|: {worst:.3e} at state {worst_bitstring}")
    print(f"top numpy state: {format(top_numpy, f'0{opt.n}b')}  prob={float(numpy_probs[top_numpy]):.12f}")
    print(f"top penny state: {format(top_penny, f'0{opt.n}b')}  prob={float(penny_probs[top_penny]):.12f}")
    print("=" * 80)

    if worst > 1e-8:
        raise SystemExit("Comparison FAILED: real-instance probabilities differ.")
    print("Comparison PASSED: PennyLane matches independent NumPy simulation.")


if __name__ == "__main__":
    main()
