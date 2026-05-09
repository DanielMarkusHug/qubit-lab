"""QAOA execution helpers for controlled Version 9 runs."""

from __future__ import annotations

import os
import time
from contextlib import contextmanager

from app.usage_policy import (
    QAOA_LIGHTNING_MODE,
    QAOA_TENSOR_MODE,
    load_usage_config,
    qaoa_exact_probability_max_qubits,
    simulation_backend_for_mode,
)


class QAOAExecutionError(RuntimeError):
    """Raised when limited QAOA execution fails after optimization starts."""


def run_qaoa_sim(
    optimizer,
    runtime_inputs,
    logs: list[str] | None = None,
    max_qubits: int | None = None,
    *,
    run_mode: str = QAOA_LIGHTNING_MODE,
    requested_run_mode: str | None = None,
    simulation_backend: str | None = None,
):
    """Run the V6.1 QAOA path with strict cloud-safe settings.

    The QUBO has already been built with the existing optimizer logic. This
    function only flips on the bounded QAOA execution path and forces exact
    statevector probabilities for the small allowed problem sizes.
    """

    logs = logs if logs is not None else []
    backend = simulation_backend or simulation_backend_for_mode(run_mode) or "lightning.qubit"
    requested = requested_run_mode or run_mode
    _configure_limited_qaoa(
        optimizer,
        runtime_inputs,
        max_qubits=max_qubits,
        run_mode=run_mode,
        requested_run_mode=requested,
        simulation_backend=backend,
    )
    logs.append(f"QAOA simulation backend: {backend}")
    start = time.perf_counter()
    try:
        with _pennylane_backend_override(optimizer, backend):
            optimizer.run_qaoa()
    except Exception as exc:  # noqa: BLE001 - converted to controlled API error upstream
        if backend == "default.tensor" and _is_default_tensor_probs_unsupported(exc):
            try:
                _recover_default_tensor_probabilities(optimizer)
                logs.append("Recovered default.tensor probabilities from state-vector amplitudes.")
            except Exception as recovery_exc:  # noqa: BLE001 - preserve controlled API error
                optimizer.qaoa_runtime_sec = float(max(time.perf_counter() - start, 0.0))
                raise QAOAExecutionError("QAOA simulation execution failed.") from recovery_exc
        else:
            optimizer.qaoa_runtime_sec = float(max(time.perf_counter() - start, 0.0))
            raise QAOAExecutionError("QAOA simulation execution failed.") from exc

    try:
        optimizer.qaoa_runtime_sec = float(max(time.perf_counter() - start, 0.0))
        _normalize_limited_qaoa_outputs(optimizer, run_mode=run_mode)
        optimizer.generate_results()
    except Exception as exc:  # noqa: BLE001 - converted to controlled API error upstream
        optimizer.qaoa_runtime_sec = float(max(time.perf_counter() - start, 0.0))
        raise QAOAExecutionError("QAOA simulation execution failed.") from exc

    if getattr(optimizer, "samples_df", None) is None or len(optimizer.samples_df) == 0:
        raise QAOAExecutionError("QAOA simulation execution completed without exported candidates.")

    return optimizer, logs


def run_qaoa_limited(optimizer, runtime_inputs, logs: list[str] | None = None, max_qubits: int | None = None):
    """Legacy wrapper for the renamed lightning simulator mode."""

    return run_qaoa_sim(
        optimizer,
        runtime_inputs,
        logs,
        max_qubits=max_qubits,
        run_mode=QAOA_LIGHTNING_MODE,
        requested_run_mode=getattr(optimizer, "requested_run_mode", "qaoa_limited"),
    )


