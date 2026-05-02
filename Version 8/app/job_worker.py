"""Cloud Run Job worker entrypoint for asynchronous Version 8 optimization."""

from __future__ import annotations

import argparse
import datetime as dt
import os
import tempfile
import time
import traceback
from pathlib import Path
from typing import Any

from app.classical_solver import run_classical_optimizer
from app.config import Config
from app.excel_io import cleanup_temp_file, validate_required_input_sheets, workbook_structure
from app.job_storage import get_job_storage
from app.job_store import get_job_store
from app.key_store import get_key_store
from app.qaoa_engine import QAOAExecutionError, run_qaoa_limited
from app.qubo_builder import build_qubo_from_workbook, load_legacy_optimizer_symbols
from app.result_writer import build_classical_response
from app.run_ledger import get_run_ledger
from app.schemas import ApiError, json_safe
from app.usage_policy import usage_context_from_key_record, validate_problem_policy
from app.workbook_diagnostics import append_workbook_warning_logs, candidate_export_log_lines, workbook_warning_log_lines


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run one QAOA RQP async job.")
    parser.add_argument("--job-id", default=os.getenv("JOB_ID"))
    args = parser.parse_args(argv)
    if not args.job_id:
        raise SystemExit("--job-id or JOB_ID is required.")
    run_job(str(args.job_id))
    return 0


