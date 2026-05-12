"""Job document storage for the Version 9 asynchronous API."""

from __future__ import annotations

import datetime as dt
import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import Config
from app.schemas import ApiError, json_safe
from app.worker_profiles import DEFAULT_WORKER_PROFILE, worker_profile_metadata


LOG_TAIL_LIMIT = 50


class JobStore:
    def create_job(self, job: dict[str, Any]) -> None:
        raise NotImplementedError

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        raise NotImplementedError

    def update_job(self, job_id: str, updates: dict[str, Any]) -> None:
        raise NotImplementedError

    def append_log(
        self,
        job_id: str,
        message: str,
        *,
        progress: dict[str, Any] | None = None,
        phase: str | None = None,
        extra_updates: dict[str, Any] | None = None,
    ) -> None:
        job = self.get_job(job_id) or {}
        raw_message = str(message)
        logs_tail = list(job.get("logs_tail") or [])
        logs_tail.append(_timestamped_log_message(raw_message))
        logs_tail = logs_tail[-LOG_TAIL_LIMIT:]
        updates: dict[str, Any] = {
            "latest_log": raw_message,
            "logs_tail": logs_tail,
            "heartbeat_at": _utc_now(),
        }
        if progress is not None:
            updates["progress"] = {**dict(job.get("progress") or {}), **progress}
        if phase is not None:
            updates["phase"] = phase
        if extra_updates:
            updates.update(json_safe(extra_updates))
        self.update_job(job_id, updates)

    def status_payload(self, job_id: str) -> dict[str, Any]:
        job = self.get_job(job_id)
        if job is None:
            raise ApiError(404, "job_not_found", "Job was not found.", {"job_id": job_id})
        return _status_payload(job)


