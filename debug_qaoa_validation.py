#!/usr/bin/env python3
"""
Deterministic validation harness for the QAOA pipeline.

This script does not test "portfolio quality". It tests whether the
implementation is mathematically self-consistent on tiny known examples:

1. QUBO -> Ising translation
2. Ising energy vs original QUBO value for every bitstring
3. PennyLane circuit probabilities vs a brute-force numpy reference

Run:
    .venv/bin/python3 debug_qaoa_validation.py
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

try:
    import pennylane as qml
except ImportError as exc:  # pragma: no cover - explicit runtime failure
    raise SystemExit("PennyLane is required to run this validation script.") from exc

from qaoa_optimizer_V4_core import QAOAOptimizerV4


EPS = 1e-9


@dataclass
class ValidationResult:
    name: str
    passed: bool
    detail: str


def bitstrings(n: int):
    for idx in range(1 << n):
        yield np.array([(idx >> shift) & 1 for shift in range(n - 1, -1, -1)], dtype=int)


def bitstring_label(x: np.ndarray) -> str:
    return "".join(str(int(v)) for v in x.tolist())


def qubo_value(Q: np.ndarray, constant: float, x: np.ndarray) -> float:
    x = np.asarray(x, dtype=float)
    return float(x @ Q @ x + constant)


def z_from_x(x: np.ndarray) -> np.ndarray:
    # x = (1 - z) / 2  => z = 1 - 2x, with z in {+1, -1}
    return 1.0 - 2.0 * np.asarray(x, dtype=float)


def ising_energy(h: np.ndarray, J: dict[tuple[int, int], float], offset: float, x: np.ndarray) -> float:
    z = z_from_x(x)
    energy = float(offset + np.dot(h, z))
    for (i, j), coeff in J.items():
        energy += float(coeff) * float(z[i] * z[j])
    return energy


def rx(theta: float) -> np.ndarray:
    c = math.cos(theta / 2.0)
    s = math.sin(theta / 2.0)
    return np.array([[c, -1j * s], [-1j * s, c]], dtype=complex)


def kron_all(mats: list[np.ndarray]) -> np.ndarray:
    out = mats[0]
    for mat in mats[1:]:
        out = np.kron(out, mat)
    return out


def brute_force_qaoa_probs(
    h: np.ndarray,
    J: dict[tuple[int, int], float],
    gammas: np.ndarray,
    betas: np.ndarray,
) -> np.ndarray:
    n = len(h)
    dim = 1 << n
    state = np.ones(dim, dtype=complex) / np.sqrt(dim)

    basis_z = []
    diag_energies = np.zeros(dim, dtype=float)
    for idx, x in enumerate(bitstrings(n)):
        z = z_from_x(x)
        basis_z.append(z)
        diag_energies[idx] = float(np.dot(h, z) + sum(coeff * z[i] * z[j] for (i, j), coeff in J.items()))

    for gamma, beta in zip(gammas, betas):
        state = np.exp(-1j * gamma * diag_energies) * state
        mixer = kron_all([rx(2.0 * beta) for _ in range(n)])
        state = mixer @ state

    probs = np.abs(state) ** 2
    return probs / probs.sum()


def pennylane_qaoa_probs(
    h: np.ndarray,
    J: dict[tuple[int, int], float],
    gammas: np.ndarray,
    betas: np.ndarray,
) -> np.ndarray:
    n = len(h)
    dev = qml.device("lightning.qubit", wires=n, shots=None)

    def apply_layer(gamma, beta):
        for i, coeff in enumerate(h):
            if abs(coeff) > 1e-12:
                qml.RZ(2.0 * gamma * float(coeff), wires=i)
        for (i, j), coeff in J.items():
            if abs(coeff) > 1e-12:
                qml.CNOT(wires=[i, j])
                qml.RZ(2.0 * gamma * float(coeff), wires=j)
                qml.CNOT(wires=[i, j])
        for wire in range(n):
            qml.RX(2.0 * beta, wires=wire)

    @qml.qnode(dev)
    def circuit():
        for wire in range(n):
            qml.Hadamard(wires=wire)
        for gamma, beta in zip(gammas, betas):
            apply_layer(gamma, beta)
        return qml.probs(wires=range(n))

    return np.asarray(circuit(), dtype=float)


def validate_qubo_to_ising_example(name: str, Q: np.ndarray, constant: float) -> ValidationResult:
    h, J, offset = QAOAOptimizerV4._qubo_to_ising(Q, constant)
    worst = 0.0
    worst_label = ""
    for x in bitstrings(Q.shape[0]):
        q = qubo_value(Q, constant, x)
        e = ising_energy(h, J, offset, x)
        diff = abs(q - e)
        if diff > worst:
            worst = diff
            worst_label = bitstring_label(x)
    passed = worst < EPS
    detail = f"max |QUBO-Ising| = {worst:.3e} at {worst_label or 'n/a'}"
    return ValidationResult(name=name, passed=passed, detail=detail)


def validate_qaoa_circuit_example(
    name: str,
    Q: np.ndarray,
    constant: float,
    gammas: list[float],
    betas: list[float],
) -> ValidationResult:
    h, J, _ = QAOAOptimizerV4._qubo_to_ising(Q, constant)
    brute = brute_force_qaoa_probs(h, J, np.asarray(gammas, dtype=float), np.asarray(betas, dtype=float))
    penny = pennylane_qaoa_probs(h, J, np.asarray(gammas, dtype=float), np.asarray(betas, dtype=float))
    worst = float(np.max(np.abs(brute - penny)))
    passed = worst < 1e-8
    detail = f"max |p_numpy-p_pennylane| = {worst:.3e}"
    return ValidationResult(name=name, passed=passed, detail=detail)


def validate_uniform_invariant(
    name: str,
    Q: np.ndarray,
    constant: float,
    gammas: list[float],
    betas: list[float],
) -> ValidationResult:
    h, J, _ = QAOAOptimizerV4._qubo_to_ising(Q, constant)
    probs = pennylane_qaoa_probs(h, J, np.asarray(gammas, dtype=float), np.asarray(betas, dtype=float))
    target = np.full_like(probs, 1.0 / len(probs))
    worst = float(np.max(np.abs(probs - target)))
    passed = worst < 1e-8
    detail = f"max |p-uniform| = {worst:.3e}"
    return ValidationResult(name=name, passed=passed, detail=detail)


def main():
    examples = []

    # Example A: simple diagonal 2-qubit QUBO.
    Q_a = np.array(
        [
            [1.25, 0.0],
            [0.0, -0.75],
        ],
        dtype=float,
    )
    examples.append(validate_qubo_to_ising_example("A. diagonal 2q QUBO -> Ising", Q_a, constant=0.5))
    examples.append(
        validate_qaoa_circuit_example(
            "A. p=1 circuit vs brute force",
            Q_a,
            constant=0.5,
            gammas=[0.23],
            betas=[0.41],
        )
    )

    # Example B: coupled 2-qubit QUBO, chosen to exercise off-diagonal terms.
    Q_b = np.array(
        [
            [0.60, -1.20],
            [0.0, 1.80],
        ],
        dtype=float,
    )
    examples.append(validate_qubo_to_ising_example("B. coupled 2q QUBO -> Ising", Q_b, constant=1.1))
    examples.append(
        validate_qaoa_circuit_example(
            "B. p=1 coupled circuit vs brute force",
            Q_b,
            constant=1.1,
            gammas=[0.17],
            betas=[0.35],
        )
    )

    # Example C: small 3-qubit QUBO with mixed diagonal and pairwise terms.
    Q_c = np.array(
        [
            [0.35, 0.50, -0.25],
            [0.0, -0.40, 0.90],
            [0.0, 0.0, 0.70],
        ],
        dtype=float,
    )
    examples.append(validate_qubo_to_ising_example("C. coupled 3q QUBO -> Ising", Q_c, constant=-0.2))
    examples.append(
        validate_qaoa_circuit_example(
            "C. p=2 3q circuit vs brute force",
            Q_c,
            constant=-0.2,
            gammas=[0.09, 0.13],
            betas=[0.31, 0.22],
        )
    )
    examples.append(
        validate_uniform_invariant(
            "D. gamma=0 keeps uniform distribution",
            Q_c,
            constant=-0.2,
            gammas=[0.0, 0.0],
            betas=[0.31, 0.22],
        )
    )
    examples.append(
        validate_uniform_invariant(
            "E. beta=0 keeps uniform distribution",
            Q_c,
            constant=-0.2,
            gammas=[0.19, 0.07],
            betas=[0.0, 0.0],
        )
    )

    width = max(len(result.name) for result in examples)
    failures = 0
    print("\nQAOA Validation Harness\n" + "=" * 80)
    for result in examples:
        status = "PASS" if result.passed else "FAIL"
        print(f"{status:4}  {result.name:<{width}}  {result.detail}")
        if not result.passed:
            failures += 1
    print("=" * 80)
    if failures:
        raise SystemExit(f"{failures} validation check(s) failed.")
    print("All validation checks passed.")


if __name__ == "__main__":
    main()