def run_job(job_id: str) -> dict[str, Any]:
    job_store = get_job_store()
    storage = get_job_storage()
    ledger = get_run_ledger()
    job = job_store.get_job(job_id)
    if job is None:
        raise ApiError(404, "job_not_found", "Job was not found.", {"job_id": job_id})

    mode = str(job.get("mode") or (job.get("settings") or {}).get("mode") or "classical_only")
    response_level = str(job.get("response_level") or (job.get("settings") or {}).get("response_level") or "full")
    settings = dict(job.get("settings") or {})
    filename = ((job.get("input") or {}).get("original_filename")) or "input.xlsx"
    timestamp_start_utc = _utc_now()
    start_time = time.perf_counter()
    tmp_path: Path | None = None
    usage_context = None
    optimizer = None
    policy_result = None
    execution_started = False

    try:
        usage_context = _usage_context_from_job(job)
        if bool(job.get("cancel_requested")):
            _mark_cancelled(job_store, job_id)
            return job_store.get_job(job_id) or {}

        job_store.update_job(
            job_id,
            {
                "status": "running",
                "phase": "initializing",
                "started_at": timestamp_start_utc,
                "heartbeat_at": timestamp_start_utc,
                "progress": {"progress_pct": 1.0, "elapsed_seconds": 0.0},
            },
        )
        job_store.append_log(job_id, "Worker started.", progress={"progress_pct": 2.0}, phase="initializing")

        tmp_path = Path(tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False).name)
        storage.download_input_to(str((job.get("input") or {}).get("storage_path")), tmp_path)
        job_store.append_log(job_id, "Input workbook loaded.", progress={"progress_pct": 5.0}, phase="input_loading")

        validate_required_input_sheets(tmp_path)
        summary = workbook_structure(tmp_path)
        logs: list[str] = []
        reporter = JobProgressReporter(job_store, job_id, start_time)
        optimizer = build_qubo_from_workbook(tmp_path, reporter.log_and_collect(logs), settings)
        optimizer.progress_callback = reporter.optimizer_progress
        append_workbook_warning_logs(logs, optimizer)
        for line in workbook_warning_log_lines(optimizer):
            reporter.update(line, progress_pct=12.0, phase="model_validation")
        _append_mode_logs(logs, mode, inspection=False)
        policy_result = validate_problem_policy(usage_context, optimizer, mode, settings)
        reporter.max_iterations = max(
            1,
            int(policy_result.runtime_inputs.layers)
            * int(policy_result.runtime_inputs.iterations)
            * int(policy_result.runtime_inputs.restarts),
        )
        reporter.update("Model and QUBO constructed.", progress_pct=15.0, phase="model_built")

        ledger.record_run_started(
            run_id=job_id,
            usage_context=usage_context,
            mode=mode,
            response_level=response_level,
            filename=filename,
            optimizer=optimizer,
            policy_result=policy_result,
            timestamp_start_utc=timestamp_start_utc,
        )

        execution_started = True
        reporter.update("Running classical baseline.", progress_pct=18.0, phase="optimization")
        optimizer, logs = run_classical_optimizer(optimizer, logs)
        logs.append(f"Classical candidate count: {int(len(getattr(optimizer, 'classical_results', [])))}")
        reporter.update(logs[-1], progress_pct=55.0 if mode == "qaoa_limited" else 90.0, phase="optimization")

        solver = "classical_heuristic"
        if mode == "qaoa_limited":
            qaoa_limited_limits = usage_context.usage_level.get("qaoa_limited_limits", {})
            reporter.update("Running QAOA limited optimization.", progress_pct=56.0, phase="optimization")
            optimizer, logs = run_qaoa_limited(
                optimizer,
                policy_result.runtime_inputs,
                logs,
                max_qubits=(qaoa_limited_limits or {}).get("max_qubits"),
            )
            logs.append(f"QAOA sample count: {int(len(getattr(optimizer, 'samples_df', [])))}")
            solver = "classical_heuristic+qaoa_limited"
            reporter.update(logs[-1], progress_pct=90.0, phase="optimization")
        elif mode == "classical_only":
            logs.append("QAOA execution status: disabled for classical_only mode.")

        for line in candidate_export_log_lines(optimizer):
            logs.append(line)
            reporter.update(line, progress_pct=92.0, phase="result_processing")
        reporter.update("Building result payload.", progress_pct=94.0, phase="result_processing")
        actual_runtime_sec = _elapsed(start_time)
        consumed_run = ledger.consume_run(usage_context.key_record, job_id)
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
            run_id=job_id,
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
        payload = build_classical_response(
            job_id,
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
        result_path = storage.write_result_json(job_id, payload)
        result_summary = _result_summary(payload)
        job_store.update_job(
            job_id,
            {
                "status": "completed",
                "phase": "completed",
                "heartbeat_at": _utc_now(),
                "finished_at": _utc_now(),
                "progress": {
                    "progress_pct": 100.0,
                    "elapsed_seconds": actual_runtime_sec,
                    "eta_seconds_low": 0.0,
                    "eta_seconds_high": 0.0,
                },
                "latest_log": "Job completed.",
                "result": {
                    "available": True,
                    "storage_path": result_path,
                    "summary": result_summary,
                },
            },
        )
        job_store.append_log(job_id, "Job completed.", progress={"progress_pct": 100.0}, phase="completed")
        return job_store.get_job(job_id) or {}
    except Exception as exc:  # noqa: BLE001 - worker must persist controlled failure state
        actual_runtime_sec = _elapsed(start_time)
        error_code = _error_code(exc)
        if usage_context is not None:
            if execution_started:
                ledger.record_run_failed(
                    run_id=job_id,
                    usage_context=usage_context,
                    mode=mode,
                    response_level=response_level,
                    filename=filename,
                    optimizer=optimizer,
                    policy_result=policy_result,
                    timestamp_start_utc=timestamp_start_utc,
                    actual_runtime_sec=actual_runtime_sec,
                    error_code=error_code,
                    consumed_run=False,
                )
            else:
                ledger.record_run_rejected(
                    run_id=job_id,
                    usage_context=usage_context,
                    mode=mode,
                    response_level=response_level,
                    filename=filename,
                    optimizer=optimizer,
                    policy_result=policy_result,
                    timestamp_start_utc=timestamp_start_utc,
                    actual_runtime_sec=actual_runtime_sec,
                    rejection_code=error_code,
                    consumed_run=False,
                )
        job_store.update_job(
            job_id,
            {
                "status": "failed",
                "phase": "failed",
                "heartbeat_at": _utc_now(),
                "finished_at": _utc_now(),
                "progress": {"elapsed_seconds": actual_runtime_sec},
                "error": {
                    "message": _safe_error_message(exc),
                    "type": type(exc).__name__,
                    "traceback_tail": "\n".join(traceback.format_exc().splitlines()[-20:]),
                },
                "result": {"available": False, "storage_path": None, "summary": None},
            },
        )
        job_store.append_log(job_id, f"Job failed: {_safe_error_message(exc)}", phase="failed")
        return job_store.get_job(job_id) or {}
    finally:
        if usage_context is not None:
            _release_job_lock(ledger, usage_context, job_id)
        else:
            _release_job_lock_from_job(ledger, job, job_id)
        cleanup_temp_file(tmp_path)


class JobProgressReporter:
    def __init__(self, job_store, job_id: str, start_time: float, max_iterations: int | None = None):
        self.job_store = job_store
        self.job_id = job_id
        self.start_time = start_time
        self.max_iterations = max_iterations
        self.last_update = 0.0

    def log_and_collect(self, logs: list[str]):
        def emit(message: str) -> None:
            logs.append(str(message))
            self.update(str(message), phase=None)

        return emit

    def optimizer_progress(self, message: str, progress: float | None = None) -> None:
        progress_pct = None
        iteration = None
        if progress is not None:
            progress_pct = min(max(float(progress), 0.0), 97.0)
        if "iter=" in str(message):
            try:
                after_iter = str(message).split("iter=", 1)[1].strip()
                iteration = int(after_iter.split()[0])
            except Exception:
                iteration = None
        if iteration is not None and self.max_iterations:
            progress_pct = min(90.0, 15.0 + 75.0 * min(iteration, self.max_iterations) / self.max_iterations)
        self.update(str(message), progress_pct=progress_pct, iteration=iteration, phase="optimization")

    def update(
        self,
        message: str,
        *,
        progress_pct: float | None = None,
        iteration: int | None = None,
        phase: str | None = None,
    ) -> None:
        now = time.perf_counter()
        if progress_pct is None and now - self.last_update < 30:
            return
        self.last_update = now
        elapsed = _elapsed(self.start_time)
        progress: dict[str, Any] = {"elapsed_seconds": elapsed}
        if progress_pct is not None:
            progress["progress_pct"] = float(progress_pct)
            eta_low = _eta_low(elapsed, float(progress_pct))
            progress["eta_seconds_low"] = eta_low
            progress["eta_seconds_high"] = eta_low * 1.4 if eta_low is not None else None
        if iteration is not None:
            progress["iteration"] = int(iteration)
        if self.max_iterations is not None:
            progress["max_iterations"] = int(self.max_iterations)
        self.job_store.append_log(self.job_id, message, progress=progress, phase=phase)


def _usage_context_from_job(job: dict[str, Any]):
    if not bool(job.get("authenticated")):
        return usage_context_from_key_record(None)
    key_id = str(job.get("key_id") or (job.get("lock") or {}).get("key_id") or "")
    key_record = get_key_store().find_key_by_id(key_id)
    if key_record is None:
        raise ApiError(403, "api_key_not_found", "API key record was not found.", {"key_id": key_id})
    return usage_context_from_key_record(key_record)


def _release_job_lock(ledger, usage_context, job_id: str) -> None:
    try:
        if usage_context.authenticated:
            ledger.release_run_lock(usage_context.key_record, job_id)
        else:
            ledger.release_public_run_slot(job_id)
    except Exception:
        # The worker should not mask the original outcome if release fails.
        pass


def _release_job_lock_from_job(ledger, job: dict[str, Any], job_id: str) -> None:
    try:
        lock = job.get("lock") or {}
        lock_type = lock.get("type")
        if lock_type == "key" or bool(job.get("authenticated")):
            key_id = str(lock.get("key_id") or job.get("key_id") or "")
            if key_id:
                ledger.release_run_lock({"key_id": key_id, "_firestore_doc_id": key_id}, job_id)
        else:
            ledger.release_public_run_slot(job_id)
    except Exception:
        pass


def _mark_cancelled(job_store, job_id: str) -> None:
    job_store.update_job(
        job_id,
        {
            "status": "cancelled",
            "phase": "cancelled",
            "finished_at": _utc_now(),
            "heartbeat_at": _utc_now(),
            "latest_log": "Job cancelled before worker execution.",
            "result": {"available": False, "storage_path": None, "summary": None},
        },
    )


def _result_summary(payload: dict[str, Any]) -> dict[str, Any]:
    return json_safe(
        {
            "status": payload.get("status"),
            "mode": payload.get("mode"),
            "solver": payload.get("solver"),
            "binary_variables": payload.get("binary_variables"),
            "objective": payload.get("objective"),
            "qubo_value": payload.get("qubo_value"),
            "selected_usd": payload.get("selected_usd"),
            "budget_gap": payload.get("budget_gap"),
        }
    )


def _eta_low(elapsed: float, progress_pct: float) -> float | None:
    if progress_pct <= 0 or progress_pct >= 100:
        return 0.0 if progress_pct >= 100 else None
    return max((elapsed / progress_pct) * (100.0 - progress_pct), 0.0)


def _error_code(exc: Exception) -> str:
    if isinstance(exc, ApiError):
        return exc.code
    if isinstance(exc, QAOAExecutionError):
        return "qaoa_execution_error"
    if isinstance(exc, _legacy_optimization_error_type()):
        return "optimization_error"
    return "internal_server_error"


def _append_mode_logs(logs: list[str], mode: str, inspection: bool = False) -> None:
    logs.append(f"Selected mode: {mode}")
    if inspection:
        logs.append("Workbook inspection path: QUBO built, optimization not executed.")
    if mode == "classical_only":
        logs.append("QAOA execution status: disabled for classical_only mode.")
    elif mode == "qaoa_limited":
        logs.append("QAOA execution status: enabled for qaoa_limited mode.")
    elif mode == "qaoa_full":
        logs.append("QAOA execution status: qaoa_full disabled for asynchronous execution.")


def _legacy_optimization_error_type():
    try:
        _, optimization_error = load_legacy_optimizer_symbols()
        return optimization_error
    except Exception:
        return RuntimeError


def _safe_error_message(exc: Exception) -> str:
    if isinstance(exc, ApiError):
        return exc.message
    if isinstance(exc, QAOAExecutionError):
        return "QAOA limited execution failed."
    return str(exc) or "Worker execution failed."


def _elapsed(start_time: float) -> float:
    return float(max(time.perf_counter() - start_time, 0.0))


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
