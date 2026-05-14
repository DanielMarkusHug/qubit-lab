"""IBM Quantum Runtime helpers for V9 second-opinion execution."""

from __future__ import annotations

import datetime as dt
import os
import time
from importlib import metadata
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping

from app.config import Config
from app.ibm_circuit import (
    build_qiskit_qaoa_circuit_from_optimizer,
    optimizer_bitstring_from_qiskit_key,
    qaoa_ibm_circuit_metadata,
    qiskit_counts_to_optimizer_probabilities,
)
from app.schemas import ApiError, json_safe
from app.usage_policy import EXPORT_MODE_IBM_EXTERNAL_RUN


IBM_RUNTIME_CHANNEL = "ibm_quantum_platform"
IBM_DEFAULT_INSTANCE = "open-instance"
IBM_DEFAULT_EXACT_SHOTS = 4096
IBM_HERON2_OK_2Q_DEPTH = 150
IBM_HERON2_CRITICAL_2Q_DEPTH = 250
IBM_TESTER_TIMEOUT_SEC = 30 * 60
IBM_STANDARD_TIMEOUT_SEC = 2 * 60 * 60
IBM_SECRET_ENV_KEY = "QAOA_IBM_SECRET_BACKEND"
IBM_SECRET_LOCAL = "local"
IBM_SECRET_MANAGER = "secret_manager"
IBM_TOKEN_FORM_FIELD = "ibm_token"
IBM_INSTANCE_FORM_FIELD = "ibm_instance"
IBM_BACKEND_FORM_FIELD = "ibm_backend"
IBM_FRACTIONAL_GATES_FORM_FIELD = "ibm_fractional_gates"
IBM_PARALLELIZATION_FORM_FIELD = "ibm_parallelization"


def sensitive_form_fields() -> set[str]:
    return {IBM_TOKEN_FORM_FIELD}


def _fractional_mode_label(use_fractional_gates: bool) -> str:
    return "Prefer fractional gates" if use_fractional_gates else "Standard basis"


def _construction_mode_label(parallelize_cost_terms: bool) -> str:
    return (
        "Parallelized construction"
        if parallelize_cost_terms
        else "Current / standard construction"
    )


def ibm_runtime_enabled_for_mode(export_mode: str | None) -> bool:
    return str(export_mode or "").strip().lower() == EXPORT_MODE_IBM_EXTERNAL_RUN


