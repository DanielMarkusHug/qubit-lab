"""Flask entry point for the Version 9 QAOA RQP API."""

from __future__ import annotations

import logging
import os
import time

from flask import Flask, Response, jsonify, request
from werkzeug.exceptions import HTTPException

try:
    from flask_cors import CORS
except ImportError:  # pragma: no cover - optional local-dev dependency
    def CORS(*_args, **_kwargs):
        return None

from app.classical_solver import run_classical_optimizer
from app.cloud_run_jobs import trigger_cloud_run_job
from app.code_exports import code_export_targets_payload, extract_code_export_package, render_code_export
from app.config import Config
from app.excel_io import (
    cleanup_temp_file,
    save_upload_to_temp,
    validate_required_input_sheets,
    workbook_structure,
)
from app.job_storage import get_job_storage
from app.job_store import get_job_store, initial_job_document
from app.key_store import get_key_store
from app.license_service import require_api_key
from app.qaoa_engine import QAOAExecutionError, run_qaoa_sim
from app.qubo_builder import build_qubo_from_workbook, load_legacy_optimizer_symbols
from app.random_seed import random_seed_display
from app.result_writer import build_classical_response, build_inspection_response
from app.run_ledger import get_run_ledger
from app.schemas import ApiError, json_safe, make_job_id, make_run_id
from app.type_constraints import constraints_for_json
from app.usage_policy import (
    DEFAULT_RESPONSE_LEVEL,
    QAOA_MODES,
    build_effective_settings,
    capabilities_payload,
    extract_runtime_inputs,
    generate_key_hash,
    mode_diagnostics,
    mode_limits_for,
    resolve_run_mode,
    resolve_usage_context,
    simulation_backend_for_mode,
    usage_context_from_key_record,
    validate_secret_configuration,
    validate_pre_upload_policy,
    validate_problem_policy,
)
from app.workbook_diagnostics import (
    append_workbook_warning_logs,
    candidate_export_log_lines,
    workbook_warnings,
    workbook_warning_log_lines,
)
from app.worker_profiles import (
    DEFAULT_WORKER_PROFILE,
    normalize_worker_profile,
    validate_worker_profile_allowed,
    worker_profile_metadata,
)


logger = logging.getLogger(__name__)


def create_app() -> Flask:
    validate_secret_configuration()
    flask_app = Flask(__name__)

    CORS(
        flask_app,
        resources={
            r"/*": {
                "origins": [
                    "https://qubit-lab.ch",
                    "https://www.qubit-lab.ch",
                ],
                "allow_headers": [
                    "Content-Type",
                    "X-API-Key",
                ],
                "methods": [
                    "GET",
                    "POST",
                    "OPTIONS",
                ],
                "expose_headers": [
                    "Content-Disposition",
                ],
            }
        },
    )

    flask_app.config["MAX_CONTENT_LENGTH"] = Config.MAX_CONTENT_LENGTH
    flask_app.config["JSON_SORT_KEYS"] = False

    register_routes(flask_app)
    register_error_handlers(flask_app)
    return flask_app


