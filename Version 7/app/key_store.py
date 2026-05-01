"""API-key storage backends for Version 7.

The route layer asks for a key record by HMAC hash. Local development can keep
using YAML, while production can use Firestore without changing API behavior.
"""

from __future__ import annotations

import hmac
import os
from functools import lru_cache
from typing import Any

from app.config import Config
from app.schemas import ApiError


class ApiKeyStore:
    def find_key_by_hash(self, key_hash: str) -> dict[str, Any] | None:
        raise NotImplementedError


class LocalYamlApiKeyStore(ApiKeyStore):
    def __init__(self, key_store: dict[str, Any]):
        self.key_store = key_store

    def find_key_by_hash(self, key_hash: str) -> dict[str, Any] | None:
        for candidate in self.key_store.get("keys", []):
            stored_hash = str(candidate.get("key_hash", ""))
            if stored_hash and hmac.compare_digest(key_hash, stored_hash):
                return _safe_key_record(candidate, store="local")
        return None


class FirestoreApiKeyStore(ApiKeyStore):
    def __init__(self, client=None):
        self.client = client if client is not None else _firestore_client()

    def find_key_by_hash(self, key_hash: str) -> dict[str, Any] | None:
        query = self.client.collection(Config.FIRESTORE_KEY_COLLECTION).where("key_hash", "==", key_hash).limit(10)
        for snapshot in query.stream():
            raw = snapshot.to_dict() or {}
            raw.setdefault("key_id", snapshot.id)
            stored_hash = str(raw.get("key_hash", ""))
            if stored_hash and hmac.compare_digest(key_hash, stored_hash):
                record = _safe_key_record(raw, store="firestore")
                record["_firestore_doc_id"] = snapshot.id
                return record
        return None


def get_key_store() -> ApiKeyStore:
    mode = Config.key_store_mode()
    if mode == "local":
        from app.usage_policy import load_key_store

        return LocalYamlApiKeyStore(load_key_store())
    if mode == "firestore":
        return FirestoreApiKeyStore()
    raise ApiError(500, "key_store_invalid", "QAOA_KEY_STORE must be 'firestore', 'yaml', or 'auto'.")


def clear_key_store_cache() -> None:
    _firestore_client.cache_clear()


def _safe_key_record(raw: dict[str, Any], store: str) -> dict[str, Any]:
    allowed = {
        "key_id",
        "level",
        "usage_level",
        "display_name",
        "name",
        "email",
        "organization",
        "status",
        "max_runs",
        "used_runs",
        "remaining_runs",
        "expires_at",
        "created_at",
        "updated_at",
        "notes",
        "created_by",
        "general_limits",
        "qaoa_limited_limits",
        "active_run_id",
        "active_run_started_at",
        "active_run_status",
        "max_parallel_runs",
        "active_run_user_agent",
        "active_run_ip",
    }
    record = {key: value for key, value in dict(raw).items() if key in allowed}
    if "usage_level" in record and "level" not in record:
        record["level"] = record["usage_level"]
    if "level" in record and "usage_level" not in record:
        record["usage_level"] = record["level"]
    if "remaining_runs" not in record and "max_runs" in record:
        try:
            record["remaining_runs"] = max(int(record.get("max_runs") or 0) - int(record.get("used_runs") or 0), 0)
        except (TypeError, ValueError):
            pass
    record.setdefault("max_parallel_runs", 1)
    record.setdefault("active_run_id", None)
    record.setdefault("active_run_started_at", None)
    record.setdefault("active_run_status", None)
    record["_key_store"] = store
    return record


@lru_cache(maxsize=1)
def _firestore_client():
    firestore = _firestore_module()
    project = os.getenv("QAOA_FIRESTORE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT") or None
    return firestore.Client(project=project)


def _firestore_module():
    try:
        from google.cloud import firestore
    except ImportError as exc:
        raise ApiError(
            500,
            "firestore_dependency_missing",
            "Firestore mode requires google-cloud-firestore to be installed.",
        ) from exc
    return firestore