def ibm_runtime_settings_from_request(
    form_data,
    *,
    optimizer=None,
    runtime_inputs=None,
    effective_settings: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    instance = _form_value(form_data, IBM_INSTANCE_FORM_FIELD, IBM_DEFAULT_INSTANCE).strip() or IBM_DEFAULT_INSTANCE
    backend_name = _form_value(form_data, IBM_BACKEND_FORM_FIELD, "").strip() or None
    use_fractional_gates = _form_bool(form_data, IBM_FRACTIONAL_GATES_FORM_FIELD, False)
    parallelize_cost_terms = _form_bool(form_data, IBM_PARALLELIZATION_FORM_FIELD, False)
    exact_mode = _ibm_reference_mode_is_exact(runtime_inputs=runtime_inputs, effective_settings=effective_settings)
    reference_shots = None
    if runtime_inputs is not None:
        reference_shots = _int_or_none(getattr(runtime_inputs, "qaoa_shots", None))
    if reference_shots is None and effective_settings:
        reference_shots = _int_or_none(effective_settings.get("qaoa_shots"))
    candidate_reference_rows = _ibm_candidate_reference_rows(
        optimizer=optimizer,
        effective_settings=effective_settings,
    )

    if exact_mode and candidate_reference_rows is not None and candidate_reference_rows > 0:
        hardware_shots = int(candidate_reference_rows)
        hardware_shots_source = "matched_qaoa_candidate_request_exact_mode"
        comparability_note = (
            "Internal QAOA ran in exact-probability mode, so IBM hardware uses the requested "
            f"quantum-candidate comparison pool size: {hardware_shots} shots."
        )
    elif exact_mode:
        hardware_shots = ibm_default_exact_shots()
        hardware_shots_source = "default_from_exact_mode"
        comparability_note = (
            f"Internal QAOA ran in exact-probability mode, so IBM hardware uses {hardware_shots} shots "
            "for the comparison run."
        )
    elif reference_shots is not None and reference_shots > 0:
        hardware_shots = int(reference_shots)
        hardware_shots_source = "matched_qaoa_sampling"
        comparability_note = (
            f"IBM hardware uses {hardware_shots} shots to match the simulator sample count."
        )
    else:
        hardware_shots = ibm_default_exact_shots()
        hardware_shots_source = "default_fallback"
        comparability_note = (
            f"No simulator shot count was configured, so IBM hardware uses the default {hardware_shots} shots "
            "for this comparison run."
        )

    payload = {
        "instance": instance,
        "backend_name": backend_name,
        "backend_selection": "manual" if backend_name else "auto",
        "fractional_gates_enabled": bool(use_fractional_gates),
        "fractional_mode_label": _fractional_mode_label(use_fractional_gates),
        "parallelized_construction_enabled": bool(parallelize_cost_terms),
        "construction_mode_label": _construction_mode_label(parallelize_cost_terms),
        "hardware_shots": hardware_shots,
        "hardware_shots_source": hardware_shots_source,
        "reference_mode": "exact" if exact_mode else "sampling",
        "qaoa_reference_shots": reference_shots,
        "qaoa_candidate_reference_rows": candidate_reference_rows,
        "comparability_note": comparability_note,
        "token_required": True,
    }
    return json_safe(payload)


def apply_ibm_runtime_settings(optimizer, export_mode_diagnostics: dict[str, Any] | None, settings: Mapping[str, Any]) -> None:
    safe_settings = json_safe(dict(settings or {}))
    if optimizer is not None:
        setattr(optimizer, "ibm_runtime_settings", safe_settings)
    if isinstance(export_mode_diagnostics, dict):
        export_mode_diagnostics.update(
            json_safe(
                {
                    "ibm_instance": safe_settings.get("instance"),
                    "ibm_backend": safe_settings.get("backend_name"),
                    "ibm_backend_selection": safe_settings.get("backend_selection"),
                    "ibm_fractional_gates": safe_settings.get("fractional_gates_enabled"),
                    "ibm_fractional_mode_label": safe_settings.get("fractional_mode_label"),
                    "ibm_parallelization": safe_settings.get("parallelized_construction_enabled"),
                    "ibm_construction_mode_label": safe_settings.get("construction_mode_label"),
                    "ibm_hardware_shots": safe_settings.get("hardware_shots"),
                    "ibm_hardware_shots_source": safe_settings.get("hardware_shots_source"),
                    "hardware_submission": "requested",
                    "comparability_note": safe_settings.get("comparability_note"),
                }
            )
        )


def persist_ibm_runtime_token(job_id: str, token: str) -> dict[str, Any]:
    clean_token = str(token or "").strip()
    if not clean_token:
        raise ApiError(400, "ibm_token_required", "IBM API token is required for hardware execution.")
    backend = _secret_backend()
    if backend == IBM_SECRET_LOCAL:
        secret_path = _local_secret_path(job_id)
        secret_path.parent.mkdir(parents=True, exist_ok=True)
        secret_path.write_text(clean_token, encoding="utf-8")
        return json_safe(
            {
                "backend": IBM_SECRET_LOCAL,
                "path": str(secret_path),
                "job_id": job_id,
            }
        )

    client = _secret_manager_client()
    parent = f"projects/{_cloud_project_for_secret_manager()}"
    secret_id = _secret_id_for_job(job_id)
    secret = client.create_secret(
        request={
            "parent": parent,
            "secret_id": secret_id,
            "secret": {"replication": {"automatic": {}}},
        }
    )
    version = client.add_secret_version(
        request={"parent": secret.name, "payload": {"data": clean_token.encode("utf-8")}}
    )
    return json_safe(
        {
            "backend": IBM_SECRET_MANAGER,
            "secret_name": secret.name,
            "version_name": version.name,
            "job_id": job_id,
        }
    )


def resolve_ibm_runtime_token(secret_ref: Mapping[str, Any]) -> str:
    backend = str((secret_ref or {}).get("backend") or "").strip().lower()
    if backend == IBM_SECRET_LOCAL:
        path = Path(str((secret_ref or {}).get("path") or ""))
        if not path.exists():
            raise ApiError(500, "ibm_token_missing", "IBM token could not be loaded for this job.")
        return path.read_text(encoding="utf-8").strip()

    if backend != IBM_SECRET_MANAGER:
        raise ApiError(500, "ibm_secret_backend_invalid", "IBM token reference is invalid.")

    version_name = str((secret_ref or {}).get("version_name") or "").strip()
    if not version_name:
        secret_name = str((secret_ref or {}).get("secret_name") or "").strip()
        if not secret_name:
            raise ApiError(500, "ibm_secret_reference_invalid", "IBM token reference is incomplete.")
        version_name = f"{secret_name}/versions/latest"
    client = _secret_manager_client()
    response = client.access_secret_version(request={"name": version_name})
    return response.payload.data.decode("utf-8").strip()


def delete_ibm_runtime_token(secret_ref: Mapping[str, Any] | None) -> None:
    if not isinstance(secret_ref, Mapping):
        return
    backend = str(secret_ref.get("backend") or "").strip().lower()
    if backend == IBM_SECRET_LOCAL:
        path = Path(str(secret_ref.get("path") or ""))
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass
        return
    if backend != IBM_SECRET_MANAGER:
        return
    secret_name = str(secret_ref.get("secret_name") or "").strip()
    if not secret_name:
        version_name = str(secret_ref.get("version_name") or "").strip()
        if "/versions/" in version_name:
            secret_name = version_name.split("/versions/", 1)[0]
    if not secret_name:
        return
    try:
        _secret_manager_client().delete_secret(request={"name": secret_name})
    except Exception:
        pass


def list_ibm_backends(token: str, *, instance: str = IBM_DEFAULT_INSTANCE) -> dict[str, Any]:
    service = _qiskit_runtime_service(token=token, instance=instance)
    backend_rows = _available_backend_rows(service)
    default_backend = _select_backend_row(backend_rows, backend_name=None, n_qubits=0)
    return json_safe(
        {
            "ok": True,
            "channel": IBM_RUNTIME_CHANNEL,
            "instance": instance,
            "backends": backend_rows,
            "default_backend": default_backend.get("name") if default_backend else None,
        }
    )


def preview_ibm_transpilation(
    optimizer,
    *,
    token: str,
    ibm_settings: Mapping[str, Any],
) -> dict[str, Any]:
    instance = str(ibm_settings.get("instance") or IBM_DEFAULT_INSTANCE)
    n_qubits = int(getattr(optimizer, "n", 0) or 0)
    selected_fractional = bool(ibm_settings.get("fractional_gates_enabled"))
    selected_parallelized = bool(ibm_settings.get("parallelized_construction_enabled"))
    service = _qiskit_runtime_service(token=token, instance=instance)
    backend_rows = _available_backend_rows(service)
    selected_backend_row = _select_backend_row(
        backend_rows,
        backend_name=ibm_settings.get("backend_name"),
        n_qubits=n_qubits,
    )
    if selected_backend_row is None:
        raise ApiError(
            422,
            "ibm_backend_unavailable",
            "No compatible IBM hardware backend is currently available for this circuit.",
            {"n_qubits": n_qubits},
        )

    backend_name = str(selected_backend_row.get("name") or "")
    previews: dict[str, Any] = {}
    mode_failures: dict[str, Any] = {}
    for parallelize_cost_terms in (False, True):
        for use_fractional_gates in (False, True):
            mode_key = _preview_mode_key(
                use_fractional_gates=use_fractional_gates,
                parallelize_cost_terms=parallelize_cost_terms,
            )
            try:
                backend = _get_backend(
                    service,
                    backend_name,
                    use_fractional_gates=use_fractional_gates,
                )
                circuit = build_qiskit_qaoa_circuit_from_optimizer(
                    optimizer,
                    measure=True,
                    name=f"qaoa_rqp_ibm_preview_{mode_key}",
                    use_fractional_gates=use_fractional_gates,
                    parallelize_cost_terms=parallelize_cost_terms,
                    allow_preview_placeholders=True,
                )
                transpiled_circuit = _transpile_for_backend(circuit, backend)
                post_metrics = _transpiled_circuit_metrics(transpiled_circuit)
                previews[mode_key] = json_safe(
                    {
                        "available": True,
                        "fractional_gates_enabled": use_fractional_gates,
                        "fractional_mode_label": _fractional_mode_label(use_fractional_gates),
                        "parallelized_construction_enabled": parallelize_cost_terms,
                        "construction_mode_label": _construction_mode_label(parallelize_cost_terms),
                        "pretranspile": qaoa_ibm_circuit_metadata(
                            optimizer,
                            use_fractional_gates=use_fractional_gates,
                            parallelize_cost_terms=parallelize_cost_terms,
                            allow_preview_placeholders=True,
                        ),
                        "posttranspile": post_metrics,
                        "warnings": list(_ibm_runtime_warnings(post_metrics)),
                    }
                )
            except Exception as exc:  # noqa: BLE001 - per-mode preview should not collapse overall preview
                mode_failures[mode_key] = json_safe(
                    {
                        "fractional_gates_enabled": bool(use_fractional_gates),
                        "fractional_mode_label": _fractional_mode_label(use_fractional_gates),
                        "parallelized_construction_enabled": bool(parallelize_cost_terms),
                        "construction_mode_label": _construction_mode_label(parallelize_cost_terms),
                        "error_type": type(exc).__name__,
                        "message": str(exc) or type(exc).__name__,
                    }
                )

    selected_key = _preview_mode_key(
        use_fractional_gates=selected_fractional,
        parallelize_cost_terms=selected_parallelized,
    )
    selected_preview = dict(previews.get(selected_key) or {})
    selected_failure = dict(mode_failures.get(selected_key) or {})
    comparison = _preview_comparison_payload(
        previews,
        selected_fractional=selected_fractional,
        selected_parallelized=selected_parallelized,
    )
    fallback_reason = None
    if not selected_preview:
        fallback_reason = (
            "Backend-aware preview unavailable for the selected IBM mode; showing logical circuit metrics only."
        )
    return json_safe(
        {
            "available": bool(selected_preview),
            "provider": IBM_RUNTIME_CHANNEL,
            "sdk": "qiskit",
            "instance": instance,
            "backend_name": backend_name,
            "backend_details": selected_backend_row,
            "fractional_gates_enabled": selected_fractional,
            "fractional_mode_label": _fractional_mode_label(selected_fractional),
            "parallelized_construction_enabled": selected_parallelized,
            "construction_mode_label": _construction_mode_label(selected_parallelized),
            "selected_mode": selected_key,
            "selected_preview": selected_preview,
            "selected_failure": selected_failure or None,
            "previews": previews,
            "mode_failures": mode_failures,
            "comparison": comparison,
            "fallback_reason": fallback_reason,
            "depth_reference": ibm_hardware_depth_reference(),
        }
    )


def ibm_wait_timeout_for_usage_context(usage_context) -> int:
    level_id = _int_or_none(getattr(getattr(usage_context, "usage_level", {}), "get", lambda *_args: None)("level_id"))
    if level_id is None:
        level_id = _int_or_none((getattr(usage_context, "usage_level", {}) or {}).get("level_id"))
    if level_id is None:
        level_id = 0
    return IBM_TESTER_TIMEOUT_SEC if int(level_id) <= 2 else IBM_STANDARD_TIMEOUT_SEC


def run_ibm_second_opinion(
    optimizer,
    *,
    token: str,
    usage_context,
    ibm_settings: Mapping[str, Any],
    progress_callback: Callable[..., None] | None = None,
) -> dict[str, Any]:
    instance = str(ibm_settings.get("instance") or IBM_DEFAULT_INSTANCE)
    shots = max(1, int(ibm_settings.get("hardware_shots") or ibm_default_exact_shots()))
    use_fractional_gates = bool(ibm_settings.get("fractional_gates_enabled"))
    parallelize_cost_terms = bool(ibm_settings.get("parallelized_construction_enabled"))
    pre_metadata = qaoa_ibm_circuit_metadata(
        optimizer,
        use_fractional_gates=use_fractional_gates,
        parallelize_cost_terms=parallelize_cost_terms,
    )
    n_qubits = int(getattr(optimizer, "n", 0) or 0)
    qiskit_version = _package_version("qiskit")
    qiskit_ibm_runtime_version = _package_version("qiskit-ibm-runtime")
    selected_backend_row: dict[str, Any] | None = None
    backend_name: str | None = None
    submitted_at: dt.datetime | None = None
    completed_at: dt.datetime | None = None
    timings: dict[str, Any] | None = None
    post_metrics: dict[str, Any] = {}
    warnings: list[str] = []
    result_snapshot: dict[str, Any] | None = None
    job_id: str | None = None
    hardware_submission = "requested"

    base_payload = {
        "available": False,
        "enabled": True,
        "label": "Quantum (2nd opinion) - IBM Hardware",
        "source": "ibm_hardware",
        "provider": IBM_RUNTIME_CHANNEL,
        "sdk": "qiskit",
        "dry_run": False,
        "simulation": False,
        "hardware_submission": hardware_submission,
        "parse_status": "pending",
        "instance": instance,
        "backend_name": None,
        "backend_selection": ibm_settings.get("backend_selection"),
        "fractional_gates_enabled": use_fractional_gates,
        "fractional_mode_label": _fractional_mode_label(use_fractional_gates),
        "parallelized_construction_enabled": parallelize_cost_terms,
        "construction_mode_label": _construction_mode_label(parallelize_cost_terms),
        "backend_details": None,
        "job_id": None,
        "shots": shots,
        "shots_source": ibm_settings.get("hardware_shots_source"),
        "comparability_note": ibm_settings.get("comparability_note"),
        "submitted_at": None,
        "completed_at": None,
        "timing": None,
        "counts": {},
        "counts_qiskit": {},
        "probabilities": {},
        "measured_bitstrings_by_hits": [],
        "warnings": [],
        "pretranspile": pre_metadata,
        "posttranspile": {},
        "result_snapshot": None,
        "qiskit_version": qiskit_version,
        "qiskit_ibm_runtime_version": qiskit_ibm_runtime_version,
        "depth_reference": ibm_hardware_depth_reference(),
    }

    if ibm_settings.get("comparability_note"):
        _progress(
            progress_callback,
            str(ibm_settings.get("comparability_note")),
            phase="ibm_submitted",
            progress_pct=91.5,
        )

    try:
        service = _qiskit_runtime_service(token=token, instance=instance)
        backend_rows = _available_backend_rows(service)
        selected_backend_row = _select_backend_row(
            backend_rows,
            backend_name=ibm_settings.get("backend_name"),
            n_qubits=n_qubits,
        )
        if selected_backend_row is None:
            raise ApiError(
                422,
                "ibm_backend_unavailable",
                "No compatible IBM hardware backend is currently available for this circuit.",
                {"n_qubits": n_qubits},
            )

        backend_name = str(selected_backend_row.get("name"))
        base_payload["backend_name"] = backend_name
        base_payload["backend_details"] = selected_backend_row
        _progress(progress_callback, f"IBM backend selected: {backend_name}.", phase="ibm_backend_discovery", progress_pct=92.0)
        backend = _get_backend(service, backend_name, use_fractional_gates=use_fractional_gates)
        circuit = build_qiskit_qaoa_circuit_from_optimizer(
            optimizer,
            measure=True,
            name="qaoa_rqp_ibm_hardware",
            use_fractional_gates=use_fractional_gates,
            parallelize_cost_terms=parallelize_cost_terms,
        )

        _progress(progress_callback, "Transpiling Qiskit circuit for IBM hardware.", phase="ibm_transpile", progress_pct=93.0)
        transpiled_circuit = _transpile_for_backend(circuit, backend)
        post_metrics = _transpiled_circuit_metrics(transpiled_circuit)
        warnings = list(_ibm_runtime_warnings(post_metrics))
        base_payload["posttranspile"] = post_metrics
        base_payload["warnings"] = warnings
        for warning in warnings:
            _progress(progress_callback, warning, phase="ibm_transpile", progress_pct=93.5)

        _progress(progress_callback, f"Submitting IBM hardware job to {backend_name} ({shots} shots).", phase="ibm_submitted", progress_pct=94.0)
        sampler_cls = _sampler_v2_class()
        sampler = sampler_cls(mode=backend)
        submitted_at = dt.datetime.now(dt.timezone.utc)
        job = sampler.run([transpiled_circuit], shots=shots)
        job_id = _job_id(job)
        hardware_submission = "submitted"
        base_payload["hardware_submission"] = hardware_submission
        base_payload["job_id"] = job_id
        base_payload["submitted_at"] = submitted_at.isoformat().replace("+00:00", "Z")
        _progress(
            progress_callback,
            f"IBM hardware submitted on {backend_name}: job {job_id} ({shots} shots).",
            phase="ibm_submitted",
            progress_pct=94.5,
        )

        timings = _await_ibm_job(
            job,
            progress_callback=progress_callback,
            timeout_sec=ibm_wait_timeout_for_usage_context(usage_context),
        )
        result = job.result()
        completed_at = dt.datetime.now(dt.timezone.utc)
        hardware_submission = "completed"
        base_payload["hardware_submission"] = hardware_submission
        base_payload["timing"] = timings
        base_payload["completed_at"] = completed_at.isoformat().replace("+00:00", "Z")
        result_snapshot = _result_shape_snapshot(result, n_qubits=n_qubits)
        base_payload["result_snapshot"] = result_snapshot

        counts_raw = _sampler_counts(result, shots=shots, n_qubits=n_qubits)
        counts_optimizer = _counts_in_optimizer_order(counts_raw, n_qubits)
        probabilities = qiskit_counts_to_optimizer_probabilities(counts_raw, n_qubits)
        measured_bitstrings = [
            bitstring
            for bitstring, _count in sorted(counts_optimizer.items(), key=lambda item: (-item[1], item[0]))
        ]

        base_payload.update(
            {
                "available": bool(probabilities),
                "parse_status": "ok",
                "counts": counts_optimizer,
                "counts_qiskit": counts_raw,
                "probabilities": probabilities,
                "measured_bitstrings_by_hits": measured_bitstrings,
            }
        )
        return json_safe(base_payload)
    except Exception as exc:  # noqa: BLE001 - hardware 2nd opinion should not fail the primary result
        if result_snapshot is None:
            result_snapshot = _exception_snapshot(exc)
        base_payload["result_snapshot"] = result_snapshot
        base_payload["warnings"] = list(warnings)
        base_payload["posttranspile"] = post_metrics
        if job_id is not None:
            base_payload["job_id"] = job_id
        if backend_name is not None:
            base_payload["backend_name"] = backend_name
        if selected_backend_row is not None:
            base_payload["backend_details"] = selected_backend_row
        if submitted_at is not None:
            base_payload["submitted_at"] = submitted_at.isoformat().replace("+00:00", "Z")
        if completed_at is not None:
            base_payload["completed_at"] = completed_at.isoformat().replace("+00:00", "Z")
        if timings is not None:
            base_payload["timing"] = timings
        base_payload["hardware_submission"] = hardware_submission
        base_payload["parse_status"] = "failed"
        base_payload["reason"] = _ibm_error_reason(exc)
        base_payload["error"] = _ibm_error_payload(exc)
        return json_safe(base_payload)


def _progress(
    callback: Callable[..., None] | None,
    message: str,
    *,
    phase: str,
    progress_pct: float,
) -> None:
    if callback is None:
        return
    callback(str(message), phase=phase, progress_pct=float(progress_pct))


def _await_ibm_job(job, *, progress_callback: Callable[..., None] | None, timeout_sec: int) -> dict[str, Any]:
    poll_interval = 5.0
    start = time.perf_counter()
    queued_at = start
    running_at: float | None = None
    completed_at: float | None = None
    previous_status = ""
    while True:
        status = _job_status_name(job)
        if status != previous_status:
            previous_status = status
            phase, message, progress_pct = _status_progress(status)
            _progress(progress_callback, message, phase=phase, progress_pct=progress_pct)
            if status == "running" and running_at is None:
                running_at = time.perf_counter()
        if status in {"done", "completed"}:
            completed_at = time.perf_counter()
            break
        if status in {"error", "failed", "cancelled", "canceled"}:
            raise ApiError(
                502,
                "ibm_hardware_job_failed",
                f"IBM hardware job ended with status {status}.",
                {"ibm_job_status": status},
            )
        elapsed = time.perf_counter() - start
        if elapsed > float(timeout_sec):
            raise ApiError(
                504,
                "ibm_hardware_timeout",
                "IBM hardware execution did not complete within the allowed wait time.",
                {"timeout_sec": int(timeout_sec), "ibm_job_status": status},
            )
        time.sleep(poll_interval)

    total_seconds = float((completed_at or time.perf_counter()) - start)
    queue_seconds = None
    execution_seconds = None
    if running_at is not None:
        queue_seconds = float(max(0.0, running_at - queued_at))
        execution_seconds = float(max(0.0, (completed_at or time.perf_counter()) - running_at))

    return json_safe(
        {
            "queue_wait_seconds": queue_seconds,
            "execution_seconds": execution_seconds,
            "total_seconds": total_seconds,
            "timeout_sec": int(timeout_sec),
        }
    )


def _status_progress(status: str) -> tuple[str, str, float]:
    normalized = status.strip().lower()
    if normalized in {"queued", "pending", "initializing"}:
        return "ibm_queued", "IBM hardware job queued.", 95.0
    if normalized in {"running", "in_progress"}:
        return "ibm_running", "IBM hardware job running.", 96.0
    if normalized in {"done", "completed"}:
        return "ibm_completed", "IBM hardware job completed.", 97.0
    return "ibm_submitted", f"IBM hardware job status: {normalized}.", 95.0


def _ibm_runtime_warnings(post_metrics: Mapping[str, Any]) -> Iterable[str]:
    two_qubit_depth = _int_or_none(post_metrics.get("sequential_2q_depth"))
    two_qubit_gates = _int_or_none(post_metrics.get("two_qubit_gates"))
    if two_qubit_depth is not None and two_qubit_depth > IBM_HERON2_CRITICAL_2Q_DEPTH:
        yield (
            "This transpiled circuit is beyond the Heron r2 comfort zone for sequential two-qubit depth. "
            "Results may be strongly affected by noise."
        )
        return
    if two_qubit_depth is not None and two_qubit_depth >= IBM_HERON2_OK_2Q_DEPTH:
        yield (
            "This transpiled circuit is in the critical Heron r2 range for sequential two-qubit depth. "
            "Results may be meaningfully affected by noise."
        )
        return
    if two_qubit_gates is not None and two_qubit_gates >= IBM_HERON2_CRITICAL_2Q_DEPTH * 4:
        yield (
            "This transpiled circuit uses many two-qubit gates for current quantum hardware. "
            "Results may be strongly affected by noise."
        )


def _counts_in_optimizer_order(counts: Mapping[str, int | float], n_qubits: int) -> dict[str, int]:
    normalized: dict[str, int] = {}
    for key, value in dict(counts or {}).items():
        bitstring = optimizer_bitstring_from_qiskit_key(str(key), n_qubits)
        normalized[bitstring] = normalized.get(bitstring, 0) + int(round(float(value)))
    return dict(sorted(normalized.items(), key=lambda item: item[0]))


def _ibm_reference_mode_is_exact(
    *,
    runtime_inputs=None,
    effective_settings: Mapping[str, Any] | None = None,
) -> bool:
    shots_mode = str((effective_settings or {}).get("shots_mode") or "").strip().lower()
    if shots_mode == "exact":
        return True
    qaoa_shots_display = str((effective_settings or {}).get("qaoa_shots_display") or "").strip().lower()
    if qaoa_shots_display == "exact":
        return True
    if runtime_inputs is not None and _int_or_none(getattr(runtime_inputs, "qaoa_shots", None)) is None:
        run_mode = str(getattr(runtime_inputs, "run_mode", "") or "").strip().lower()
        if run_mode == "exact_probs":
            return True
    return False


def _sampler_counts(result, *, shots: int, n_qubits: int) -> dict[str, int]:
    for item in _iter_sampler_items(result):
        counts = _counts_from_sampler_item(item, shots=shots, n_qubits=n_qubits)
        if counts:
            return counts

    raise ApiError(502, "ibm_counts_unavailable", "IBM hardware results did not include readable counts.")


def _counts_from_quasi_distribution(quasi, *, shots: int) -> dict[str, int]:
    counts: dict[str, int] = {}
    items = quasi.items() if hasattr(quasi, "items") else []
    for key, value in items:
        probability = float(value)
        if probability <= 0.0:
            continue
        if isinstance(key, int):
            bitstring = format(int(key), "b")
        else:
            bitstring = str(key)
        counts[bitstring] = int(round(probability * float(shots)))
    return counts


def _iter_sampler_items(result) -> list[Any]:
    if isinstance(result, (list, tuple)):
        return list(result)
    if isinstance(result, Mapping):
        return [result]
    try:
        items = list(result)
        if items:
            return items
    except Exception:
        pass
    return [result]


def _counts_from_sampler_item(item, *, shots: int, n_qubits: int) -> dict[str, int] | None:
    direct = _counts_from_generic_mapping(item, n_qubits=n_qubits)
    if direct:
        return direct

    data = getattr(item, "data", None)
    if data is not None:
        for _name, register in _iter_data_registers(data):
            counts = _counts_from_register(register, shots=shots, n_qubits=n_qubits)
            if counts:
                return counts

    if hasattr(item, "quasi_dists"):
        quasi_dists = getattr(item, "quasi_dists")
        if quasi_dists:
            quasi = quasi_dists[0] if isinstance(quasi_dists, list) else quasi_dists
            return _counts_from_quasi_distribution(quasi, shots=shots)

    if hasattr(item, "get_counts"):
        try:
            counts = item.get_counts()
        except Exception:
            counts = None
        if counts:
            return _counts_from_generic_mapping(counts, n_qubits=n_qubits)

    return None


def _iter_data_registers(data) -> list[tuple[str, Any]]:
    names: list[str] = []
    for preferred in ("meas", "c", "bits"):
        if hasattr(data, preferred):
            names.append(preferred)

    if isinstance(data, Mapping):
        for name in data.keys():
            text = str(name)
            if text not in names:
                names.append(text)

    data_dict = getattr(data, "__dict__", None)
    if isinstance(data_dict, dict):
        for name in data_dict.keys():
            text = str(name)
            if not text.startswith("_") and text not in names:
                names.append(text)

    for name in dir(data):
        if name.startswith("_") or name in names:
            continue
        try:
            value = getattr(data, name)
        except Exception:
            continue
        if callable(value):
            continue
        names.append(name)

    registers: list[tuple[str, Any]] = []
    for name in names:
        try:
            registers.append((name, getattr(data, name)))
        except Exception:
            continue
    return registers


def _counts_from_register(register, *, shots: int, n_qubits: int) -> dict[str, int] | None:
    if register is None:
        return None

    getter = getattr(register, "get_counts", None)
    if callable(getter):
        try:
            counts = getter()
        except Exception:
            counts = None
        if counts:
            return _counts_from_generic_mapping(counts, n_qubits=n_qubits)

    getter = getattr(register, "get_int_counts", None)
    if callable(getter):
        try:
            int_counts = getter()
        except Exception:
            int_counts = None
        if int_counts:
            return _counts_from_int_mapping(int_counts, n_qubits=n_qubits)

    getter = getattr(register, "get_bitstrings", None)
    if callable(getter):
        try:
            bitstrings = getter()
        except Exception:
            bitstrings = None
        if bitstrings:
            return _counts_from_bitstring_samples(bitstrings)

    if isinstance(register, Mapping):
        counts = _counts_from_generic_mapping(register, n_qubits=n_qubits)
        if counts:
            return counts

    if hasattr(register, "items"):
        try:
            counts = _counts_from_generic_mapping(dict(register.items()), n_qubits=n_qubits)
        except Exception:
            counts = None
        if counts:
            return counts

    return None


def _counts_from_generic_mapping(value, *, n_qubits: int) -> dict[str, int] | None:
    if not value:
        return None
    try:
        items = dict(value).items()
    except Exception:
        return None

    first_key = next(iter(dict(value).keys()), None)
    if isinstance(first_key, int):
        return _counts_from_int_mapping(value, n_qubits=n_qubits)
    return {str(key): int(value) for key, value in items}


def _counts_from_int_mapping(value, *, n_qubits: int) -> dict[str, int] | None:
    try:
        items = dict(value).items()
    except Exception:
        return None
    counts: dict[str, int] = {}
    width = max(int(n_qubits or 0), 1)
    for key, count in items:
        bitstring = format(int(key), f"0{width}b")
        counts[bitstring] = int(count)
    return counts or None


def _counts_from_bitstring_samples(bitstrings) -> dict[str, int] | None:
    counts: dict[str, int] = {}
    try:
        values = list(bitstrings)
    except Exception:
        return None
    for bitstring in values:
        text = str(bitstring)
        counts[text] = counts.get(text, 0) + 1
    return counts or None


def _ibm_error_reason(exc: Exception) -> str:
    if isinstance(exc, ApiError):
        return exc.message
    return f"{type(exc).__name__}: {exc}"


def _ibm_error_payload(exc: Exception) -> dict[str, Any]:
    payload = {
        "type": type(exc).__name__,
        "message": _ibm_error_reason(exc),
    }
    if isinstance(exc, ApiError):
        payload["code"] = exc.code
        payload["status_code"] = exc.status_code
        payload["details"] = json_safe(exc.details)
    return json_safe(payload)


def _result_shape_snapshot(result, *, n_qubits: int) -> dict[str, Any]:
    items = _iter_sampler_items(result)
    snapshot_items = [_snapshot_item_shape(item, n_qubits=n_qubits) for item in items[:3]]
    return json_safe(
        {
            "result_type": type(result).__name__,
            "item_count": len(items),
            "items": snapshot_items,
        }
    )


def _snapshot_item_shape(item, *, n_qubits: int) -> dict[str, Any]:
    data = getattr(item, "data", None)
    snapshot = {
        "item_type": type(item).__name__,
        "has_data": data is not None,
        "has_quasi_dists": bool(getattr(item, "quasi_dists", None)),
        "mapping_keys": list(dict(item).keys())[:5] if isinstance(item, Mapping) else [],
    }
    if data is not None:
        registers = []
        for name, register in _iter_data_registers(data)[:8]:
            registers.append(
                {
                    "name": name,
                    "type": type(register).__name__,
                    "has_get_counts": callable(getattr(register, "get_counts", None)),
                    "has_get_int_counts": callable(getattr(register, "get_int_counts", None)),
                    "has_get_bitstrings": callable(getattr(register, "get_bitstrings", None)),
                    "is_mapping": isinstance(register, Mapping),
                    "num_bits": _int_or_none(getattr(register, "num_bits", None)),
                    "num_shots": _int_or_none(getattr(register, "num_shots", None)),
                    "shape": json_safe(getattr(register, "shape", None)),
                }
            )
        snapshot["data_type"] = type(data).__name__
        snapshot["registers"] = registers
    return json_safe(snapshot)


def _exception_snapshot(exc: Exception) -> dict[str, Any]:
    return json_safe(
        {
            "exception_type": type(exc).__name__,
            "message": _ibm_error_reason(exc),
        }
    )


def _transpiled_circuit_metrics(circuit) -> dict[str, Any]:
    counts = _count_ops_dict(circuit)
    two_qubit_gates = sum(
        1 for instruction in getattr(circuit, "data", []) if _operation_qubits(instruction) == 2
    )
    total_gates = int(sum(int(value) for value in counts.values()))
    return json_safe(
        {
            "depth": int(circuit.depth()) if hasattr(circuit, "depth") else None,
            "size": int(circuit.size()) if hasattr(circuit, "size") else None,
            "gate_counts": counts,
            "total_gates": total_gates,
            "two_qubit_gates": int(two_qubit_gates),
            "sequential_2q_depth": _two_qubit_depth(circuit),
        }
    )


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


def _count_ops_dict(circuit) -> dict[str, int]:
    try:
        return {str(name): int(count) for name, count in circuit.count_ops().items()}
    except Exception:
        return {}


def _transpile_for_backend(circuit, backend):
    generator = _preset_pass_manager_generator()
    pass_manager = generator(backend=backend, optimization_level=1)
    return pass_manager.run(circuit)


def _get_backend(service, backend_name: str, *, use_fractional_gates: bool = False):
    getter = getattr(service, "backend", None)
    if callable(getter):
        try:
            return getter(str(backend_name), use_fractional_gates=bool(use_fractional_gates))
        except TypeError:
            return getter(str(backend_name))
    rows = _available_backend_rows(service, include_backend_object=True)
    for row in rows:
        if row.get("name") == backend_name:
            backend_obj = row.get("_backend_obj")
            if backend_obj is not None:
                return backend_obj
    raise ApiError(404, "ibm_backend_not_found", "Requested IBM backend was not found.", {"backend": backend_name})


def _available_backend_rows(service, *, include_backend_object: bool = False) -> list[dict[str, Any]]:
    candidates = []
    backends = _service_backends(service)
    for backend in backends:
        row = _backend_row(backend)
        if not row.get("operational", True):
            continue
        if row.get("simulator"):
            continue
        if include_backend_object:
            row["_backend_obj"] = backend
        candidates.append(row)
    candidates.sort(key=lambda row: (int(row.get("pending_jobs") or 0), -int(row.get("num_qubits") or 0), str(row.get("name") or "")))
    return candidates


def _service_backends(service):
    for kwargs in (
        {"simulator": False, "operational": True},
        {"simulator": False},
        {},
    ):
        try:
            return list(service.backends(**kwargs))
        except TypeError:
            continue
    return list(service.backends())


def _backend_row(backend) -> dict[str, Any]:
    status = None
    try:
        status = backend.status()
    except Exception:
        status = None
    configuration = None
    try:
        configuration = backend.configuration()
    except Exception:
        configuration = None
    name = getattr(backend, "name", None)
    if callable(name):
        name = name()
    num_qubits = (
        _int_or_none(getattr(backend, "num_qubits", None))
        or _int_or_none(getattr(configuration, "n_qubits", None))
        or 0
    )
    simulator = bool(getattr(backend, "simulator", False) or getattr(configuration, "simulator", False))
    operational = True if status is None else bool(getattr(status, "operational", True))
    pending_jobs = _int_or_none(getattr(status, "pending_jobs", None)) or 0
    return json_safe(
        {
            "name": str(name or ""),
            "num_qubits": int(num_qubits),
            "pending_jobs": int(pending_jobs),
            "operational": operational,
            "simulator": simulator,
        }
    )


def _select_backend_row(
    backend_rows: list[dict[str, Any]],
    *,
    backend_name: str | None,
    n_qubits: int,
) -> dict[str, Any] | None:
    required_qubits = max(0, int(n_qubits or 0))
    normalized_name = str(backend_name or "").strip()
    compatible_rows = [row for row in backend_rows if int(row.get("num_qubits") or 0) >= required_qubits]
    if normalized_name:
        for row in compatible_rows:
            if str(row.get("name") or "") == normalized_name:
                return row
        raise ApiError(
            404,
            "ibm_backend_not_found",
            "The selected IBM backend is not available for this session.",
            {"backend": normalized_name, "required_qubits": required_qubits},
        )
    return compatible_rows[0] if compatible_rows else None


def _qiskit_runtime_service(*, token: str, instance: str):
    service_cls = _runtime_service_class()
    return service_cls(channel=IBM_RUNTIME_CHANNEL, token=str(token).strip(), instance=str(instance).strip() or IBM_DEFAULT_INSTANCE)


def _runtime_service_class():
    try:
        from qiskit_ibm_runtime import QiskitRuntimeService
    except Exception as exc:  # noqa: BLE001 - optional dependency in some local envs
        raise ApiError(
            500,
            "ibm_runtime_dependency_missing",
            "IBM hardware execution requires qiskit-ibm-runtime on the backend.",
            {"reason": type(exc).__name__},
        ) from exc
    return QiskitRuntimeService


def _sampler_v2_class():
    try:
        from qiskit_ibm_runtime import SamplerV2
    except Exception as exc:  # noqa: BLE001 - optional dependency in some local envs
        raise ApiError(
            500,
            "ibm_runtime_dependency_missing",
            "IBM hardware execution requires qiskit-ibm-runtime on the backend.",
            {"reason": type(exc).__name__},
        ) from exc
    return SamplerV2


def _preset_pass_manager_generator():
    try:
        from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
    except Exception as exc:  # noqa: BLE001 - optional dependency in some local envs
        raise ApiError(
            500,
            "qiskit_transpile_dependency_missing",
            "IBM hardware execution requires Qiskit transpilation support on the backend.",
            {"reason": type(exc).__name__},
        ) from exc
    return generate_preset_pass_manager


def _job_id(job) -> str | None:
    getter = getattr(job, "job_id", None)
    if callable(getter):
        try:
            return str(getter())
        except Exception:
            return None
    if getter is not None:
        return str(getter)
    return None


def _job_status_name(job) -> str:
    status_getter = getattr(job, "status", None)
    if not callable(status_getter):
        return "unknown"
    try:
        status = status_getter()
    except Exception:
        return "unknown"
    text = str(status or "").strip().lower()
    if "." in text:
        text = text.rsplit(".", 1)[-1]
    return text or "unknown"


def _package_version(package_name: str) -> str | None:
    try:
        return str(metadata.version(package_name))
    except metadata.PackageNotFoundError:
        return None


def _cloud_project_for_secret_manager() -> str:
    project = str(Config.CLOUD_RUN_PROJECT or "").strip()
    if project:
        return project
    raise ApiError(
        500,
        "cloud_project_missing",
        "CLOUD_RUN_PROJECT or GOOGLE_CLOUD_PROJECT must be set for IBM token storage.",
    )


def _secret_backend() -> str:
    configured = str(os.getenv(IBM_SECRET_ENV_KEY, "")).strip().lower()
    if configured in {IBM_SECRET_LOCAL, IBM_SECRET_MANAGER}:
        return configured
    if os.getenv("QAOA_RQP_LOCAL_DEV") == "1":
        return IBM_SECRET_LOCAL
    return IBM_SECRET_MANAGER


def _secret_manager_client():
    try:
        from google.cloud import secretmanager
    except Exception as exc:  # noqa: BLE001 - optional dependency in some local envs
        raise ApiError(
            500,
            "secret_manager_dependency_missing",
            "IBM hardware token storage requires google-cloud-secret-manager on the backend.",
            {"reason": type(exc).__name__},
        ) from exc
    return secretmanager.SecretManagerServiceClient()


def _secret_id_for_job(job_id: str) -> str:
    normalized = "".join(char if char.isalnum() or char == "-" else "-" for char in str(job_id).lower())
    return f"qaoa-rqp-ibm-{normalized[:48]}".strip("-")


def _local_secret_path(job_id: str) -> Path:
    return Path(Config.LOCAL_JOB_DIR) / "_ibm_runtime_secrets" / f"{job_id}.token"


def ibm_hardware_depth_reference() -> dict[str, int]:
    return json_safe(
        {
            "ok_max_sequential_2q_depth": int(IBM_HERON2_OK_2Q_DEPTH),
            "critical_max_sequential_2q_depth": int(IBM_HERON2_CRITICAL_2Q_DEPTH),
        }
    )


def _preview_mode_key(*, use_fractional_gates: bool, parallelize_cost_terms: bool) -> str:
    construction_key = "parallelized" if parallelize_cost_terms else "current"
    gate_key = "fractional" if use_fractional_gates else "standard"
    return f"{construction_key}_{gate_key}"


def _preview_metric_comparison(
    left_preview: Mapping[str, Any],
    right_preview: Mapping[str, Any],
    *,
    left_label: str,
    right_label: str,
) -> dict[str, Any]:
    left_post = dict((left_preview or {}).get("posttranspile") or {})
    right_post = dict((right_preview or {}).get("posttranspile") or {})
    metrics: dict[str, Any] = {}
    for key in ("depth", "total_gates", "two_qubit_gates", "sequential_2q_depth"):
        left_value = _int_or_none(left_post.get(key))
        right_value = _int_or_none(right_post.get(key))
        if left_value is None or right_value is None:
            continue
        delta = int(right_value - left_value)
        pct = None
        if left_value > 0:
            pct = float(delta) / float(left_value)
        metrics[key] = {
            left_label: int(left_value),
            right_label: int(right_value),
            "delta": int(delta),
            "pct_delta": pct,
        }
    return json_safe(metrics)


def _preview_comparison_payload(
    previews: Mapping[str, Any],
    *,
    selected_fractional: bool,
    selected_parallelized: bool,
) -> dict[str, Any]:
    fractional_gate_mode = _preview_metric_comparison(
        dict((previews or {}).get(_preview_mode_key(use_fractional_gates=False, parallelize_cost_terms=selected_parallelized)) or {}),
        dict((previews or {}).get(_preview_mode_key(use_fractional_gates=True, parallelize_cost_terms=selected_parallelized)) or {}),
        left_label="standard",
        right_label="fractional",
    )
    construction_mode = _preview_metric_comparison(
        dict((previews or {}).get(_preview_mode_key(use_fractional_gates=selected_fractional, parallelize_cost_terms=False)) or {}),
        dict((previews or {}).get(_preview_mode_key(use_fractional_gates=selected_fractional, parallelize_cost_terms=True)) or {}),
        left_label="current",
        right_label="parallelized",
    )
    payload = dict(fractional_gate_mode)
    payload["fractional_gate_mode"] = fractional_gate_mode
    payload["construction_mode"] = construction_mode
    return json_safe(payload)


def _form_value(form_data, key: str, default: str = "") -> str:
    value = None
    if hasattr(form_data, "get"):
        value = form_data.get(key, default)
    elif isinstance(form_data, Mapping):
        value = form_data.get(key, default)
    if value is None:
        return str(default)
    return str(value)


def _form_bool(form_data, key: str, default: bool = False) -> bool:
    raw = _form_value(form_data, key, "1" if default else "0").strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off", ""}:
        return False
    return bool(default)


def _ibm_candidate_reference_rows(
    *,
    optimizer=None,
    effective_settings: Mapping[str, Any] | None = None,
) -> int | None:
    requested = _int_or_none(getattr(optimizer, "qaoa_export_requested_rows", None))
    if requested is not None and requested > 0:
        return int(requested)
    configured = _int_or_none(getattr(optimizer, "qaoa_max_export_rows", None))
    if configured is not None and configured > 0:
        return int(configured)
    if effective_settings:
        for key in (
            "qaoa_export_requested_rows",
            "qaoa_export_effective_max_rows",
            "qaoa_max_export_rows",
        ):
            value = _int_or_none(effective_settings.get(key))
            if value is not None and value > 0:
                return int(value)
    return None


def _int_or_none(value: Any) -> int | None:
    if value in (None, "", False):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def ibm_default_exact_shots() -> int:
    raw = os.getenv("QAOA_IBM_DEFAULT_EXACT_SHOTS", str(IBM_DEFAULT_EXACT_SHOTS))
    try:
        return max(1, int(float(raw)))
    except (TypeError, ValueError):
        return IBM_DEFAULT_EXACT_SHOTS