def _configure_limited_qaoa(
    optimizer,
    runtime_inputs,
    max_qubits: int | None = None,
    *,
    run_mode: str = QAOA_LIGHTNING_MODE,
    requested_run_mode: str | None = None,
    simulation_backend: str | None = None,
) -> None:
    optimizer.enable_qaoa = True
    optimizer.requested_run_mode = requested_run_mode or run_mode
    optimizer.run_mode = run_mode
    optimizer.qaoa_mode = run_mode
    optimizer.simulation_backend = simulation_backend or simulation_backend_for_mode(run_mode) or "lightning.qubit"
    optimizer.legacy_run_mode_alias = bool(optimizer.requested_run_mode != run_mode)
    optimizer.hardware_replay = False
    optimizer.qaoa_p = int(runtime_inputs.layers)
    optimizer.qaoa_maxiter = int(runtime_inputs.iterations)
    optimizer.qaoa_multistart_restarts = int(runtime_inputs.restarts)
    if getattr(runtime_inputs, "random_seed", None) is not None:
        seed = int(runtime_inputs.random_seed)
        optimizer.rng_seed = seed
        optimizer.rng_seed_override = seed

    optimizer.qaoa_layerwise_warm_start = bool(getattr(runtime_inputs, "warm_start", False))
    if getattr(runtime_inputs, "restart_perturbation", None) is not None:
        optimizer.qaoa_restart_perturbation = max(0.0, float(runtime_inputs.restart_perturbation))
    optimizer.qaoa_maxiter_per_param = 0
    if getattr(runtime_inputs, "qaoa_shots", None) is not None:
        optimizer.qaoa_shots = max(1, int(runtime_inputs.qaoa_shots))
    elif not getattr(optimizer, "qaoa_shots", None):
        optimizer.qaoa_shots = 4096
    n_qubits = max(int(getattr(optimizer, "n", 0)), 0)
    exact_probability_max_qubits = qaoa_exact_probability_max_qubits()
    exact_probabilities = bool(n_qubits <= exact_probability_max_qubits)
    optimizer.qaoa_tensor_sampling_mode = bool(run_mode == QAOA_TENSOR_MODE)
    optimizer.qaoa_exact_probability_max_qubits = int(exact_probability_max_qubits)
    optimizer.qaoa_max_qubits_allowed = int(max_qubits or getattr(optimizer, "qaoa_max_qubits_allowed", 16) or 16)
    optimizer.qaoa_exact_p1_presearch = False
    optimizer.qaoa_concentration_polish_enabled = False
    optimizer.qaoa_sampled_concentration_polish_enabled = False

    optimizer.qaoa_export_mode = "top_k"
    optimizer.qaoa_export_sort_by = "probability"
    optimizer.qaoa_export_feasible_only = False
    optimizer.qaoa_min_probability_to_export = 0.0
    requested_export_rows = max(1, int(getattr(optimizer, "qaoa_max_export_rows", 5000) or 5000))
    state_space = 1 << n_qubits
    safety_cap = _qaoa_limited_export_safety_cap()
    effective_export_rows = max(1, min(requested_export_rows, state_space, safety_cap))
    optimizer.qaoa_export_requested_rows = int(requested_export_rows)
    optimizer.qaoa_export_safety_cap = int(safety_cap)
    optimizer.qaoa_max_export_rows = int(effective_export_rows)
    optimizer.qaoa_export_cap_applied = bool(effective_export_rows < requested_export_rows)
    if requested_export_rows > safety_cap:
        optimizer.qaoa_export_cap_reason = "qaoa_limited_exact_export_safety_cap"
    elif requested_export_rows > state_space:
        optimizer.qaoa_export_cap_reason = "state_space_smaller_than_requested_rows"
    else:
        optimizer.qaoa_export_cap_reason = "requested_rows_within_safety_cap"
    optimizer.qaoa_exact_qubo_diagnostic_rows = 0
    optimizer.qaoa_limited_exact_probabilities = exact_probabilities
    optimizer.qaoa_sim_exact_probabilities = exact_probabilities
    optimizer.qaoa_limited_runtime_inputs = {
        "layers": int(runtime_inputs.layers),
        "iterations": int(runtime_inputs.iterations),
        "restarts": int(runtime_inputs.restarts),
        "warm_start": bool(getattr(runtime_inputs, "warm_start", False)),
        "restart_perturbation": getattr(runtime_inputs, "restart_perturbation", None),
        "random_seed": getattr(runtime_inputs, "random_seed", None),
    }
    optimizer.qaoa_sim_runtime_inputs = dict(optimizer.qaoa_limited_runtime_inputs)


def _normalize_limited_qaoa_outputs(optimizer, *, run_mode: str = QAOA_LIGHTNING_MODE) -> None:
    samples = getattr(optimizer, "samples_df", None)
    if samples is None or len(samples) == 0:
        return

    exact_probabilities = bool(
        getattr(optimizer, "qaoa_sim_exact_probabilities", False)
        or getattr(optimizer, "qaoa_limited_exact_probabilities", False)
    )
    samples = samples.copy()
    samples["source"] = run_mode
    if exact_probabilities:
        samples["selection_scope"] = "qaoa exact probability sample"
    elif "selection_scope" not in samples.columns:
        samples["selection_scope"] = "qaoa sampled measurement"
    optimizer.samples_df = samples

    best_qubo = optimizer.sort_candidates(samples).head(20).copy()
    best_qubo["source"] = run_mode
    if exact_probabilities:
        best_qubo["selection_scope"] = "qaoa exact probability sample"
    elif "selection_scope" not in best_qubo.columns:
        best_qubo["selection_scope"] = "qaoa sampled measurement"
    optimizer.qaoa_exact_best_qubo_df = best_qubo
    optimizer.qaoa_mode = run_mode
    optimizer.qaoa_exact_states_exported = int(len(samples)) if exact_probabilities else 0
    optimizer.qaoa_sampled_states_exported = int(len(samples)) if not exact_probabilities else 0