def register_routes(flask_app: Flask) -> None:
    @flask_app.get("/")
    def index():
        return jsonify(
            {
                "service": Config.SERVICE_NAME,
                "status": "alive",
                "version": Config.VERSION,
            }
        )

    @flask_app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    @flask_app.get("/capabilities")
    def capabilities():
        return jsonify(capabilities_payload())

    @flask_app.get("/exports/code-targets")
    def code_export_targets():
        return jsonify({"targets": code_export_targets_payload()})

    @flask_app.post("/exports/code")
    def code_export():
        usage_context = resolve_usage_context(request.headers.get(Config.API_KEY_HEADER))
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            raise ApiError(400, "invalid_json_payload", "A JSON object payload is required.")
        target = str(payload.get("target") or "")
        package = extract_code_export_package(payload)
        rendered = render_code_export(package, target, usage_context=usage_context)
        return Response(
            rendered.content,
            content_type=rendered.content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{rendered.filename}"',
                "X-QAOA-RQP-Code-Export-Target": target,
            },
        )

    @flask_app.get("/license-status")
    def license_status():
        usage_context = resolve_usage_context(request.headers.get(Config.API_KEY_HEADER))
        ledger = get_run_ledger()
        return jsonify(ledger.license_status(usage_context))

    if os.getenv("QAOA_RQP_LOCAL_DEV") == "1":
        @flask_app.get("/ledger-summary")
        def ledger_summary():
            if os.getenv("QAOA_RQP_LOCAL_DEV") != "1":
                raise ApiError(
                    403,
                    "ledger_summary_disabled",
                    "Ledger summary is available only in local development mode.",
                )
            return jsonify(get_run_ledger().summary())

    @flask_app.post("/demo-run")
    def demo_run():
        require_api_key(request.headers.get(Config.API_KEY_HEADER))
        return jsonify(
            {
                "run_id": make_run_id(),
                "status": "completed",
                "model_version": Config.MODEL_VERSION,
                "mode": "demo",
                "solver": "dummy",
                "binary_variables": 3,
                "best_bitstring": "101",
                "objective": -0.125,
                "qubo_value": -0.125,
                "selected_usd": 750000.0,
                "budget_gap": -250000.0,
                "components": {
                    "return_term": -0.35,
                    "risk_term": 0.1,
                    "budget_term": 0.125,
                },
                "selected_blocks": [
                    {"Ticker": "DEMO-A", "decision_role": "variable", "Indicative Market Cost USD": 500000.0},
                    {"Ticker": "DEMO-C", "decision_role": "variable", "Indicative Market Cost USD": 250000.0},
                ],
                "diagnostics": {
                    "message": "Dummy response only; no workbook was optimized.",
                },
            }
        )

    @flask_app.post("/upload-excel-demo")
    def upload_excel_demo():
        require_api_key(request.headers.get(Config.API_KEY_HEADER))
        tmp_path = None
        try:
            tmp_path, filename = save_upload_to_temp(request.files.get("file"))
            summary = workbook_structure(tmp_path)
            return jsonify(
                json_safe(
                    {
                        "status": "ok",
                        "filename": filename,
                        **summary,
                    }
                )
            )
        finally:
            cleanup_temp_file(tmp_path)

    @flask_app.post("/inspect-workbook")
    def inspect_workbook():
        mode_selection = resolve_run_mode(request.form.get("mode"))
        submitted_mode = mode_selection.requested_run_mode
        mode = mode_selection.run_mode
        tmp_path = None
        filename = None
        usage_context = None
        optimizer = None
        policy_result = None
        worker_profile = DEFAULT_WORKER_PROFILE
        run_metadata = worker_profile_metadata(worker_profile)
        ledger = get_run_ledger()

        try:
            usage_context = resolve_usage_context(request.headers.get(Config.API_KEY_HEADER))
            worker_profile = validate_worker_profile_allowed(
                usage_context,
                normalize_worker_profile(request.form.get("worker_profile")),
            )
            run_metadata = worker_profile_metadata(worker_profile)
            response_level = (request.form.get("response_level") or DEFAULT_RESPONSE_LEVEL).strip().lower()
            validate_pre_upload_policy(usage_context, mode, response_level, request.content_length)

            tmp_path, filename = save_upload_to_temp(request.files.get("file"))
            validate_required_input_sheets(tmp_path)
            workbook_structure(tmp_path)
            logs: list[str] = []
            optimizer = build_qubo_from_workbook(tmp_path, logs.append, request.form)
            _apply_run_mode_metadata(optimizer, mode_selection)
            append_workbook_warning_logs(logs, optimizer)
            _append_mode_logs(logs, mode, inspection=True)
            policy_result = validate_problem_policy(usage_context, optimizer, mode, request.form)
            _append_random_seed_log(logs, policy_result)
            logs.append("Inspection only: optimization execution skipped.")
            logs.append("QAOA execution status: not executed during workbook inspection.")
            payload = build_inspection_response(
                filename=filename,
                optimizer=optimizer,
                mode=mode,
                usage_context=usage_context,
                license_info=ledger.license_status(usage_context),
                policy_result=policy_result,
                logs=logs,
                run_metadata=run_metadata,
            )
            return jsonify(payload)
        except ApiError as exc:
            if usage_context is not None:
                exc.license_info = ledger.safe_license_summary(usage_context)
            if optimizer is not None:
                exc.details = dict(exc.details or {})
                exc.details.setdefault(
                    "diagnostics",
                    _inspection_error_diagnostics(usage_context, optimizer, mode, request.form, locals().get("logs", [])),
                )
            raise
        except _legacy_optimization_error_type() as exc:
            logger.info("Optimizer validation error during workbook inspection: %s", exc)
            api_error = ApiError(422, "optimization_error", str(exc))
            if usage_context is not None:
                api_error.license_info = ledger.safe_license_summary(usage_context)
            raise api_error from exc
        finally:
            cleanup_temp_file(tmp_path)

    @flask_app.post("/run-qaoa")
    def run_qaoa():
        run_id = make_run_id()
        timestamp_start_utc = _utc_now()
        start_time = time.perf_counter()
        mode_selection = resolve_run_mode(request.form.get("mode"))
        submitted_mode = mode_selection.requested_run_mode
        mode = mode_selection.run_mode
        response_level = (request.form.get("response_level") or DEFAULT_RESPONSE_LEVEL).strip().lower()
        tmp_path = None
        filename = None
        usage_context = None
        optimizer = None
        policy_result = None
        worker_profile = DEFAULT_WORKER_PROFILE
        run_metadata = worker_profile_metadata(worker_profile)
        execution_started = False
        lock_acquired = False
        public_slot_acquired = False
        ledger = get_run_ledger()

        try:
            usage_context = resolve_usage_context(request.headers.get(Config.API_KEY_HEADER))
            worker_profile = validate_worker_profile_allowed(
                usage_context,
                normalize_worker_profile(request.form.get("worker_profile")),
            )
            run_metadata = worker_profile_metadata(worker_profile)
            if not ledger.can_consume_run(usage_context.key_record):
                raise ApiError(
                    403,
                    "run_limit_exceeded",
                    "API key has no remaining runs.",
                    {
                        "key_id": (usage_context.key_record or {}).get("key_id"),
                        "usage_level": usage_context.usage_level_name,
                        "remaining_runs": ledger.get_remaining_runs(usage_context.key_record),
                    },
                )
            validate_pre_upload_policy(usage_context, mode, response_level, request.content_length)

            tmp_path, filename = save_upload_to_temp(request.files.get("file"))
            validate_required_input_sheets(tmp_path)
            summary = workbook_structure(tmp_path)
            logs: list[str] = []
            optimizer = build_qubo_from_workbook(tmp_path, logs.append, request.form)
            _apply_run_mode_metadata(optimizer, mode_selection)
            append_workbook_warning_logs(logs, optimizer)
            _append_mode_logs(logs, mode, inspection=False)
            policy_result = validate_problem_policy(usage_context, optimizer, mode, request.form)
            _append_random_seed_log(logs, policy_result)

            if usage_context.authenticated:
                lock_info = ledger.acquire_run_lock(
                    usage_context.key_record,
                    run_id,
                    policy_result=policy_result,
                    user_agent=request.headers.get("User-Agent"),
                    ip_address=_client_ip(),
                )
                lock_acquired = bool(lock_info.get("acquired"))
                if lock_info.get("stale_lock_cleared"):
                    message = (
                        f"Cleared stale active run lock for key "
                        f"{(usage_context.key_record or {}).get('key_id')}: {lock_info.get('previous_active_run_id')}"
                    )
                    logger.warning(message)
                    logs.append(message)
            else:
                public_slot_info = ledger.acquire_public_run_slot(
                    usage_context,
                    run_id,
                    policy_result=policy_result,
                    mode=mode,
                    response_level=response_level,
                    filename=filename,
                    user_agent=request.headers.get("User-Agent"),
                    ip_address=_client_ip(),
                )
                public_slot_acquired = bool(public_slot_info.get("acquired"))

            ledger.record_run_started(
                run_id=run_id,
                usage_context=usage_context,
                mode=mode,
                response_level=response_level,
                filename=filename,
                optimizer=optimizer,
                policy_result=policy_result,
                timestamp_start_utc=timestamp_start_utc,
                **run_metadata,
            )

            execution_started = True
            optimizer, logs = run_classical_optimizer(optimizer, logs)
            logs.append(f"Classical candidate count: {int(len(getattr(optimizer, 'classical_results', [])))}")
            solver = "classical_heuristic"
            if mode in QAOA_MODES:
                qaoa_limits = mode_limits_for(usage_context.usage_level, mode)
                optimizer, logs = run_qaoa_sim(
                    optimizer,
                    policy_result.runtime_inputs,
                    logs,
                    max_qubits=(qaoa_limits or {}).get("max_qubits"),
                    run_mode=mode,
                    requested_run_mode=submitted_mode,
                    simulation_backend=simulation_backend_for_mode(mode),
                )
                logs.append(f"QAOA sample count: {int(len(getattr(optimizer, 'samples_df', [])))}")
                solver = f"classical_heuristic+{mode}"
            elif mode == "classical_only":
                logs.append("QAOA execution status: disabled for classical_only mode.")
            logs.extend(candidate_export_log_lines(optimizer))
            actual_runtime_sec = _elapsed(start_time)
            consumed_run = ledger.consume_run(usage_context.key_record, run_id)
            if usage_context.authenticated and not consumed_run:
                raise ApiError(
                    403,
                    "run_limit_exceeded",
                    "API key has no remaining runs.",
                    {
                        "key_id": (usage_context.key_record or {}).get("key_id"),
                        "usage_level": usage_context.usage_level_name,
                        "remaining_runs": ledger.get_remaining_runs(usage_context.key_record),
                    },
                )
            ledger.record_run_completed(
                run_id=run_id,
                usage_context=usage_context,
                mode=mode,
                response_level=response_level,
                filename=filename,
                optimizer=optimizer,
                policy_result=policy_result,
                timestamp_start_utc=timestamp_start_utc,
                actual_runtime_sec=actual_runtime_sec,
                solver=solver,
                consumed_run=consumed_run,
                **run_metadata,
            )
            if lock_acquired:
                try:
                    if ledger.release_run_lock(usage_context.key_record, run_id):
                        lock_acquired = False
                except Exception:
                    logger.exception("Failed to release active run lock for run_id=%s", run_id)
            if public_slot_acquired:
                try:
                    if ledger.release_public_run_slot(run_id):
                        public_slot_acquired = False
                except Exception:
                    logger.exception("Failed to release public demo run slot for run_id=%s", run_id)
            payload = build_classical_response(
                run_id,
                optimizer,
                summary,
                logs,
                response_level=response_level,
                mode=mode,
                solver=solver,
                usage_context=usage_context,
                policy_result=policy_result,
                license_info=ledger.license_status(usage_context),
                actual_runtime_sec=actual_runtime_sec,
                run_metadata=run_metadata,
            )
            payload["filename"] = filename
            return jsonify(payload)
        except ApiError as exc:
            actual_runtime_sec = _elapsed(start_time)
            if usage_context is not None:
                exc.license_info = ledger.safe_license_summary(usage_context)
                ledger.record_run_rejected(
                    run_id=run_id,
                    usage_context=usage_context,
                    mode=mode,
                    response_level=response_level,
                    filename=filename,
                    optimizer=optimizer,
                    policy_result=policy_result,
                    timestamp_start_utc=timestamp_start_utc,
                    actual_runtime_sec=actual_runtime_sec,
                    rejection_code=exc.code,
                    consumed_run=False,
                    **run_metadata,
                )
            raise
        except QAOAExecutionError as exc:
            logger.info("QAOA limited execution error: %s", exc)
            actual_runtime_sec = _elapsed(start_time)
            api_error = ApiError(
                500,
                "qaoa_execution_error",
                "QAOA limited execution failed. Try a smaller workbook or lower runtime settings.",
                details={"run_status": "failed"},
            )
            if usage_context is not None:
                api_error.license_info = ledger.safe_license_summary(usage_context)
                ledger.record_run_failed(
                    run_id=run_id,
                    usage_context=usage_context,
                    mode=mode,
                    response_level=response_level,
                    filename=filename,
                    optimizer=optimizer,
                    policy_result=policy_result,
                    timestamp_start_utc=timestamp_start_utc,
                    actual_runtime_sec=actual_runtime_sec,
                    error_code="qaoa_execution_error",
                    consumed_run=False,
                    **run_metadata,
                )
            raise api_error from exc
        except _legacy_optimization_error_type() as exc:
            logger.info("Optimizer validation error: %s", exc)
            actual_runtime_sec = _elapsed(start_time)
            api_error = ApiError(
                422,
                "optimization_error",
                str(exc),
                details={"run_status": "failed"} if execution_started else None,
            )
            if usage_context is not None:
                api_error.license_info = ledger.safe_license_summary(usage_context)
                if execution_started:
                    ledger.record_run_failed(
                        run_id=run_id,
                        usage_context=usage_context,
                        mode=mode,
                        response_level=response_level,
                        filename=filename,
                        optimizer=optimizer,
                        policy_result=policy_result,
                        timestamp_start_utc=timestamp_start_utc,
                        actual_runtime_sec=actual_runtime_sec,
                        error_code="optimization_error",
                        consumed_run=False,
                        **run_metadata,
                    )
                else:
                    ledger.record_run_rejected(
                        run_id=run_id,
                        usage_context=usage_context,
                        mode=mode,
                        response_level=response_level,
                        filename=filename,
                        optimizer=optimizer,
                        policy_result=policy_result,
                        timestamp_start_utc=timestamp_start_utc,
                        actual_runtime_sec=actual_runtime_sec,
                        rejection_code="optimization_error",
                        consumed_run=False,
                        **run_metadata,
                    )
            raise api_error from exc
        except Exception:
            actual_runtime_sec = _elapsed(start_time)
            if usage_context is not None and execution_started:
                ledger.record_run_failed(
                    run_id=run_id,
                    usage_context=usage_context,
                    mode=mode,
                    response_level=response_level,
                    filename=filename,
                    optimizer=optimizer,
                    policy_result=policy_result,
                    timestamp_start_utc=timestamp_start_utc,
                    actual_runtime_sec=actual_runtime_sec,
                    error_code="internal_server_error",
                    consumed_run=False,
                    **run_metadata,
                )
                logger.exception("Unhandled run execution error")
                raise ApiError(
                    500,
                    "internal_server_error",
                    "An internal server error occurred while processing the request.",
                    details={"run_status": "failed"},
                    license_info=ledger.safe_license_summary(usage_context),
                )
            raise
        finally:
            if lock_acquired and usage_context is not None:
                try:
                    ledger.release_run_lock(usage_context.key_record, run_id)
                except Exception:
                    logger.exception("Failed to release active run lock for run_id=%s", run_id)
            if public_slot_acquired:
                try:
                    ledger.release_public_run_slot(run_id)
                except Exception:
                    logger.exception("Failed to release public demo run slot for run_id=%s", run_id)
            cleanup_temp_file(tmp_path)

    @flask_app.post("/run-qaoa-async")
    def run_qaoa_async():
        job_id = make_job_id()
        mode_selection = resolve_run_mode(request.form.get("mode"))
        submitted_mode = mode_selection.requested_run_mode
        mode = mode_selection.run_mode
        response_level = (request.form.get("response_level") or DEFAULT_RESPONSE_LEVEL).strip().lower()
        tmp_path = None
        filename = None
        usage_context = None
        optimizer = None
        policy_result = None
        worker_profile = DEFAULT_WORKER_PROFILE
        run_metadata = worker_profile_metadata(worker_profile)
        lock_acquired = False
        public_slot_acquired = False
        job_created = False
        submission_completed = False
        ledger = get_run_ledger()
        job_store = get_job_store()
        storage = get_job_storage()

        try:
            raw_api_key = request.headers.get(Config.API_KEY_HEADER)
            usage_context = resolve_usage_context(raw_api_key)
            worker_profile = validate_worker_profile_allowed(
                usage_context,
                normalize_worker_profile(request.form.get("worker_profile")),
            )
            run_metadata = worker_profile_metadata(worker_profile)
            if not ledger.can_consume_run(usage_context.key_record):
                raise ApiError(
                    403,
                    "run_limit_exceeded",
                    "API key has no remaining runs.",
                    {
                        "key_id": (usage_context.key_record or {}).get("key_id"),
                        "usage_level": usage_context.usage_level_name,
                        "remaining_runs": ledger.get_remaining_runs(usage_context.key_record),
                    },
                )
            validate_pre_upload_policy(usage_context, mode, response_level, request.content_length)

            tmp_path, filename = save_upload_to_temp(request.files.get("file"))
            validate_required_input_sheets(tmp_path)
            workbook_structure(tmp_path)
            logs: list[str] = []
            optimizer = build_qubo_from_workbook(tmp_path, logs.append, request.form)
            _apply_run_mode_metadata(optimizer, mode_selection)
            warning_lines = workbook_warning_log_lines(optimizer)
            logs.extend(warning_lines)
            _append_mode_logs(logs, mode, inspection=True)
            policy_result = validate_problem_policy(usage_context, optimizer, mode, request.form)
            _append_random_seed_log(logs, policy_result)

            if usage_context.authenticated:
                lock_info = ledger.acquire_run_lock(
                    usage_context.key_record,
                    job_id,
                    policy_result=policy_result,
                    user_agent=request.headers.get("User-Agent"),
                    ip_address=_client_ip(),
                )
                lock_acquired = bool(lock_info.get("acquired"))
                lock_type = "key"
            else:
                public_slot_info = ledger.acquire_public_run_slot(
                    usage_context,
                    job_id,
                    policy_result=policy_result,
                    mode=mode,
                    response_level=response_level,
                    filename=filename,
                    user_agent=request.headers.get("User-Agent"),
                    ip_address=_client_ip(),
                )
                public_slot_acquired = bool(public_slot_info.get("acquired"))
                lock_type = "public"

            input_info = storage.save_input_from_path(job_id, tmp_path, filename)
            settings = _job_settings_from_request(mode, response_level, request.form, policy_result)
            settings["worker_profile"] = worker_profile
            job_store.create_job(
                initial_job_document(
                    job_id=job_id,
                    mode=mode,
                    response_level=response_level,
                    settings=settings,
                    input_info=input_info,
                    usage_context=usage_context,
                    policy_result=policy_result,
                    lock_type=lock_type,
                    key_hash=generate_key_hash(raw_api_key) if raw_api_key else None,
                    worker_profile=worker_profile,
                )
            )
            job_created = True
            for line in warning_lines:
                job_store.append_log(job_id, line, phase="validation")
            job_store.append_log(
                job_id,
                f"Random seed: {random_seed_display(policy_result.runtime_inputs.random_seed)}",
                phase="validation",
            )
            trigger_info = trigger_cloud_run_job(job_id)
            if trigger_info.get("triggered"):
                job_store.update_job(job_id, {"trigger": json_safe(trigger_info), "heartbeat_at": _utc_now()})
            else:
                job_store.update_job(
                    job_id,
                    {
                        "trigger": json_safe(trigger_info),
                        "latest_log": "Job queued. Run the worker manually in local development.",
                    },
                )
            submission_completed = True
            return jsonify(
                {
                    "ok": True,
                    "job_id": job_id,
                    "status": "queued",
                    "status_url": f"/jobs/{job_id}/status",
                    "result_url": f"/jobs/{job_id}/result",
                    **run_metadata,
                }
            ), 202
        except ApiError as exc:
            if usage_context is not None:
                exc.license_info = ledger.safe_license_summary(usage_context)
                ledger.record_run_rejected(
                    run_id=job_id,
                    usage_context=usage_context,
                    mode=mode,
                    response_level=response_level,
                    filename=filename,
                    optimizer=optimizer,
                    policy_result=policy_result,
                    timestamp_start_utc=_utc_now(),
                    actual_runtime_sec=0.0,
                    rejection_code=exc.code,
                    consumed_run=False,
                    **run_metadata,
                )
            if job_created:
                try:
                    job_store.update_job(
                        job_id,
                        {
                            "status": "failed",
                            "phase": "submission_failed",
                            "finished_at": _utc_now(),
                            "error": {"message": exc.message, "type": "ApiError", "code": exc.code},
                        },
                    )
                except Exception:
                    logger.exception("Failed to mark async submission job as failed: %s", job_id)
            raise
        except Exception as exc:
            if job_created:
                try:
                    job_store.update_job(
                        job_id,
                        {
                            "status": "failed",
                            "phase": "submission_failed",
                            "finished_at": _utc_now(),
                            "error": {"message": "Async job submission failed.", "type": type(exc).__name__},
                        },
                    )
                except Exception:
                    logger.exception("Failed to mark async submission job as failed: %s", job_id)
            logger.exception("Async job submission failed")
            raise ApiError(
                500,
                "async_job_submission_failed",
                "Async job submission failed before the worker could be started.",
            ) from exc
        finally:
            if (not submission_completed) and lock_acquired and usage_context is not None:
                try:
                    ledger.release_run_lock(usage_context.key_record, job_id)
                except Exception:
                    logger.exception("Failed to release active run lock for failed async submission job_id=%s", job_id)
            if (not submission_completed) and public_slot_acquired:
                try:
                    ledger.release_public_run_slot(job_id)
                except Exception:
                    logger.exception("Failed to release public slot for failed async submission job_id=%s", job_id)
            cleanup_temp_file(tmp_path)

    @flask_app.get("/jobs/<job_id>/status")
    def job_status(job_id: str):
        return jsonify(get_job_store().status_payload(job_id))

    @flask_app.get("/jobs/<job_id>/result")
    def job_result(job_id: str):
        job_store = get_job_store()
        job = job_store.get_job(job_id)
        if job is None:
            raise ApiError(404, "job_not_found", "Job was not found.", {"job_id": job_id})
        if job.get("status") != "completed":
            raise ApiError(
                409,
                "job_not_completed",
                "Job result is not available yet.",
                {"job_id": job_id, "status": job.get("status"), "phase": job.get("phase")},
            )
        result = job.get("result") or {}
        if not result.get("available") or not result.get("storage_path"):
            raise ApiError(500, "job_result_missing", "Job completed but no result payload is available.")
        return jsonify(get_job_storage().read_result_json(str(result.get("storage_path"))))

    @flask_app.post("/jobs/<job_id>/cancel")
    def cancel_job(job_id: str):
        job_store = get_job_store()
        job = job_store.get_job(job_id)
        if job is None:
            raise ApiError(404, "job_not_found", "Job was not found.", {"job_id": job_id})
        updates = {
            "cancel_requested": True,
            "heartbeat_at": _utc_now(),
            "latest_log": "Cancellation requested.",
        }
        if job.get("status") == "queued":
            updates.update({"status": "cancelled", "phase": "cancelled", "finished_at": _utc_now()})
            try:
                usage_context = _usage_context_from_job(job)
                _release_job_lock(get_run_ledger(), usage_context, job_id)
            except Exception:
                logger.exception("Failed to release lock for cancelled queued job_id=%s", job_id)
                try:
                    _release_job_lock_from_job(get_run_ledger(), job, job_id)
                except Exception:
                    logger.exception("Fallback lock release failed for cancelled queued job_id=%s", job_id)
        job_store.update_job(job_id, updates)
        return jsonify(get_job_store().status_payload(job_id))


