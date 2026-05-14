"""Cloud Run Job trigger helper for Version 9 async execution."""

from __future__ import annotations

import time

from app.config import Config
from app.schemas import ApiError
from app.worker_profiles import DEFAULT_WORKER_PROFILE, normalize_worker_profile, worker_profile_job_name


def trigger_cloud_run_job(job_id: str, worker_profile: str | None = None) -> dict[str, object]:
    """Trigger the configured worker job.

    In local development, `RUN_JOBS_INLINE_FOR_LOCAL=1` executes the worker in
    the same process for tests and manual smoke runs. Without that flag, local
    development leaves the job queued so a developer can run the worker command
    manually.
    """

    profile = normalize_worker_profile(worker_profile or _worker_profile_from_job(job_id))
    selected_job_name = worker_profile_job_name(profile)

    if Config.RUN_JOBS_INLINE_FOR_LOCAL:
        from app.job_worker import run_job

        run_job(job_id)
        return {"triggered": True, "mode": "inline", "worker_profile": profile, "worker_job_name": selected_job_name}

    if _is_local_dev():
        return {
            "triggered": False,
            "mode": "local_manual",
            "worker_profile": profile,
            "worker_job_name": selected_job_name,
        }

    missing = [
        name
        for name, value in {
            "CLOUD_RUN_PROJECT": Config.CLOUD_RUN_PROJECT,
            "CLOUD_RUN_REGION": Config.CLOUD_RUN_REGION,
            "worker_job_name": selected_job_name,
        }.items()
        if not value
    ]
    if missing:
        raise ApiError(
            500,
            "cloud_run_job_config_missing",
            "Cloud Run Job trigger is not configured.",
            {"missing": missing},
        )

    try:
        from google.cloud import run_v2
    except ImportError as exc:
        raise ApiError(500, "cloud_run_dependency_missing", "Cloud Run trigger requires google-cloud-run.") from exc

    client = run_v2.JobsClient()
    name = client.job_path(Config.CLOUD_RUN_PROJECT, Config.CLOUD_RUN_REGION, selected_job_name)
    overrides = run_v2.RunJobRequest.Overrides(
        container_overrides=[
            run_v2.RunJobRequest.Overrides.ContainerOverride(
                env=[run_v2.EnvVar(name="JOB_ID", value=job_id)],
            )
        ]
    )
    operation = client.run_job(request=run_v2.RunJobRequest(name=name, overrides=overrides))
    operation_name = getattr(getattr(operation, "operation", None), "name", None) or getattr(operation, "name", None)
    execution_name = None
    try:
        execution_name = getattr(getattr(operation, "metadata", None), "name", None)
    except Exception:
        execution_name = None
    return {
        "triggered": True,
        "mode": "cloud_run_job",
        "operation": str(operation_name) if operation_name else None,
        "execution": str(execution_name) if execution_name else None,
        "worker_profile": profile,
        "worker_job_name": selected_job_name,
    }


def cancel_cloud_run_job_execution(trigger: dict[str, object] | None, *, timeout_sec: float = 8.0) -> dict[str, object]:
    if _is_local_dev():
        return {"attempted": False, "cancelled": False, "reason": "local_dev"}
    trigger_info = dict(trigger or {})
    execution_name = str(trigger_info.get("execution") or "").strip()
    if not execution_name:
        return {"attempted": False, "cancelled": False, "reason": "execution_not_tracked"}
    try:
        from google.cloud import run_v2
    except ImportError as exc:
        raise ApiError(500, "cloud_run_dependency_missing", "Cloud Run trigger requires google-cloud-run.") from exc
    client = run_v2.ExecutionsClient()
    operation = client.cancel_execution(request=run_v2.CancelExecutionRequest(name=execution_name))
    operation_name = getattr(getattr(operation, "operation", None), "name", None) or getattr(operation, "name", None)
    metadata_execution = None
    try:
        metadata_execution = getattr(getattr(operation, "metadata", None), "name", None)
    except Exception:
        metadata_execution = None
    deadline = time.time() + max(0.0, float(timeout_sec))
    while time.time() < deadline:
        if bool(getattr(operation, "done", lambda: False)()):
            break
        time.sleep(0.25)
    cancelled = False
    result_execution = None
    try:
        if bool(getattr(operation, "done", lambda: False)()):
            result_execution = operation.result(timeout=0)
            cancelled = True
    except Exception:
        cancelled = False
    return {
        "attempted": True,
        "cancelled": bool(cancelled),
        "execution": str(
            getattr(result_execution, "name", None) or metadata_execution or execution_name
        ),
        "operation": str(operation_name) if operation_name else None,
        "completion_time": getattr(result_execution, "completion_time", None) if result_execution is not None else None,
    }


def cloud_run_job_execution_status(trigger: dict[str, object] | None) -> dict[str, object]:
    if _is_local_dev():
        return {"available": False, "reason": "local_dev"}
    trigger_info = dict(trigger or {})
    execution_name = str(trigger_info.get("execution") or "").strip()
    if not execution_name:
        return {"available": False, "reason": "execution_not_tracked"}
    try:
        from google.cloud import run_v2
    except ImportError as exc:
        raise ApiError(500, "cloud_run_dependency_missing", "Cloud Run trigger requires google-cloud-run.") from exc
    client = run_v2.ExecutionsClient()
    try:
        execution = client.get_execution(request=run_v2.GetExecutionRequest(name=execution_name))
    except Exception as exc:  # noqa: BLE001 - surface as non-fatal diagnostic
        return {
            "available": False,
            "reason": type(exc).__name__,
            "execution": execution_name,
        }
    return {
        "available": True,
        "execution": execution_name,
        "completion_time": getattr(execution, "completion_time", None),
        "create_time": getattr(execution, "create_time", None),
        "start_time": getattr(execution, "start_time", None),
        "terminal": bool(getattr(execution, "completion_time", None)),
    }


def _worker_profile_from_job(job_id: str) -> str:
    try:
        from app.job_store import get_job_store

        job = get_job_store().get_job(job_id) or {}
        return normalize_worker_profile(str(job.get("worker_profile") or DEFAULT_WORKER_PROFILE))
    except Exception:
        return DEFAULT_WORKER_PROFILE


def _is_local_dev() -> bool:
    import os

    return os.getenv("QAOA_RQP_LOCAL_DEV") == "1"
