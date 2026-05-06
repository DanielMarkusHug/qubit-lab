"""Input/result object storage for Version 9 jobs."""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any

from app.config import Config
from app.schemas import ApiError, json_safe


class JobStorage:
    def save_input_from_path(self, job_id: str, source_path: Path, original_filename: str | None) -> dict[str, Any]:
        raise NotImplementedError

    def download_input_to(self, storage_path: str, destination_path: Path) -> None:
        raise NotImplementedError

    def write_result_json(self, job_id: str, payload: dict[str, Any]) -> str:
        raise NotImplementedError

    def read_result_json(self, storage_path: str) -> dict[str, Any]:
        raise NotImplementedError


class LocalJobStorage(JobStorage):
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def save_input_from_path(self, job_id: str, source_path: Path, original_filename: str | None) -> dict[str, Any]:
        suffix = Path(original_filename or "input.xlsx").suffix or ".xlsx"
        destination = self.root / str(job_id) / f"input{suffix}"
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_path, destination)
        return {
            "storage_path": str(destination),
            "original_filename": original_filename,
            "storage_mode": "local",
        }

    def download_input_to(self, storage_path: str, destination_path: Path) -> None:
        shutil.copyfile(Path(storage_path), destination_path)

    def write_result_json(self, job_id: str, payload: dict[str, Any]) -> str:
        destination = self.root / str(job_id) / "result.json"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(json_safe(payload), indent=2, sort_keys=True), encoding="utf-8")
        return str(destination)

    def read_result_json(self, storage_path: str) -> dict[str, Any]:
        return json.loads(Path(storage_path).read_text(encoding="utf-8"))


class GcsJobStorage(JobStorage):
    def __init__(self, bucket_name: str | None = None, client=None):
        self.bucket_name = bucket_name or Config.job_bucket()
        if not self.bucket_name:
            raise ApiError(500, "job_bucket_missing", "QAOA_JOB_BUCKET is required for GCS job storage.")
        self.client = client if client is not None else _storage_client()
        self.bucket = self.client.bucket(self.bucket_name)

    def save_input_from_path(self, job_id: str, source_path: Path, original_filename: str | None) -> dict[str, Any]:
        blob_name = f"jobs/{job_id}/input.xlsx"
        self.bucket.blob(blob_name).upload_from_filename(str(source_path))
        return {
            "storage_path": f"gs://{self.bucket_name}/{blob_name}",
            "original_filename": original_filename,
            "storage_mode": "gcs",
        }

    def download_input_to(self, storage_path: str, destination_path: Path) -> None:
        bucket_name, blob_name = _parse_gs_path(storage_path)
        self.client.bucket(bucket_name).blob(blob_name).download_to_filename(str(destination_path))

    def write_result_json(self, job_id: str, payload: dict[str, Any]) -> str:
        blob_name = f"jobs/{job_id}/result.json"
        self.bucket.blob(blob_name).upload_from_string(
            json.dumps(json_safe(payload), sort_keys=True),
            content_type="application/json",
        )
        return f"gs://{self.bucket_name}/{blob_name}"

    def read_result_json(self, storage_path: str) -> dict[str, Any]:
        bucket_name, blob_name = _parse_gs_path(storage_path)
        return json.loads(self.client.bucket(bucket_name).blob(blob_name).download_as_text())


def get_job_storage() -> JobStorage:
    mode = Config.job_storage_mode()
    if mode == "local":
        return LocalJobStorage(Config.LOCAL_JOB_DIR)
    if mode == "gcs":
        return GcsJobStorage()
    raise ApiError(500, "job_storage_invalid", "QAOA_JOB_STORAGE must be 'gcs', 'local', or 'auto'.")


def _parse_gs_path(path: str) -> tuple[str, str]:
    if not str(path).startswith("gs://"):
        raise ApiError(500, "invalid_storage_path", "Expected a gs:// storage path.")
    without_scheme = str(path)[5:]
    bucket, _, blob = without_scheme.partition("/")
    if not bucket or not blob:
        raise ApiError(500, "invalid_storage_path", "GCS storage path is missing bucket or object name.")
    return bucket, blob


def _storage_client():
    try:
        from google.cloud import storage
    except ImportError as exc:
        raise ApiError(500, "gcs_dependency_missing", "GCS job storage requires google-cloud-storage.") from exc
    project = os.getenv("QAOA_FIRESTORE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT") or None
    return storage.Client(project=project)