def register_error_handlers(flask_app: Flask) -> None:
    @flask_app.errorhandler(ApiError)
    def handle_api_error(error: ApiError):
        return jsonify(error.to_dict()), error.status_code

    @flask_app.errorhandler(413)
    def handle_too_large(_error):
        error = ApiError(
            413,
            "upload_too_large",
            f"Uploaded workbook exceeds the {Config.MAX_UPLOAD_MB} MB limit.",
        )
        return jsonify(error.to_dict()), error.status_code

    @flask_app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        api_error = ApiError(
            error.code or 500,
            error.name.lower().replace(" ", "_"),
            error.description,
        )
        return jsonify(api_error.to_dict()), api_error.status_code

    @flask_app.errorhandler(Exception)
    def handle_unexpected(error: Exception):
        logger.exception("Unhandled API error")
        api_error = ApiError(
            500,
            "internal_server_error",
            "An internal server error occurred while processing the request.",
        )
        return jsonify(api_error.to_dict()), api_error.status_code


def _legacy_optimization_error_type():
    try:
        _, optimization_error = load_legacy_optimizer_symbols()
        return optimization_error
    except Exception:
        return RuntimeError


def _append_mode_logs(logs: list[str], mode: str, inspection: bool = False) -> None:
    logs.append(f"Selected mode: {mode}")
    if inspection:
        logs.append("Workbook inspection path: QUBO built, optimization not executed.")
    if mode == "classical_only":
        logs.append("QAOA execution status: disabled for classical_only mode.")
    elif mode in QAOA_MODES:
        backend = simulation_backend_for_mode(mode)
        logs.append(f"QAOA execution status: enabled for {mode} mode.")
        logs.append(f"QAOA simulation backend: {backend}")