class LocalJobStore(JobStore):
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def create_job(self, job: dict[str, Any]) -> None:
        self._write(str(job["job_id"]), job)

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        path = self._path(job_id)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ApiError(500, "job_document_invalid", "Stored job document is invalid JSON.") from exc

    def update_job(self, job_id: str, updates: dict[str, Any]) -> None:
        job = self.get_job(job_id)
        if job is None:
            raise ApiError(404, "job_not_found", "Job was not found.", {"job_id": job_id})
        _deep_merge(job, json_safe(updates))
        self._write(job_id, job)

    def _write(self, job_id: str, job: dict[str, Any]) -> None:
        path = self._path(job_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        tmp_path.write_text(json.dumps(json_safe(job), indent=2, sort_keys=True), encoding="utf-8")
        tmp_path.replace(path)

    def _path(self, job_id: str) -> Path:
        return self.root / str(job_id) / "job.json"


class FirestoreJobStore(JobStore):
    def __init__(self, client=None):
        self.client = client if client is not None else _firestore_client()

    def create_job(self, job: dict[str, Any]) -> None:
        payload = json_safe(job)
        payload["created_at"] = _server_timestamp()
        self._doc(str(job["job_id"])).set(payload, merge=True)

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        snapshot = self._doc(job_id).get()
        if not getattr(snapshot, "exists", False):
            return None
        payload = snapshot.to_dict() or {}
        payload.setdefault("job_id", job_id)
        return payload

    def update_job(self, job_id: str, updates: dict[str, Any]) -> None:
        self._doc(job_id).set(json_safe(updates), merge=True)

    def _doc(self, job_id: str):
        return self.client.collection(Config.FIRESTORE_JOB_COLLECTION).document(str(job_id))


def get_job_store() -> JobStore:
    mode = Config.job_store_mode()
    if mode == "local":
        return LocalJobStore(Config.LOCAL_JOB_DIR)
    if mode == "firestore":
        return FirestoreJobStore()
    raise ApiError(500, "job_store_invalid", "QAOA_JOB_STORE must be 'firestore', 'local', or 'auto'.")


def initial_job_document(
    *,
    job_id: str,
    mode: str,
    response_level: str,
    settings: dict[str, Any],
    input_info: dict[str, Any],
    usage_context,
    policy_result,
    lock_type: str,
    key_hash: str | None,
    worker_profile: str = DEFAULT_WORKER_PROFILE,
) -> dict[str, Any]:
    profile_metadata = worker_profile_metadata(worker_profile)
    return json_safe(
        {
            "job_id": job_id,
            "key_hash": key_hash,
            "key_id": (usage_context.key_record or {}).get("key_id") if usage_context.authenticated else "anonymous",
            "authenticated": bool(usage_context.authenticated),
            "usage_level": usage_context.usage_level_name,
            "lock": {
                "type": lock_type,
                "key_id": (usage_context.key_record or {}).get("key_id") if usage_context.authenticated else None,
                "run_id": job_id,
            },
            "status": "queued",
            "phase": "queued",
            "created_at": _utc_now(),
            "started_at": None,
            "heartbeat_at": _utc_now(),
            "finished_at": None,
            "settings": settings,
            "input": input_info,
            "policy": {
                "n_qubits": policy_result.n_qubits,
                "candidate_count": policy_result.candidate_count,
                "estimated_runtime_sec": policy_result.estimated_runtime_sec,
                "max_estimated_runtime_sec": policy_result.max_estimated_runtime_sec,
                "runtime_limit_source": policy_result.runtime_limit_source,
            },
            "progress": {
                "progress_pct": 0.0,
                "iteration": None,
                "max_iterations": policy_result.runtime_inputs.iterations,
                "elapsed_seconds": None,
                "eta_seconds_low": None,
                "eta_seconds_high": None,
            },
            "latest_log": "Job queued.",
            "logs_tail": [_timestamped_log_message("Job queued.")],
            "result": {
                "available": False,
                "storage_path": None,
                "summary": None,
            },
            "error": None,
            "cancel_requested": False,
            "mode": mode,
            "response_level": response_level,
            **profile_metadata,
        }
    )


def _status_payload(job: dict[str, Any]) -> dict[str, Any]:
    result = job.get("result") or {}
    memory_history = job.get("memory_history")
    return json_safe(
        {
            "job_id": job.get("job_id"),
            "status": job.get("status"),
            "phase": job.get("phase"),
            "progress": job.get("progress") or {},
            "latest_log": job.get("latest_log"),
            "logs_tail": job.get("logs_tail") or [],
            "created_at": job.get("created_at"),
            "started_at": job.get("started_at"),
            "heartbeat_at": job.get("heartbeat_at"),
            "finished_at": job.get("finished_at"),
            "result_available": bool(result.get("available")),
            "result": result,
            "worker_profile": job.get("worker_profile"),
            "worker_profile_label": job.get("worker_profile_label"),
            "configured_cpu": job.get("configured_cpu"),
            "configured_memory_gib": job.get("configured_memory_gib"),
            "worker_job_name": job.get("worker_job_name"),
            "memory_used_gib": job.get("memory_used_gib"),
            "memory_limit_gib": job.get("memory_limit_gib"),
            "memory_remaining_gib": job.get("memory_remaining_gib"),
            "memory_used_pct": job.get("memory_used_pct"),
            "peak_memory_used_gib": job.get("peak_memory_used_gib"),
            "memory_history": memory_history if isinstance(memory_history, list) else [],
            "error": job.get("error"),
        }
    )


def _deep_merge(target: dict[str, Any], updates: dict[str, Any]) -> None:
    for key, value in updates.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _deep_merge(target[key], value)
        else:
            target[key] = value


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _timestamped_log_message(message: str) -> str:
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%H:%M:%S UTC")
    text = str(message)
    if text.startswith("[") and "]" in text[:24]:
        return text
    return f"[{stamp}] {text}"


@lru_cache(maxsize=1)
def _firestore_client():
    try:
        from google.cloud import firestore
    except ImportError as exc:
        raise ApiError(
            500,
            "firestore_dependency_missing",
            "Firestore job storage requires google-cloud-firestore to be installed.",
        ) from exc
    project = os.getenv("QAOA_FIRESTORE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT") or None
    return firestore.Client(project=project)


def _server_timestamp():
    try:
        from google.cloud import firestore

        return firestore.SERVER_TIMESTAMP
    except Exception:
        return _utc_now()