def _is_default_tensor_probs_unsupported(exc: Exception) -> bool:
    current: BaseException | None = exc
    messages: list[str] = []
    while current is not None:
        messages.append(str(current))
        current = current.__cause__ or current.__context__
    text = "\n".join(messages).lower()
    return "default.tensor" in text and "probs" in text and "not supported" in text


def _recover_default_tensor_probabilities(optimizer) -> None:
    """Export exact probabilities for default.tensor using its supported state measurement."""

    if getattr(optimizer, "run_mode", None) != QAOA_TENSOR_MODE:
        raise QAOAExecutionError("Tensor probability recovery is only valid for qaoa_tensor_sim.")

    best_gammas = getattr(optimizer, "best_gammas", None)
    best_betas = getattr(optimizer, "best_betas", None)
    if best_gammas is None or best_betas is None:
        raise QAOAExecutionError("Tensor probability recovery requires optimized QAOA parameters.")

    import heapq

    import numpy as np
    import pandas as pd
    import pennylane as qml

    n_qubits = int(getattr(optimizer, "n", 0) or 0)
    if n_qubits <= 0:
        raise QAOAExecutionError("Tensor probability recovery requires at least one qubit.")

    h, j_terms, _offset = optimizer._qubo_to_ising(optimizer.Q, optimizer.constant)
    params_opt = np.concatenate([np.asarray(best_gammas, dtype=float), np.asarray(best_betas, dtype=float)])

    dev = qml.device("default.tensor", wires=n_qubits)

    def apply_qaoa_layer(gamma, beta):
        for i, coeff in enumerate(h):
            if abs(coeff) > 1e-12:
                qml.RZ(2 * gamma * coeff, wires=i)
        for (i, j), coeff in j_terms.items():
            if abs(coeff) > 1e-12:
                qml.CNOT(wires=[i, j])
                qml.RZ(2 * gamma * coeff, wires=j)
                qml.CNOT(wires=[i, j])
        for wire in range(n_qubits):
            qml.RX(2 * beta, wires=wire)

    @qml.qnode(dev, interface="autograd")
    def qaoa_state(params):
        gammas = params[: int(optimizer.qaoa_p)]
        betas = params[int(optimizer.qaoa_p) :]
        for wire in range(n_qubits):
            qml.Hadamard(wires=wire)
        for layer in range(int(optimizer.qaoa_p)):
            apply_qaoa_layer(gammas[layer], betas[layer])
        return qml.state()

    state = np.asarray(qaoa_state(params_opt), dtype=complex).reshape(-1)
    probs = np.square(np.abs(state)).astype(float)
    prob_sum = float(np.sum(probs))
    if prob_sum > 0.0 and np.isfinite(prob_sum):
        probs = probs / prob_sum

    optimizer.qaoa_tensor_state_probability_recovery = True
    optimizer.qaoa_total_states_considered = int(len(probs))
    optimizer.qaoa_total_nonzero_states = int(np.count_nonzero(probs > 0))
    optimizer.qaoa_max_state_probability = float(np.max(probs)) if len(probs) else float("nan")
    topk_mass_count = min(10, len(probs))
    if topk_mass_count > 0:
        topk_mass_idx = np.argpartition(probs, -topk_mass_count)[-topk_mass_count:]
        optimizer.qaoa_top10_probability_mass = float(np.sum(probs[topk_mass_idx]))

    def build_exact_row(state_idx: int, prob: float, selection_scope: str):
        bitstring = format(state_idx, f"0{n_qubits}b")
        bits = np.array(list(map(int, bitstring)), dtype=int)
        stats = optimizer.portfolio_stats(bits)
        if getattr(optimizer, "qaoa_export_feasible_only", False) and not optimizer.row_is_feasible(stats):
            return None
        term_stats = optimizer.qubo_term_breakdown(bits)
        return {
            "bitstring": "".join(map(str, bits.astype(int))),
            "source": f"qaoa_tensor_state_p{int(optimizer.qaoa_p)}",
            "selection_scope": selection_scope,
            "probability": float(prob),
            "qubo_value": optimizer.qubo_value(bits),
            **term_stats,
            **stats,
        }

    if getattr(optimizer, "qaoa_tensor_sampling_mode", False):
        shots = max(1, int(getattr(optimizer, "qaoa_shots", 4096) or 4096))
        rng = np.random.default_rng(getattr(optimizer, "rng_seed", None))
        sample_probabilities = probs if float(np.sum(probs)) > 0.0 else None
        sampled_indices = rng.choice(len(probs), size=shots, replace=True, p=sample_probabilities)
        unique_indices, counts = np.unique(sampled_indices, return_counts=True)
        sample_counts = sorted(
            zip(unique_indices.astype(int), counts.astype(int)),
            key=lambda item: (-item[1], item[0]),
        )
        total_unique_samples = max(len(sample_counts), 1)
        optimizer.qaoa_total_states_considered = int(shots)
        optimizer.qaoa_total_nonzero_states = int(len(sample_counts))
        optimizer.qaoa_limited_exact_probabilities = False
        optimizer.qaoa_sim_exact_probabilities = False
        optimizer.qaoa_export_scope = (
            f"unique sampled states from {shots:,} shots "
            f"({len(sample_counts):,} unique before export cap), capped at "
            f"{int(getattr(optimizer, 'qaoa_max_export_rows', 5000) or 5000):,} rows sorted by "
            f"{getattr(optimizer, 'qaoa_export_sort_by', 'probability')}"
        )
        if shots > 0 and sample_counts:
            counts_sorted = sorted((count for _idx, count in sample_counts), reverse=True)
            optimizer.qaoa_max_state_probability = float(counts_sorted[0] / shots)
            optimizer.qaoa_top10_probability_mass = float(sum(counts_sorted[:10]) / shots)

        q_rows = []
        for idx, (state_idx, count) in enumerate(sample_counts, start=1):
            row = build_exact_row(int(state_idx), float(count / shots), optimizer.qaoa_export_scope)
            if row is not None:
                row["source"] = f"qaoa_tensor_sample_p{int(optimizer.qaoa_p)}"
                q_rows.append(row)
            if idx >= total_unique_samples:
                break

        samples = optimizer.sort_qaoa_export(pd.DataFrame(q_rows))
        max_rows = int(getattr(optimizer, "qaoa_max_export_rows", 5000) or 5000)
        if len(samples) > max_rows:
            samples = samples.head(max_rows).copy()
        optimizer.samples_df = samples
        optimizer.qaoa_exact_states_exported = 0
        optimizer.qaoa_sampled_states_exported = int(len(samples))

        if len(samples):
            best_qubo_row = samples.sort_values("qubo_value").iloc[0]
            top_prob_row = samples.sort_values("probability", ascending=False).iloc[0]
            optimizer.qaoa_best_exported_qubo = float(best_qubo_row.get("qubo_value", np.nan))
            optimizer.qaoa_best_exported_probability = float(best_qubo_row.get("probability", np.nan))
            optimizer.qaoa_best_exported_qubo_scope = str(
                best_qubo_row.get("selection_scope", optimizer.qaoa_export_scope) or optimizer.qaoa_export_scope
            )
            optimizer.qaoa_top_probability_state_qubo = float(top_prob_row.get("qubo_value", np.nan))

        optimizer._log("Recovered default.tensor state amplitudes and sampled output states.")
        optimizer._log(f"QAOA candidate count: {len(optimizer.samples_df)}")
        optimizer._log(f"QAOA total shots considered: {optimizer.qaoa_total_states_considered}")
        optimizer._log(f"QAOA unique sampled states encountered: {optimizer.qaoa_total_nonzero_states}")
        return

    q_rows = []
    fast_exact_probability_path = (
        getattr(optimizer, "qaoa_export_mode", None) == "top_k"
        and getattr(optimizer, "qaoa_export_sort_by", None) == "probability"
        and not getattr(optimizer, "qaoa_export_feasible_only", False)
    )

    if fast_exact_probability_path:
        top_count = min(int(getattr(optimizer, "qaoa_max_export_rows", 5000) or 5000), len(probs))
        optimizer.qaoa_export_scope = (
            f"top {top_count:,} states by probability from "
            f"2^{n_qubits} = {len(probs):,} exact bitstrings "
            f"(configured qaoa_max_export_rows={int(getattr(optimizer, 'qaoa_max_export_rows', top_count)):,})"
        )
        if top_count > 0:
            top_idx = np.argpartition(probs, -top_count)[-top_count:]
            top_idx = top_idx[np.argsort(probs[top_idx])[::-1]]
            for idx in top_idx:
                prob = float(probs[idx])
                if prob < float(getattr(optimizer, "qaoa_min_probability_to_export", 0.0) or 0.0):
                    break
                row = build_exact_row(int(idx), prob, optimizer.qaoa_export_scope)
                if row is not None:
                    q_rows.append(row)
    else:
        exact_heap = []
        exact_counter = 0
        optimizer.qaoa_export_scope = (
            f"top {int(getattr(optimizer, 'qaoa_max_export_rows', 5000) or 5000):,} exact states "
            f"by {getattr(optimizer, 'qaoa_export_sort_by', 'probability')} "
            f"from 2^{n_qubits} = {len(probs):,} bitstrings"
        )
        for idx, prob in enumerate(probs):
            if prob < float(getattr(optimizer, "qaoa_min_probability_to_export", 0.0) or 0.0):
                continue
            row = build_exact_row(int(idx), float(prob), optimizer.qaoa_export_scope)
            if row is None:
                continue
            if getattr(optimizer, "qaoa_export_mode", None) == "all_filtered":
                q_rows.append(row)
                continue
            priority = optimizer.qaoa_export_priority(row)
            payload = (priority, exact_counter, row)
            if len(exact_heap) < int(getattr(optimizer, "qaoa_max_export_rows", 5000) or 5000):
                heapq.heappush(exact_heap, payload)
            elif priority > exact_heap[0][0]:
                heapq.heapreplace(exact_heap, payload)
            exact_counter += 1
        if getattr(optimizer, "qaoa_export_mode", None) == "top_k":
            q_rows = [item[2] for item in exact_heap]

    samples = optimizer.sort_qaoa_export(pd.DataFrame(q_rows))
    max_rows = int(getattr(optimizer, "qaoa_max_export_rows", 5000) or 5000)
    if len(samples) > max_rows:
        samples = samples.head(max_rows).copy()
    optimizer.samples_df = samples

    if len(samples):
        best_qubo_row = samples.sort_values("qubo_value").iloc[0]
        top_prob_row = samples.sort_values("probability", ascending=False).iloc[0]
        optimizer.qaoa_best_exported_qubo = float(best_qubo_row.get("qubo_value", np.nan))
        optimizer.qaoa_best_exported_probability = float(best_qubo_row.get("probability", np.nan))
        optimizer.qaoa_best_exported_qubo_scope = str(
            best_qubo_row.get("selection_scope", optimizer.qaoa_export_scope) or optimizer.qaoa_export_scope
        )
        optimizer.qaoa_top_probability_state_qubo = float(top_prob_row.get("qubo_value", np.nan))

    optimizer._log("Recovered default.tensor exact probabilities from qml.state().")
    optimizer._log(f"QAOA candidate count: {len(optimizer.samples_df)}")
    optimizer._log(f"QAOA total states considered: {optimizer.qaoa_total_states_considered}")
    optimizer._log(f"QAOA nonzero states encountered: {optimizer.qaoa_total_nonzero_states}")


@contextmanager
def _pennylane_backend_override(optimizer, backend: str):
    """Override the shared optimizer's hardcoded lightning device for V9 modes."""

    if backend == "lightning.qubit":
        yield
        return

    run_qaoa_method = getattr(optimizer, "run_qaoa", None)
    qml_module = getattr(getattr(run_qaoa_method, "__func__", run_qaoa_method), "__globals__", {}).get("qml")
    if qml_module is None or not hasattr(qml_module, "device"):
        yield
        return

    original_device = qml_module.device

    def _device(name, *args, **kwargs):
        selected_name = backend if name == "lightning.qubit" else name
        return original_device(selected_name, *args, **kwargs)

    qml_module.device = _device
    try:
        yield
    finally:
        qml_module.device = original_device


def _qaoa_limited_export_safety_cap() -> int:
    configured = os.getenv("QAOA_LIMITED_MAX_EXPORT_ROWS_CAP")
    if configured is None:
        estimator = load_usage_config().get("runtime_estimator", {})
        configured = estimator.get("qaoa_sim_max_export_rows_cap", estimator.get("qaoa_limited_max_export_rows_cap", 5000))
    try:
        return max(1, int(float(configured)))
    except (TypeError, ValueError):
        return 5000
