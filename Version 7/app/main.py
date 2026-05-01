"""Flask entry point for the Version 7 QAOA RQP API."""

from __future__ import annotations

import logging
import os
import time

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

try:
    from flask_cors import CORS
except ImportError:  # pragma: no cover - optional local-dev dependency
    def CORS(*_args, **_kwargs):
        return None

from app.classical_solver import run_classical_optimizer
from app.config import Config
from app.excel_io import (
    cleanup_temp_file,
    save_upload_to_temp,
    validate_required_input_sheets,
    workbook_structure,
)
from app.license_service import require_api_key
from app.qaoa_engine import QAOAExecutionError, raise_qaoa_full_disabled, run_qaoa_limited
from app.qubo_builder import build_qubo_from_workbook, load_legacy_optimizer_symbols
from app.result_writer import build_classical_response, build_inspection_response
from app.run_ledger import get_run_ledger
from app.schemas import ApiError, json_safe, make_run_id
from app.usage_policy import (
    DEFAULT_RESPONSE_LEVEL,
    capabilities_payload,
    normalize_mode,
    resolve_usage_context,
    validate_secret_configuration,
    validate_pre_upload_policy,
    validate_problem_policy,
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
                    {"Ticker": "DEMO-A", "decision_role": "variable", "Approx Cost USD": 500000.0},
                    {"Ticker": "DEMO-C", "decision_role": "variable", "Approx Cost USD": 250000.0},
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
        submitted_mode = (request.form.get("mode") or "classical_only").strip().lower()
        mode = normalize_mode(submitted_mode)
        tmp_path = None
        filename = None
        usage_context = None
        optimizer = None
        policy_result = None
        ledger = get_run_ledger()

        try:
            usage_context = resolve_usage_context(request.headers.get(Config.API_KEY_HEADER))
            response_level = (request.form.get("response_level") or DEFAULT_RESPONSE_LEVEL).strip().lower()
            validate_pre_upload_policy(usage_context, mode, response_level, request.content_length)

            tmp_path, filename = save_upload_to_temp(request.files.get("file"))
            validate_required_input_sheets(tmp_path)
            workbook_structure(tmp_path)
            logs: list[str] = []
            optimizer = build_qubo_from_workbook(tmp_path, logs.append, request.form)
            _append_mode_logs(logs, mode, inspection=True)
            policy_result = validate_problem_policy(usage_context, optimizer, mode, request.form)
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
            )
            return jsonify(payload)
        except ApiError as exc:
            if usage_context is not None:
                exc.license_info = ledger.safe_license_summary(usage_context)
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
        submitted_mode = (request.form.get("mode") or "classical_only").strip().lower()
        mode = normalize_mode(submitted_mode)
        response_level = (request.form.get("response_level") or DEFAULT_RESPONSE_LEVEL).strip().lower()
        tmp_path = None
        filename = None
        usage_context = None
        optimizer = None
        policy_result = None
        execution_started = False
        lock_acquired = False
        public_slot_acquired = False
        ledger = get_run_ledger()

        try:
            usage_context = resolve_usage_context(request.headers.get(Config.API_KEY_HEADER))
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
            _append_mode_logs(logs, mode, inspection=False)
            policy_result = validate_problem_policy(usage_context, optimizer, mode, request.form)

            if mode == "qaoa_full":
                raise_qaoa_full_disabled(submitted_mode=submitted_mode)
            if mode not in {"classical_only", "qaoa_limited", "qaoa_full"}:
                raise ApiError(
                    400,
                    "unsupported_mode",
                    f"Unsupported mode. Version {Config.VERSION} supports mode=classical_only, mode=qaoa_limited, and disabled mode=qaoa_full.",
                    {"received_mode": mode, "supported_modes": ["classical_only", "qaoa_limited", "qaoa_full"]},
                )

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
            )

            execution_started = True
            optimizer, logs = run_classical_optimizer(optimizer, logs)
            logs.append(f"Classical candidate count: {int(len(getattr(optimizer, 'classical_results', [])))}")
            solver = "classical_heuristic"
            if mode == "qaoa_limited":
                qaoa_limited_limits = usage_context.usage_level.get("qaoa_limited_limits", {})
                optimizer, logs = run_qaoa_limited(
                    optimizer,
                    policy_result.runtime_inputs,
                    logs,
                    max_qubits=(qaoa_limited_limits or {}).get("max_qubits"),
                )
                logs.append(f"QAOA sample count: {int(len(getattr(optimizer, 'samples_df', [])))}")
                solver = "classical_heuristic+qaoa_limited"
            elif mode == "classical_only":
                logs.append("QAOA execution status: disabled for classical_only mode.")
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
    elif mode == "qaoa_limited":
        logs.append("QAOA execution status: enabled for qaoa_limited mode.")
    elif mode == "qaoa_full":
        logs.append("QAOA execution status: qaoa_full disabled for synchronous execution.")


def _elapsed(start_time: float) -> float:
    return float(max(time.perf_counter() - start_time, 0.0))


def _client_ip() -> str | None:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip() or None
    return request.headers.get("X-Real-IP") or request.remote_addr


def _utc_now() -> str:
    import datetime as dt

    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


app = create_app()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run(host="0.0.0.0", port=8080)