def _apply_run_mode_metadata(optimizer, mode_selection) -> None:
    optimizer.requested_run_mode = mode_selection.requested_run_mode
    optimizer.run_mode = mode_selection.run_mode
    optimizer.simulation_backend = mode_selection.simulation_backend
    optimizer.legacy_run_mode_alias = mode_selection.legacy_run_mode_alias
    optimizer.hardware_replay = mode_selection.hardware_replay


def _append_random_seed_log(logs: list[str], policy_result) -> None:
    logs.append(f"Random seed: {random_seed_display(policy_result.runtime_inputs.random_seed)}")


def _inspection_error_diagnostics(usage_context, optimizer, mode: str, form_data, logs: list[str]) -> dict:
    diagnostics = {
        "service": Config.SERVICE_NAME,
        "usage_level": getattr(usage_context, "usage_level_name", None),
        "workbook_warnings": workbook_warnings(optimizer),
        "workbook_warning_count": len(workbook_warnings(optimizer)),
        "cost_column_used": getattr(optimizer, "input_cost_column", None),
        "cost_column_internal": getattr(optimizer, "internal_cost_column", None),
        "cost_column_normalized": bool(getattr(optimizer, "cost_column_normalized", False)),
        "additional_type_constraints_count": int(getattr(optimizer, "additional_type_constraints_count", 0) or 0),
        "additional_type_constraints": constraints_for_json(optimizer),
        "logs": list(logs or [])[-50:],
    }
    diagnostics.update(mode_diagnostics(getattr(optimizer, "requested_run_mode", mode), mode))
    try:
        runtime_inputs = extract_runtime_inputs(
            optimizer,
            form_data,
            usage_level=getattr(usage_context, "usage_level", {}) if usage_context is not None else {},
            mode=mode,
        )
        effective_settings = build_effective_settings(optimizer, mode, runtime_inputs, form_data)
        diagnostics["runtime_inputs"] = {
            "layers": runtime_inputs.layers,
            "iterations": runtime_inputs.iterations,
            "restarts": runtime_inputs.restarts,
            "warm_start": runtime_inputs.warm_start,
            "qaoa_shots": runtime_inputs.qaoa_shots,
            "restart_perturbation": runtime_inputs.restart_perturbation,
            "random_seed": runtime_inputs.random_seed,
        }
        diagnostics["effective_settings"] = effective_settings
        diagnostics["random_seed"] = runtime_inputs.random_seed
    except Exception:
        logger.debug("Could not attach inspection diagnostics to error response.", exc_info=True)
    return json_safe(diagnostics)


