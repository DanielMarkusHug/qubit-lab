"""Cloud Run Job trigger helper for Version 9 async execution."""

from __future__ import annotations

from app.config import Config
from app.schemas import ApiError


def trigger_cloud_run_job(job_id: str) -> dict[str, object]:
    """Trigger the configured worker job.

    In local development, `RUN_JOBS_INLINE_FOR_LOCAL=1` executes the worker in
    the same process for tests and manual smoke runs. Without that flag, local
    development leaves the job queued so a developer can run the worker command
    manually.
    """

    if Config.RUN_JOBS_INLINE_FOR_LOCAL:
        from app.job_worker import run_job

        run_job(job_id)
        return {"triggered": True, "mode": "inline"}

    if _is_local_dev():
        return {"triggered": False, "mode": "local_manual"}

    missing = [
        name
        for name, value in {
            "CLOUD_RUN_PROJECT": Config.CLOUD_RUN_PROJECT,
            "CLOUD_RUN_REGION": Config.CLOUD_RUN_REGION,
            "QAOA_WORKER_JOB_NAME": Config.QAOA_WORKER_JOB_NAME,
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
    name = client.job_path(Config.CLOUD_RUN_PROJECT, Config.CLOUD_RUN_REGION, Config.QAOA_WORKER_JOB_NAME)
    overrides = run_v2.RunJobRequest.Overrides(
        container_overrides=[
            run_v2.RunJobRequest.Overrides.ContainerOverride(
                env=[run_v2.EnvVar(name="JOB_ID", value=job_id)],
            )
        ]
    )
    operation = client.run_job(request=run_v2.RunJobRequest(name=name, overrides=overrides))
    operation_name = getattr(getattr(operation, "operation", None), "name", None) or getattr(operation, "name", None)
    return {"triggered": True, "mode": "cloud_run_job", "operation": str(operation_name) if operation_name else None}


def _is_local_dev() -> bool:
    import os

    return os.getenv("QAOA_RQP_LOCAL_DEV") == "1"
