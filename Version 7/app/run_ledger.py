"""Run ledger abstraction for Version 7.

The public interface stays small so local JSON and Firestore-backed usage
tracking can be swapped without changing API route behavior.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import threading
import time
from collections import Counter
from pathlib import Path
from typing import Any

from app.config import Config
from app.schemas import ApiError, json_safe


_LOCK = threading.Lock()
_LOCAL_ACTIVE_RUNS: dict[str, dict[str, Any]] = {}
_LOCAL_PUBLIC_RUNS: dict[str, dict[str, Any]] = {}


class RunLedger:
    enabled = False

    def get_key_usage(self, key_id: str | None) -> int:
        return 0

    def can_consume_run(self, key_record: dict[str, Any] | None) -> bool:
        remaining = self.get_remaining_runs(key_record)
        return remaining is None or remaining > 0

    def consume_run(self, key_record: dict[str, Any] | None, run_id: str) -> bool:
        return True if key_record else False

    def acquire_run_lock(
        self,
        key_record: dict[str, Any] | None,
        run_id: str,
        policy_result=None,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        if not key_record:
            return {"acquired": False, "skipped": True, "reason": "anonymous_or_public"}

        key_id = str(key_record.get("key_id") or "")
        if not key_id:
            return {"acquired": False, "skipped": True, "reason": "missing_key_id"}

        now = dt.datetime.now(dt.timezone.utc)
        stale_after_sec = _lock_stale_after_sec(policy_result)
        with _LOCK:
            active = _LOCAL_ACTIVE_RUNS.get(key_id)
            stale_lock_cleared = bool(active) and _active_lock_is_stale(
                active.get("active_run_started_at"),
                stale_after_sec,
                now,
            )
            if active and not stale_lock_cleared:
                _raise_active_run_exists(key_id, active, stale_after_sec)

            lock_record = {
                "active_run_id": run_id,
                "active_run_started_at": now,
                "active_run_status": "running",
                "max_parallel_runs": _max_parallel_runs(key_record),
                "active_run_user_agent": user_agent,
                "active_run_ip": ip_address,
            }
            _LOCAL_ACTIVE_RUNS[key_id] = lock_record
            key_record.update(lock_record)
            return {
                "acquired": True,
                "store": "local_memory",
                "stale_lock_cleared": stale_lock_cleared,
                "stale_after_sec": stale_after_sec,
                "previous_active_run_id": (active or {}).get("active_run_id"),
            }

    def release_run_lock(self, key_record: dict[str, Any] | None, run_id: str) -> bool:
        if not key_record:
            return False
        key_id = str(key_record.get("key_id") or "")
        if not key_id:
            return False
        with _LOCK:
            active = _LOCAL_ACTIVE_RUNS.get(key_id)
            if not active or active.get("active_run_id") != run_id:
                return False
            _LOCAL_ACTIVE_RUNS.pop(key_id, None)
            _clear_active_run_fields(key_record)
            return True

    def acquire_public_run_slot(
        self,
        usage_context,
        run_id: str,
        *,
        policy_result=None,
        mode: str | None = None,
        response_level: str | None = None,
        filename: str | None = None,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        max_parallel_runs = _public_max_parallel_runs(usage_context)
        now = dt.datetime.now(dt.timezone.utc)
        stale_after_sec = _lock_stale_after_sec(policy_result)
        with _LOCK:
            stale_run_ids = [
                active_run_id
                for active_run_id, record in _LOCAL_PUBLIC_RUNS.items()
                if record.get("status") == "running"
                and _active_lock_is_stale(record.get("started_at"), stale_after_sec, now)
            ]
            for active_run_id in stale_run_ids:
                _LOCAL_PUBLIC_RUNS.pop(active_run_id, None)

            active_count = sum(1 for record in _LOCAL_PUBLIC_RUNS.values() if record.get("status") == "running")
            if active_count >= max_parallel_runs:
                _raise_public_capacity_exceeded(active_count, max_parallel_runs)

            _LOCAL_PUBLIC_RUNS[run_id] = _public_lock_record(
                run_id=run_id,
                now=now,
                stale_after_sec=stale_after_sec,
                mode=mode,
                response_level=response_level,
                filename=filename,
                policy_result=policy_result,
                user_agent=user_agent,
                ip_address=ip_address,
            )
            return {
                "acquired": True,
                "store": "local_memory",
                "active_public_runs": active_count + 1,
                "max_parallel_public_runs": max_parallel_runs,
                "stale_locks_cleared": len(stale_run_ids),
                "stale_after_sec": stale_after_sec,
            }

    def release_public_run_slot(self, run_id: str) -> bool:
        with _LOCK:
            active = _LOCAL_PUBLIC_RUNS.get(run_id)
            if not active or active.get("status") != "running":
                return False
            _LOCAL_PUBLIC_RUNS.pop(run_id, None)
            return True

    def get_remaining_runs(self, key_record: dict[str, Any] | None) -> int | None:
        max_runs = _int_or_none((key_record or {}).get("max_runs"))
        if max_runs is None:
            return None
        return max(max_runs - self.get_used_runs(key_record), 0)

    def get_used_runs(self, key_record: dict[str, Any] | None) -> int | None:
        if not key_record:
            return None
        base_used = _int_or_zero(key_record.get("used_runs"))
        return base_used + self.get_key_usage(str(key_record.get("key_id", "")))

    def record_run_started(self, **_kwargs) -> None:
        return None

    def record_run_completed(self, **_kwargs) -> None:
        return None

    def record_run_rejected(self, **_kwargs) -> None:
        return None

    def record_run_failed(self, **_kwargs) -> None:
        return None

    def license_status(self, usage_context) -> dict[str, Any]:
        return _license_status(self, usage_context)

    def safe_license_summary(self, usage_context) -> dict[str, Any]:
        status = self.license_status(usage_context)
        return {
            key: status.get(key)
            for key in ("authenticated", "key_id", "usage_level", "usage_level_id", "remaining_runs")
            if key in status
        }

    def summary(self) -> dict[str, Any]:
        return _empty_summary()


class JsonRunLedger(RunLedger):
    enabled = True

    def __init__(self, path: Path):
        self.path = Path(path)
        self._started: dict[str, dict[str, Any]] = {}

    def get_key_usage(self, key_id: str | None) -> int:
        if not key_id:
            return 0
        runs = self._read_runs()
        return sum(1 for run in runs if run.get("key_id") == key_id and bool(run.get("consumed_run")))

    def consume_run(self, key_record: dict[str, Any] | None, run_id: str) -> bool:
        if not key_record:
            return False
        if not self.can_consume_run(key_record):
            return False
        self._started.setdefault(run_id, {})["consumed_run"] = True
        return True

    def record_run_started(self, **kwargs) -> None:
        run_id = str(kwargs["run_id"])
        self._started[run_id] = {
            "timestamp_start_utc": _utc_now(),
            "start_monotonic": time.perf_counter(),
            **_base_run_fields(**kwargs),
        }

    def record_run_completed(self, **kwargs) -> None:
        self._append_final_run("completed", kwargs)

    def record_run_rejected(self, **kwargs) -> None:
        self._append_final_run("rejected", kwargs)

    def record_run_failed(self, **kwargs) -> None:
        self._append_final_run("failed", kwargs)

    def summary(self) -> dict[str, Any]:
        runs = self._read_runs()
        status_counts = Counter(run.get("status") for run in runs)
        runs_by_key_id = Counter(str(run.get("key_id") or "anonymous") for run in runs)
        runs_by_usage_level = Counter(str(run.get("usage_level") or "unknown") for run in runs)
        return json_safe(
            {
                "enabled": True,
                "ledger_path": str(self.path),
                "total_runs": len(runs),
                "completed_runs": int(status_counts.get("completed", 0)),
                "rejected_runs": int(status_counts.get("rejected", 0)),
                "failed_runs": int(status_counts.get("failed", 0)),
                "consumed_runs": sum(1 for run in runs if bool(run.get("consumed_run"))),
                "runs_by_key_id": dict(runs_by_key_id),
                "runs_by_usage_level": dict(runs_by_usage_level),
            }
        )

    def _append_final_run(self, status: str, kwargs: dict[str, Any]) -> None:
        run_id = str(kwargs["run_id"])
        started = self._started.pop(run_id, {})
        record = {
            **{key: value for key, value in started.items() if key != "start_monotonic"},
            **_base_run_fields(**kwargs),
            "run_id": run_id,
            "timestamp_start_utc": kwargs.get("timestamp_start_utc") or started.get("timestamp_start_utc") or _utc_now(),
            "timestamp_end_utc": _utc_now(),
            "created_at": kwargs.get("timestamp_start_utc") or started.get("timestamp_start_utc") or _utc_now(),
            "status": status,
            "actual_runtime_sec": _float_or_none(kwargs.get("actual_runtime_sec")),
            "consumed_run": bool(kwargs.get("consumed_run", started.get("consumed_run", False))),
        }
        estimated = _float_or_none(record.get("estimated_runtime_sec"))
        actual = _float_or_none(record.get("actual_runtime_sec"))
        record["runtime_ratio"] = actual / estimated if actual is not None and estimated and estimated > 0 else None
        if status == "rejected":
            record["rejection_code"] = kwargs.get("rejection_code")
            record["error_code"] = kwargs.get("rejection_code")
        if status == "failed":
            record["error_code"] = kwargs.get("error_code")
        self._append_run(record)

    def _read_runs(self) -> list[dict[str, Any]]:
        with _LOCK:
            if not self.path.exists():
                return []
            try:
                data = json.loads(self.path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                return []
            runs = data.get("runs", [])
            return runs if isinstance(runs, list) else []

    def _append_run(self, record: dict[str, Any]) -> None:
        with _LOCK:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            if self.path.exists():
                try:
                    data = json.loads(self.path.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    data = {}
            else:
                data = {}
            runs = data.get("runs", [])
            if not isinstance(runs, list):
                runs = []
            runs.append(json_safe(record))
            tmp_path = self.path.with_suffix(self.path.suffix + ".tmp")
            tmp_path.write_text(json.dumps({"runs": runs}, indent=2, sort_keys=True), encoding="utf-8")
            tmp_path.replace(self.path)


class NoOpRunLedger(RunLedger):
    def summary(self) -> dict[str, Any]:
        summary = _empty_summary()
        summary["enabled"] = False
        return summary


class FirestoreRunLedger(RunLedger):
    enabled = True

    def __init__(self, client=None, transactional=None):
        self.client = client if client is not None else _firestore_client()
        self._transactional = transactional if transactional is not None else (_firestore_transactional() if client is None else None)

    def can_consume_run(self, key_record: dict[str, Any] | None) -> bool:
        if not key_record:
            return True

        def check(transaction):
            snapshot = self._key_ref(key_record).get(transaction=transaction)
            if not getattr(snapshot, "exists", True):
                return False
            record = snapshot.to_dict() or {}
            if not _record_active(record):
                return False
            remaining_runs = _int_or_none(record.get("remaining_runs"))
            if remaining_runs is not None and remaining_runs <= 0:
                return False
            max_runs = _int_or_none(record.get("max_runs"))
            if max_runs is None:
                return True
            return _int_or_zero(record.get("used_runs")) < max_runs

        return bool(self._run_transaction(check))

    def consume_run(self, key_record: dict[str, Any] | None, run_id: str) -> bool:
        if not key_record:
            return False

        def consume(transaction):
            key_ref = self._key_ref(key_record)
            snapshot = key_ref.get(transaction=transaction)
            if not getattr(snapshot, "exists", True):
                return False
            record = snapshot.to_dict() or {}
            if not _record_active(record):
                return False
            used_runs = _int_or_zero(record.get("used_runs"))
            max_runs = _int_or_none(record.get("max_runs"))
            remaining_runs = _int_or_none(record.get("remaining_runs"))
            if remaining_runs is not None and remaining_runs <= 0:
                return False
            if max_runs is not None and used_runs >= max_runs:
                return False
            updated_used_runs = used_runs + 1
            updated_remaining_runs = max(max_runs - updated_used_runs, 0) if max_runs is not None else None
            updates = {
                "used_runs": updated_used_runs,
                "updated_at": _server_timestamp(),
            }
            if updated_remaining_runs is not None:
                updates["remaining_runs"] = updated_remaining_runs
            transaction.update(key_ref, updates)
            key_record["used_runs"] = updated_used_runs
            if updated_remaining_runs is not None:
                key_record["remaining_runs"] = updated_remaining_runs
            return True

        return bool(self._run_transaction(consume))

    def acquire_run_lock(
        self,
        key_record: dict[str, Any] | None,
        run_id: str,
        policy_result=None,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        if not key_record:
            return {"acquired": False, "skipped": True, "reason": "anonymous_or_public"}

        now = dt.datetime.now(dt.timezone.utc)
        stale_after_sec = _lock_stale_after_sec(policy_result)

        def acquire(transaction):
            key_ref = self._key_ref(key_record)
            snapshot = key_ref.get(transaction=transaction)
            if not getattr(snapshot, "exists", True):
                raise ApiError(403, "api_key_not_found", "API key record was not found.")
            record = snapshot.to_dict() or {}
            if not _record_active(record):
                raise ApiError(403, "api_key_inactive", "API key is inactive.")

            key_id = str(record.get("key_id") or key_record.get("key_id") or "")
            active_run_id = record.get("active_run_id")
            active_started_at = record.get("active_run_started_at")
            active = {
                "active_run_id": active_run_id,
                "active_run_started_at": active_started_at,
                "active_run_status": record.get("active_run_status"),
                "max_parallel_runs": _max_parallel_runs(record),
            }
            stale_lock_cleared = bool(active_run_id) and _active_lock_is_stale(
                active_started_at,
                stale_after_sec,
                now,
            )
            if active_run_id and not stale_lock_cleared:
                _raise_active_run_exists(key_id, active, stale_after_sec)

            updates = {
                "active_run_id": run_id,
                "active_run_started_at": now,
                "active_run_status": "running",
                "max_parallel_runs": _max_parallel_runs(record),
                "active_run_user_agent": user_agent,
                "active_run_ip": ip_address,
                "updated_at": _server_timestamp(),
            }
            transaction.update(key_ref, updates)
            key_record.update(updates)
            return {
                "acquired": True,
                "store": "firestore",
                "stale_lock_cleared": stale_lock_cleared,
                "stale_after_sec": stale_after_sec,
                "previous_active_run_id": active_run_id if stale_lock_cleared else None,
            }

        return self._run_transaction(acquire)

    def release_run_lock(self, key_record: dict[str, Any] | None, run_id: str) -> bool:
        if not key_record:
            return False

        def release(transaction):
            key_ref = self._key_ref(key_record)
            snapshot = key_ref.get(transaction=transaction)
            if not getattr(snapshot, "exists", True):
                return False
            record = snapshot.to_dict() or {}
            if record.get("active_run_id") != run_id:
                return False
            transaction.update(
                key_ref,
                {
                    "active_run_id": None,
                    "active_run_started_at": None,
                    "active_run_status": None,
                    "active_run_user_agent": None,
                    "active_run_ip": None,
                    "updated_at": _server_timestamp(),
                },
            )
            _clear_active_run_fields(key_record)
            return True

        return bool(self._run_transaction(release))

    def acquire_public_run_slot(
        self,
        usage_context,
        run_id: str,
        *,
        policy_result=None,
        mode: str | None = None,
        response_level: str | None = None,
        filename: str | None = None,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        self._cleanup_stale_public_locks(policy_result)
        max_parallel_runs = _public_max_parallel_runs(usage_context)
        now = dt.datetime.now(dt.timezone.utc)
        stale_after_sec = _lock_stale_after_sec(policy_result)
        lock_record = _public_lock_record(
            run_id=run_id,
            now=now,
            stale_after_sec=stale_after_sec,
            mode=mode,
            response_level=response_level,
            filename=filename,
            policy_result=policy_result,
            user_agent=user_agent,
            ip_address=ip_address,
        )

        def acquire(transaction):
            state_ref = self._public_state_ref()
            state_snapshot = state_ref.get(transaction=transaction)
            state = state_snapshot.to_dict() if getattr(state_snapshot, "exists", False) else {}
            active_count = max(0, _int_or_zero((state or {}).get("active_count")))
            if active_count >= max_parallel_runs:
                _raise_public_capacity_exceeded(active_count, max_parallel_runs)

            transaction.set(
                self._public_lock_ref(run_id),
                lock_record,
                merge=True,
            )
            transaction.set(
                state_ref,
                {
                    "active_count": active_count + 1,
                    "max_parallel_runs": max_parallel_runs,
                    "updated_at": _server_timestamp(),
                },
                merge=True,
            )
            return {
                "acquired": True,
                "store": "firestore",
                "active_public_runs": active_count + 1,
                "max_parallel_public_runs": max_parallel_runs,
                "stale_after_sec": stale_after_sec,
            }

        return self._run_transaction(acquire)

    def release_public_run_slot(self, run_id: str) -> bool:
        def release(transaction):
            state_ref = self._public_state_ref()
            lock_ref = self._public_lock_ref(run_id)
            lock_snapshot = lock_ref.get(transaction=transaction)
            if not getattr(lock_snapshot, "exists", False):
                return False
            lock_record = lock_snapshot.to_dict() or {}
            if lock_record.get("run_id") != run_id or lock_record.get("status") != "running":
                return False

            state_snapshot = state_ref.get(transaction=transaction)
            state = state_snapshot.to_dict() if getattr(state_snapshot, "exists", False) else {}
            active_count = max(0, _int_or_zero((state or {}).get("active_count")))
            transaction.set(
                lock_ref,
                {
                    "status": "released",
                    "released_at": _server_timestamp(),
                },
                merge=True,
            )
            transaction.set(
                state_ref,
                {
                    "active_count": max(active_count - 1, 0),
                    "updated_at": _server_timestamp(),
                },
                merge=True,
            )
            return True

        return bool(self._run_transaction(release))

    def record_run_completed(self, **kwargs) -> None:
        self._write_run("completed", kwargs)

    def record_run_rejected(self, **kwargs) -> None:
        self._write_run("rejected", kwargs)

    def record_run_failed(self, **kwargs) -> None:
        self._write_run("failed", kwargs)

    def summary(self) -> dict[str, Any]:
        runs = [snapshot.to_dict() or {} for snapshot in self.client.collection(Config.FIRESTORE_USAGE_COLLECTION).stream()]
        status_counts = Counter(run.get("status") for run in runs)
        runs_by_key_id = Counter(str(run.get("key_id") or "anonymous") for run in runs)
        runs_by_usage_level = Counter(str(run.get("usage_level") or "unknown") for run in runs)
        return json_safe(
            {
                "enabled": True,
                "store": "firestore",
                "total_runs": len(runs),
                "completed_runs": int(status_counts.get("completed", 0)),
                "rejected_runs": int(status_counts.get("rejected", 0)),
                "failed_runs": int(status_counts.get("failed", 0)),
                "consumed_runs": sum(1 for run in runs if bool(run.get("consumed_run"))),
                "runs_by_key_id": dict(runs_by_key_id),
                "runs_by_usage_level": dict(runs_by_usage_level),
            }
        )

    def _write_run(self, status: str, kwargs: dict[str, Any]) -> None:
        run_id = str(kwargs["run_id"])
        record = _run_record(status, kwargs)
        self.client.collection(Config.FIRESTORE_USAGE_COLLECTION).document(run_id).set(record, merge=True)

    def _key_ref(self, key_record: dict[str, Any]):
        doc_id = key_record.get("_firestore_doc_id") or key_record.get("key_id")
        return self.client.collection(Config.FIRESTORE_KEY_COLLECTION).document(str(doc_id))

    def _public_state_ref(self):
        return self.client.collection(Config.FIRESTORE_PUBLIC_RUN_STATE_COLLECTION).document("global")

    def _public_lock_ref(self, run_id: str):
        return self.client.collection(Config.FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION).document(str(run_id))

    def _cleanup_stale_public_locks(self, policy_result=None) -> int:
        stale_after_sec = _lock_stale_after_sec(policy_result)
        now = dt.datetime.now(dt.timezone.utc)
        try:
            snapshots = list(self.client.collection(Config.FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION).stream())
        except Exception:
            return 0

        stale_run_ids = []
        for snapshot in snapshots:
            record = snapshot.to_dict() or {}
            if record.get("status") != "running":
                continue
            if _active_lock_is_stale(record.get("started_at"), stale_after_sec, now):
                stale_run_ids.append(str(record.get("run_id") or getattr(snapshot, "id", "")))

        if not stale_run_ids:
            return 0

        def cleanup(transaction):
            state_ref = self._public_state_ref()
            state_snapshot = state_ref.get(transaction=transaction)
            state = state_snapshot.to_dict() if getattr(state_snapshot, "exists", False) else {}
            active_count = max(0, _int_or_zero((state or {}).get("active_count")))
            cleared = 0
            for stale_run_id in stale_run_ids:
                if not stale_run_id:
                    continue
                lock_ref = self._public_lock_ref(stale_run_id)
                lock_snapshot = lock_ref.get(transaction=transaction)
                if not getattr(lock_snapshot, "exists", False):
                    continue
                lock_record = lock_snapshot.to_dict() or {}
                if lock_record.get("status") != "running":
                    continue
                if not _active_lock_is_stale(lock_record.get("started_at"), stale_after_sec, now):
                    continue
                transaction.set(
                    lock_ref,
                    {
                        "status": "stale_released",
                        "released_at": _server_timestamp(),
                    },
                    merge=True,
                )
                cleared += 1
            if cleared:
                transaction.set(
                    state_ref,
                    {
                        "active_count": max(active_count - cleared, 0),
                        "updated_at": _server_timestamp(),
                    },
                    merge=True,
                )
            return cleared

        return int(self._run_transaction(cleanup) or 0)

    def _run_transaction(self, callback):
        transaction = self.client.transaction()
        if self._transactional is not None:
            return self._transactional(callback)(transaction)
        return callback(transaction)


def get_run_ledger() -> RunLedger:
    mode = Config.ledger_store_mode()
    if mode == "local":
        return JsonRunLedger(_ledger_path())
    if mode == "firestore":
        return FirestoreRunLedger()
    if mode == "disabled":
        return NoOpRunLedger()
    raise ValueError("QAOA_RQP_LEDGER_STORE must be 'local', 'firestore', or 'disabled'.")


def _ledger_path() -> Path:
    override = os.getenv("QAOA_RQP_LEDGER_PATH")
    if override:
        return Path(override)
    return Config.DATA_DIR / "run_ledger.json"


def _license_status(ledger: RunLedger, usage_context) -> dict[str, Any]:
    usage_level = usage_context.usage_level
    key_record = usage_context.key_record or {}
    general_limits = {
        "max_qubits": usage_level.get("max_qubits"),
        "max_layers": usage_level.get("max_layers"),
        "max_iterations": usage_level.get("max_iterations"),
        "max_restarts": usage_level.get("max_restarts"),
        "max_estimated_runtime_sec": usage_level.get("max_estimated_runtime_sec"),
        "max_upload_mb": usage_level.get("max_upload_mb"),
        "max_parallel_runs": usage_level.get("max_parallel_runs"),
    }
    qaoa_limited_limits = usage_level.get("qaoa_limited_limits")
    payload = {
        "authenticated": bool(usage_context.authenticated),
        "usage_level": usage_context.usage_level_name,
        "usage_level_id": usage_level.get("level_id"),
        "display_name": usage_level.get("display_name"),
        "allowed_modes": usage_level.get("allowed_modes", []),
        "allowed_response_levels": usage_level.get("allowed_response_levels", []),
        "general_limits": general_limits,
        "qaoa_limited_limits": qaoa_limited_limits,
        "max_estimated_runtime_sec": usage_level.get("max_estimated_runtime_sec"),
        "limits": {
            **general_limits,
            "qaoa_limited": qaoa_limited_limits,
        },
    }
    if not usage_context.authenticated:
        payload.update(
            {
                "key_id": "anonymous",
                "status": "public",
                "max_runs": None,
                "used_runs": None,
                "remaining_runs": None,
                "expires_at": None,
            }
        )
        return json_safe(payload)

    payload.update(
        {
            "key_id": key_record.get("key_id"),
            "display_name": key_record.get("display_name") or usage_level.get("display_name"),
            "status": key_record.get("status"),
            "max_runs": _int_or_none(key_record.get("max_runs")),
            "used_runs": ledger.get_used_runs(key_record),
            "remaining_runs": ledger.get_remaining_runs(key_record),
            "expires_at": key_record.get("expires_at"),
            "max_parallel_runs": _max_parallel_runs(key_record),
            "active_run_id": key_record.get("active_run_id"),
            "active_run_started_at": key_record.get("active_run_started_at"),
            "active_run_status": key_record.get("active_run_status"),
        }
    )
    if usage_level.get("show_identity", False):
        payload.update(
            {
                "name": key_record.get("name"),
                "email": key_record.get("email"),
                "organization": key_record.get("organization"),
            }
        )
    return json_safe(payload)


def _run_record(status: str, kwargs: dict[str, Any]) -> dict[str, Any]:
    record = {
        **_base_run_fields(**kwargs),
        "run_id": kwargs.get("run_id"),
        "timestamp_start_utc": kwargs.get("timestamp_start_utc") or _utc_now(),
        "timestamp_end_utc": _utc_now(),
        "timestamp": kwargs.get("timestamp_start_utc") or _utc_now(),
        "created_at": kwargs.get("timestamp_start_utc") or _utc_now(),
        "status": status,
        "actual_runtime_sec": _float_or_none(kwargs.get("actual_runtime_sec")),
        "consumed_run": bool(kwargs.get("consumed_run", False)),
        "service_version": Config.VERSION,
    }
    estimated = _float_or_none(record.get("estimated_runtime_sec"))
    actual = _float_or_none(record.get("actual_runtime_sec"))
    record["runtime_ratio"] = actual / estimated if actual is not None and estimated and estimated > 0 else None
    if status == "rejected":
        record["rejection_code"] = kwargs.get("rejection_code")
        record["error_code"] = kwargs.get("rejection_code")
    if status == "failed":
        record["error_code"] = kwargs.get("error_code")
    if kwargs.get("error_message"):
        record["error_message"] = kwargs.get("error_message")
    return json_safe(record)


def _base_run_fields(**kwargs) -> dict[str, Any]:
    usage_context = kwargs.get("usage_context")
    policy_result = kwargs.get("policy_result")
    optimizer = kwargs.get("optimizer")
    runtime_inputs = getattr(policy_result, "runtime_inputs", None)
    n_qubits = _binary_variables(optimizer, getattr(policy_result, "n_qubits", kwargs.get("n_qubits")))
    return {
        "run_id": kwargs.get("run_id"),
        "active_run_id": kwargs.get("active_run_id") or kwargs.get("run_id"),
        "key_id": _key_id(usage_context),
        "usage_level": getattr(usage_context, "usage_level_name", "unknown"),
        "mode": kwargs.get("mode"),
        "response_level": kwargs.get("response_level"),
        "filename": kwargs.get("filename"),
        "binary_variables": n_qubits,
        "n_qubits": n_qubits,
        "layers": getattr(runtime_inputs, "layers", kwargs.get("layers")),
        "iterations": getattr(runtime_inputs, "iterations", kwargs.get("iterations")),
        "restarts": getattr(runtime_inputs, "restarts", kwargs.get("restarts")),
        "warm_start": getattr(runtime_inputs, "warm_start", kwargs.get("warm_start")),
        "qaoa_shots": _qaoa_shots(optimizer, kwargs.get("qaoa_shots")),
        "candidate_count": _candidate_count(optimizer, policy_result, kwargs.get("candidate_count")),
        "estimated_runtime_sec": _estimated_runtime(policy_result, kwargs.get("estimated_runtime_sec")),
        "solver": kwargs.get("solver"),
    }


def _key_id(usage_context) -> str:
    if usage_context is None or not getattr(usage_context, "authenticated", False):
        return "anonymous"
    key_record = getattr(usage_context, "key_record", {}) or {}
    return str(key_record.get("key_id") or "unknown")


def _binary_variables(optimizer, fallback=None):
    if optimizer is not None:
        try:
            return int(getattr(optimizer, "n"))
        except (TypeError, ValueError):
            pass
    return fallback


def _estimated_runtime(policy_result, fallback=None):
    if policy_result is not None:
        return _float_or_none(getattr(policy_result, "estimated_runtime_sec", None))
    return _float_or_none(fallback)


def _candidate_count(optimizer, policy_result=None, fallback=None):
    if optimizer is not None:
        classical_results = getattr(optimizer, "classical_results", None)
        try:
            if classical_results is not None and len(classical_results):
                return int(len(classical_results))
        except TypeError:
            pass
    if policy_result is not None:
        parsed = _int_or_none(getattr(policy_result, "candidate_count", None))
        if parsed is not None:
            return parsed
    return _int_or_none(fallback)


def _qaoa_shots(optimizer, fallback=None):
    if optimizer is not None:
        parsed = _int_or_none(getattr(optimizer, "qaoa_shots", None))
        if parsed is not None:
            return parsed
    return _int_or_none(fallback)


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _int_or_none(value):
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _int_or_zero(value) -> int:
    parsed = _int_or_none(value)
    return 0 if parsed is None else parsed


def _float_or_none(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _empty_summary() -> dict[str, Any]:
    return {
        "enabled": False,
        "total_runs": 0,
        "completed_runs": 0,
        "rejected_runs": 0,
        "failed_runs": 0,
        "consumed_runs": 0,
        "runs_by_key_id": {},
        "runs_by_usage_level": {},
    }


def _clear_active_run_fields(record: dict[str, Any]) -> None:
    record["active_run_id"] = None
    record["active_run_started_at"] = None
    record["active_run_status"] = None
    record["active_run_user_agent"] = None
    record["active_run_ip"] = None


def _max_parallel_runs(record: dict[str, Any] | None) -> int:
    parsed = _int_or_none((record or {}).get("max_parallel_runs"))
    return max(1, parsed or 1)


def _public_max_parallel_runs(usage_context) -> int:
    usage_level = getattr(usage_context, "usage_level", {}) or {}
    parsed = _int_or_none(usage_level.get("max_parallel_runs"))
    return max(1, parsed or 1)


def _raise_public_capacity_exceeded(active_count: int, max_parallel_runs: int) -> None:
    raise ApiError(
        429,
        "public_demo_capacity_exceeded",
        "The public demo is currently busy. Please try again in a few minutes.",
        {
            "usage_level": "public_demo",
            "active_public_runs": int(active_count),
            "max_parallel_public_runs": int(max_parallel_runs),
        },
    )


def _public_lock_record(
    *,
    run_id: str,
    now: dt.datetime,
    stale_after_sec: float,
    mode: str | None,
    response_level: str | None,
    filename: str | None,
    policy_result,
    user_agent: str | None,
    ip_address: str | None,
) -> dict[str, Any]:
    return json_safe(
        {
            "run_id": run_id,
            "usage_level": "public_demo",
            "status": "running",
            "started_at": now,
            "stale_after_sec": float(stale_after_sec),
            "mode": mode,
            "response_level": response_level,
            "filename": filename,
            "estimated_runtime_sec": _estimated_runtime(policy_result),
            "n_qubits": getattr(policy_result, "n_qubits", None),
            "client_ip_hash": _hash_optional(ip_address),
            "user_agent_hash": _hash_optional(user_agent),
        }
    )


def _hash_optional(value: str | None) -> str | None:
    if not value:
        return None
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def _lock_stale_after_sec(policy_result=None) -> float:
    max_runtime = _float_or_none(getattr(policy_result, "max_estimated_runtime_sec", None))
    base = max_runtime if max_runtime and max_runtime > 0 else 7200.0
    buffer = max(300.0, min(1800.0, base * 0.25))
    return float(base + buffer)


def _active_lock_is_stale(started_at, stale_after_sec: float, now: dt.datetime | None = None) -> bool:
    started = _parse_datetime_or_none(started_at)
    if started is None:
        return False
    now = now or dt.datetime.now(dt.timezone.utc)
    return (now - started).total_seconds() > float(stale_after_sec)


def _raise_active_run_exists(key_id: str, active: dict[str, Any], stale_after_sec: float) -> None:
    raise ApiError(
        409,
        "active_run_exists",
        "This license key already has an active run. Please wait until it has finished.",
        {
            "key_id": key_id,
            "active_run_id": active.get("active_run_id"),
            "active_run_started_at": json_safe(active.get("active_run_started_at")),
            "active_run_status": active.get("active_run_status"),
            "max_parallel_runs": _max_parallel_runs(active),
            "stale_after_sec": stale_after_sec,
        },
    )


def _record_active(record: dict[str, Any]) -> bool:
    if str(record.get("status", "")).strip().lower() != "active":
        return False
    expires_at = _parse_datetime(record.get("expires_at"))
    return expires_at is None or expires_at > dt.datetime.now(dt.timezone.utc)


def _parse_datetime(value) -> dt.datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, dt.datetime):
        parsed = value
    else:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def _parse_datetime_or_none(value) -> dt.datetime | None:
    try:
        return _parse_datetime(value)
    except (TypeError, ValueError):
        return None


def _firestore_client():
    firestore = _firestore_module()
    project = os.getenv("QAOA_FIRESTORE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT") or None
    return firestore.Client(project=project)


def _firestore_transactional():
    return _firestore_module().transactional


def _server_timestamp():
    try:
        return _firestore_module().SERVER_TIMESTAMP
    except Exception:
        return _utc_now()


def _firestore_module():
    try:
        from google.cloud import firestore
    except ImportError as exc:
        raise RuntimeError("Firestore mode requires google-cloud-firestore to be installed.") from exc
    return firestore