def _elapsed(start_time: float) -> float:
    return float(max(time.perf_counter() - start_time, 0.0))


def _client_ip() -> str | None:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip() or None
    return request.headers.get("X-Real-IP") or request.remote_addr


def _job_settings_from_request(mode: str, response_level: str, form_data, policy_result) -> dict:
    settings = {key: str(value) for key, value in form_data.items()}
    effective_seed = policy_result.effective_settings.get("random_seed")
    if effective_seed is not None:
        settings["random_seed"] = str(effective_seed)
        settings["rng_seed"] = str(effective_seed)
    settings["mode"] = mode
    settings["response_level"] = response_level
    for key in (
        "requested_run_mode",
        "run_mode",
        "simulation_backend",
        "legacy_run_mode_alias",
        "hardware_replay",
        "export_mode",
        "export_mode_label",
        "qiskit_export_requested",
        "ibm_external_run_requested",
    ):
        if key in policy_result.effective_settings:
            settings[key] = policy_result.effective_settings[key]
    settings["effective_settings"] = json_safe(policy_result.effective_settings)
    settings["runtime_inputs"] = json_safe(
        {
            "layers": policy_result.runtime_inputs.layers,
            "iterations": policy_result.runtime_inputs.iterations,
            "restarts": policy_result.runtime_inputs.restarts,
            "warm_start": policy_result.runtime_inputs.warm_start,
            "qaoa_shots": policy_result.runtime_inputs.qaoa_shots,
            "restart_perturbation": policy_result.runtime_inputs.restart_perturbation,
            "random_seed": policy_result.runtime_inputs.random_seed,
        }
    )
    return settings


def _usage_context_from_job(job: dict):
    if not bool(job.get("authenticated")):
        return usage_context_from_key_record(None)
    key_id = str(job.get("key_id") or (job.get("lock") or {}).get("key_id") or "")
    key_record = get_key_store().find_key_by_id(key_id)
    if key_record is None:
        raise ApiError(403, "api_key_not_found", "API key record was not found.", {"key_id": key_id})
    return usage_context_from_key_record(key_record)


def _release_job_lock(ledger, usage_context, job_id: str) -> None:
    if usage_context.authenticated:
        ledger.release_run_lock(usage_context.key_record, job_id)
    else:
        ledger.release_public_run_slot(job_id)


def _release_job_lock_from_job(ledger, job: dict, job_id: str) -> None:
    lock = job.get("lock") or {}
    lock_type = lock.get("type")
    if lock_type == "key" or bool(job.get("authenticated")):
        key_id = str(lock.get("key_id") or job.get("key_id") or "")
        if key_id:
            ledger.release_run_lock({"key_id": key_id, "_firestore_doc_id": key_id}, job_id)
    else:
        ledger.release_public_run_slot(job_id)


def _utc_now() -> str:
    import datetime as dt

    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


app = create_app()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run(host="0.0.0.0", port=8080)
