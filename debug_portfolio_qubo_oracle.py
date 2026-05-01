#!/usr/bin/env python3
"""
Independent portfolio-QUBO validator.

This script does NOT trust the notebook and does NOT trust the matrix builder.
Instead, it reconstructs the QUBO coefficients from the intended portfolio
objective by evaluating that objective on basis states and pairs.

For a quadratic pseudo-Boolean objective f(x), the upper-triangular QUBO
coefficients are recovered by:

    constant = f(0)
    Q[i, i] = f(e_i) - f(0)
    Q[i, j] = f(e_i + e_j) - f(e_i) - f(e_j) + f(0),  i < j

Run:
    .venv/bin/python3 debug_portfolio_qubo_oracle.py "Version 3/parametric_assets_only_input_small.xlsx"
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

from qaoa_optimizer_V4_core import QAOAOptimizerV4


def business_objective(
    x: np.ndarray,
    *,
    scaled_cost: np.ndarray,
    ret_scaled: np.ndarray,
    sigma_scaled: np.ndarray,
    lambda_budget: float,
    lambda_variance: float,
) -> float:
    x = np.asarray(x, dtype=float)
    reward = ret_scaled * scaled_cost
    weighted = x * scaled_cost
    return_term = float(-np.dot(reward, x))
    risk_term = float(lambda_variance * (weighted @ sigma_scaled @ weighted))
    budget_term = float(lambda_budget * (weighted.sum() - 1.0) ** 2)
    return float(return_term + risk_term + budget_term)


def recover_qubo_from_objective(
    *,
    n: int,
    scaled_cost: np.ndarray,
    ret_scaled: np.ndarray,
    sigma_scaled: np.ndarray,
    lambda_budget: float,
    lambda_variance: float,
) -> tuple[np.ndarray, float]:
    zero = np.zeros(n, dtype=int)
    constant = business_objective(
        zero,
        scaled_cost=scaled_cost,
        ret_scaled=ret_scaled,
        sigma_scaled=sigma_scaled,
        lambda_budget=lambda_budget,
        lambda_variance=lambda_variance,
    )
    Q = np.zeros((n, n), dtype=float)
    single_vals = np.zeros(n, dtype=float)

    for i in range(n):
        e = np.zeros(n, dtype=int)
        e[i] = 1
        val = business_objective(
            e,
            scaled_cost=scaled_cost,
            ret_scaled=ret_scaled,
            sigma_scaled=sigma_scaled,
            lambda_budget=lambda_budget,
            lambda_variance=lambda_variance,
        )
        single_vals[i] = val
        Q[i, i] = val - constant

    for i in range(n):
        for j in range(i + 1, n):
            e = np.zeros(n, dtype=int)
            e[i] = 1
            e[j] = 1
            val = business_objective(
                e,
                scaled_cost=scaled_cost,
                ret_scaled=ret_scaled,
                sigma_scaled=sigma_scaled,
                lambda_budget=lambda_budget,
                lambda_variance=lambda_variance,
            )
            Q[i, j] = val - single_vals[i] - single_vals[j] + constant

    return Q, float(constant)


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: .venv/bin/python3 debug_portfolio_qubo_oracle.py "<workbook.xlsx>"')

    workbook = Path(sys.argv[1])
    opt = QAOAOptimizerV4(str(workbook))
    opt.load_input()
    opt.build_qubo()

    meta = opt.qubo_meta
    oracle_Q, oracle_constant = recover_qubo_from_objective(
        n=opt.n,
        scaled_cost=np.asarray(meta["scaled_cost"], dtype=float),
        ret_scaled=np.asarray(meta["ret_scaled"], dtype=float),
        sigma_scaled=np.asarray(meta["Sigma_scaled"], dtype=float),
        lambda_budget=float(meta["lambda_budget"]),
        lambda_variance=float(meta["lambda_variance"]),
    )

    q_diff = np.abs(opt.Q - oracle_Q)
    const_diff = abs(float(opt.constant) - oracle_constant)
    max_q_diff = float(np.max(q_diff)) if q_diff.size else 0.0
    worst_idx = np.unravel_index(int(np.argmax(q_diff)), q_diff.shape) if q_diff.size else (0, 0)

    print("\nIndependent Portfolio-QUBO Validation")
    print("=" * 80)
    print(f"Workbook: {workbook}")
    print(f"Decision variables: {opt.n}")
    print(f"Core constant:   {float(opt.constant):.15f}")
    print(f"Oracle constant: {oracle_constant:.15f}")
    print(f"|constant diff|: {const_diff:.3e}")
    print(f"max |Q-core - Q-oracle|: {max_q_diff:.3e} at index {worst_idx}")

    if q_diff.size:
        i, j = worst_idx
        print(f"  core Q[{i},{j}]   = {float(opt.Q[i, j]):.15f}")
        print(f"  oracle Q[{i},{j}] = {float(oracle_Q[i, j]):.15f}")

    # Spot-check random bitstrings against both definitions.
    rng = np.random.default_rng(123)
    worst_eval = 0.0
    worst_label = ""
    for _ in range(min(256, 1 << min(opt.n, 16))):
        x = rng.integers(0, 2, size=opt.n, endpoint=False)
        core_val = float(x @ opt.Q @ x + opt.constant)
        oracle_val = business_objective(
            x,
            scaled_cost=np.asarray(meta["scaled_cost"], dtype=float),
            ret_scaled=np.asarray(meta["ret_scaled"], dtype=float),
            sigma_scaled=np.asarray(meta["Sigma_scaled"], dtype=float),
            lambda_budget=float(meta["lambda_budget"]),
            lambda_variance=float(meta["lambda_variance"]),
        )
        diff = abs(core_val - oracle_val)
        if diff > worst_eval:
            worst_eval = diff
            worst_label = "".join(map(str, x.tolist()))

    print(f"max |value-core - value-oracle| over spot checks: {worst_eval:.3e} at {worst_label or 'n/a'}")
    print("=" * 80)

    if max_q_diff > 1e-9 or const_diff > 1e-9 or worst_eval > 1e-9:
        raise SystemExit("Validation FAILED: core QUBO does not match independent objective oracle.")
    print("Validation PASSED: core QUBO matches independent objective oracle.")


if __name__ == "__main__":
    main()
