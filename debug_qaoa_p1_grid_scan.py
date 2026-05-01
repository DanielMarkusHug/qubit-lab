#!/usr/bin/env python3
"""
Exact p=1 grid scan for a real workbook instance.

Purpose:
- Remove COBYLA, warm starts, and restart logic from the equation.
- Map the real p=1 landscape on a workbook-derived QUBO instance.
- Compare "good expectation" vs "good concentration" directly.

Outputs:
- CSV with one row per (gamma, beta) grid point
- Optional PNG heatmaps for key metrics

Example:
    MPLCONFIGDIR=/tmp/matplotlib .venv/bin/python3 debug_qaoa_p1_grid_scan.py \
      "Version 3/parametric_assets_only_input_small.xlsx"
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

try:
    import matplotlib.pyplot as plt
except ImportError:
    plt = None

try:
    import pennylane as qml
except ImportError as exc:  # pragma: no cover - explicit runtime failure
    raise SystemExit("PennyLane is required to run this grid scan.") from exc

from qaoa_optimizer_V4_core import QAOAOptimizerV4


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Exact p=1 QAOA grid scan on a workbook-derived QUBO.")
    parser.add_argument("workbook", help="Path to workbook")
    parser.add_argument("--gamma-min", type=float, default=0.0)
    parser.add_argument("--gamma-max", type=float, default=1.0)
    parser.add_argument("--gamma-points", type=int, default=61)
    parser.add_argument("--beta-min", type=float, default=0.0)
    parser.add_argument("--beta-max", type=float, default=np.pi / 2.0)
    parser.add_argument("--beta-points", type=int, default=61)
    parser.add_argument("--top-k", type=int, default=50, help="Probability-ranked cluster size for diagnostics")
    parser.add_argument("--max-qubits", type=int, default=16, help="Safety cap for exhaustive exact scan")
    parser.add_argument("--no-heatmaps", action="store_true", help="Skip PNG heatmap generation")
    return parser


def exact_p1_probs(h: np.ndarray, J: dict[tuple[int, int], float], gamma: float, beta: float) -> np.ndarray:
    n = len(h)
    dev = qml.device("lightning.qubit", wires=n, shots=None)

    @qml.qnode(dev)
    def circuit():
        for wire in range(n):
            qml.Hadamard(wires=wire)
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
        return qml.probs(wires=range(n))

    return np.asarray(circuit(), dtype=float)


def state_metrics(opt: QAOAOptimizerV4):
    total_states = 1 << opt.n
    labels = []
    qubo = np.zeros(total_states, dtype=float)
    selected_usd = np.zeros(total_states, dtype=float)
    budget_gap = np.zeros(total_states, dtype=float)
    port_ret = np.zeros(total_states, dtype=float)
    port_vol = np.zeros(total_states, dtype=float)

    for idx in range(total_states):
        bitstring = format(idx, f"0{opt.n}b")
        bits = np.fromiter((int(ch) for ch in bitstring), count=opt.n, dtype=int)
        labels.append(bitstring)
        qubo[idx] = opt.qubo_value(bits)
        stats = opt.portfolio_stats(bits)
        selected_usd[idx] = float(stats["selected_usd"])
        budget_gap[idx] = float(stats["budget_gap"])
        port_ret[idx] = float(stats["portfolio_return"])
        port_vol[idx] = float(stats["portfolio_vol"])

    return {
        "labels": np.asarray(labels, dtype=object),
        "qubo": qubo,
        "selected_usd": selected_usd,
        "budget_gap": budget_gap,
        "portfolio_return": port_ret,
        "portfolio_vol": port_vol,
    }


def summarize_grid_point(
    probs: np.ndarray,
    metrics: dict[str, np.ndarray],
    *,
    top_k: int,
    budget_tolerance: float,
) -> dict[str, float | str]:
    labels = metrics["labels"]
    qubo = metrics["qubo"]
    selected_usd = metrics["selected_usd"]
    budget_gap = metrics["budget_gap"]
    port_ret = metrics["portfolio_return"]
    port_vol = metrics["portfolio_vol"]

    top_idx = int(np.argmax(probs))
    order = np.argsort(probs)[::-1]
    topk = order[: min(top_k, len(order))]
    top10 = order[: min(10, len(order))]

    feasible_mask = np.abs(budget_gap) <= float(budget_tolerance)
    qubo_lt_1 = qubo < 1.0
    qubo_lt_2 = qubo < 2.0
    qubo_lt_3 = qubo < 3.0
    qubo_lt_5 = qubo < 5.0

    return {
        "expected_qubo": float(np.dot(probs, qubo)),
        "expected_invested_usd": float(np.dot(probs, selected_usd)),
        "expected_budget_gap_usd": float(np.dot(probs, budget_gap)),
        "mass_qubo_lt_1": float(np.sum(probs[qubo_lt_1])),
        "mass_qubo_lt_2": float(np.sum(probs[qubo_lt_2])),
        "mass_qubo_lt_3": float(np.sum(probs[qubo_lt_3])),
        "mass_qubo_lt_5": float(np.sum(probs[qubo_lt_5])),
        "mass_feasible": float(np.sum(probs[feasible_mask])),
        "max_state_probability": float(probs[top_idx]),
        "top10_probability_mass": float(np.sum(probs[top10])),
        "most_likely_bitstring": str(labels[top_idx]),
        "most_likely_qubo": float(qubo[top_idx]),
        "most_likely_invested_usd": float(selected_usd[top_idx]),
        "most_likely_budget_gap_usd": float(budget_gap[top_idx]),
        "most_likely_return": float(port_ret[top_idx]),
        "most_likely_vol": float(port_vol[top_idx]),
        "topk_avg_qubo": float(np.mean(qubo[topk])),
        "topk_avg_invested_usd": float(np.mean(selected_usd[topk])),
        "topk_best_qubo": float(np.min(qubo[topk])),
        "topk_best_probability": float(np.max(probs[topk][qubo[topk] == np.min(qubo[topk])])),
    }


def save_heatmap(df: pd.DataFrame, x_values: np.ndarray, y_values: np.ndarray, field: str, output_path: Path):
    if plt is None:
        return

    pivot = df.pivot(index="beta", columns="gamma", values=field).sort_index(ascending=True)
    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(
        pivot.to_numpy(),
        origin="lower",
        aspect="auto",
        extent=[x_values.min(), x_values.max(), y_values.min(), y_values.max()],
    )
    ax.set_title(field.replace("_", " "))
    ax.set_xlabel("gamma")
    ax.set_ylabel("beta")
    fig.colorbar(im, ax=ax)
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def main():
    args = build_parser().parse_args()
    workbook = Path(args.workbook)
    if not workbook.exists():
        raise SystemExit(f"Workbook not found: {workbook}")

    opt = QAOAOptimizerV4(str(workbook))
    opt.load_input()
    opt.build_qubo()

    if opt.n > args.max_qubits:
        raise SystemExit(
            f"Refusing exhaustive exact scan for n={opt.n}. Increase --max-qubits if you really want this."
        )

    h, J, _ = QAOAOptimizerV4._qubo_to_ising(opt.Q, opt.constant)
    metrics = state_metrics(opt)

    gammas = np.linspace(args.gamma_min, args.gamma_max, args.gamma_points)
    betas = np.linspace(args.beta_min, args.beta_max, args.beta_points)

    rows = []
    total = len(gammas) * len(betas)
    done = 0
    print("\nExact p=1 QAOA Grid Scan")
    print("=" * 80)
    print(f"Workbook: {workbook}")
    print(f"Decision variables: {opt.n}")
    print(f"Grid size: {len(gammas)} x {len(betas)} = {total}")
    print(f"Budget tolerance used for feasible mass: {opt.qaoa_feasibility_budget_tolerance_usd:,.2f} USD")
    print("=" * 80)

    for beta in betas:
        for gamma in gammas:
            probs = exact_p1_probs(h, J, float(gamma), float(beta))
            row = {
                "gamma": float(gamma),
                "beta": float(beta),
                **summarize_grid_point(
                    probs,
                    metrics,
                    top_k=args.top_k,
                    budget_tolerance=float(opt.qaoa_feasibility_budget_tolerance_usd),
                ),
            }
            rows.append(row)
            done += 1
            if done % max(1, total // 10) == 0:
                print(f"Progress: {done}/{total}")

    df = pd.DataFrame(rows)
    out_dir = workbook.parent / f"{workbook.stem}_p1_grid_scan"
    out_dir.mkdir(exist_ok=True)
    csv_path = out_dir / "grid_scan.csv"
    df.to_csv(csv_path, index=False)

    best_expected = df.nsmallest(10, "expected_qubo")
    best_mass = df.nlargest(10, "mass_qubo_lt_1")
    best_topk = df.nsmallest(10, "topk_best_qubo")

    print("\nTop 10 by expected QUBO")
    print(best_expected[["gamma", "beta", "expected_qubo", "mass_qubo_lt_1", "max_state_probability", "most_likely_qubo", "most_likely_invested_usd"]].to_string(index=False))

    print("\nTop 10 by probability mass on QUBO < 1")
    print(best_mass[["gamma", "beta", "mass_qubo_lt_1", "expected_qubo", "max_state_probability", "most_likely_qubo", "topk_best_qubo"]].to_string(index=False))

    print("\nTop 10 by best QUBO within top-k probability cluster")
    print(best_topk[["gamma", "beta", "topk_best_qubo", "topk_avg_invested_usd", "expected_qubo", "max_state_probability"]].to_string(index=False))

    print(f"\nSaved grid CSV: {csv_path}")

    if not args.no_heatmaps and plt is not None:
        save_heatmap(df, gammas, betas, "expected_qubo", out_dir / "expected_qubo.png")
        save_heatmap(df, gammas, betas, "mass_qubo_lt_1", out_dir / "mass_qubo_lt_1.png")
        save_heatmap(df, gammas, betas, "max_state_probability", out_dir / "max_state_probability.png")
        save_heatmap(df, gammas, betas, "most_likely_qubo", out_dir / "most_likely_qubo.png")
        print(f"Saved heatmaps to: {out_dir}")


if __name__ == "__main__":
    main()
