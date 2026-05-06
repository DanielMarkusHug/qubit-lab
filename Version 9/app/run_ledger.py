"""Run ledger abstraction for Version 9.

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
_LOCAL_ACTIVE_RUNS: dict[str, dict[str, dict[str, Any]]] = {}
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
            locks = _LOCAL_ACTIVE_RUNS.setdefault(key_id, {})
            stale_run_ids = [
                active_run_id
                for active_run_id, record in locks.items()
                if _key_lock_is_stale(record, stale_after_sec, now)
            ]
            for active_run_id in stale_run_ids:
                locks.pop(active_run_id, None)

            active_records = [record for record in locks.values() if record.get("status") == "running"]
            max_parallel_runs = _max_parallel_runs(key_record)
            if len(active_records) >= max_parallel_runs:
                _raise_active_run_exists(key_id, _active_lock_summary(active_records, max_parallel_runs), stale_after_sec)

            lock_record = _key_lock_record(
                key_id=key_id,
                key_doc_id=str(key_record.get("_firestore_doc_id") or key_id),
                run_id=run_id,
                now=now,
                stale_after_sec=stale_after_sec,
                max_parallel_runs=max_parallel_runs,
                user_agent=user_agent,
                ip_address=ip_address,
            )
            locks[run_id] = lock_record
            active_records.append(lock_record)
            _apply_active_summary_to_record(key_record, active_records, max_parallel_runs)
            return {
                "acquired": True,
                "store": "local_memory",
                "active_run_count": len(active_records),
                "max_parallel_runs": max_parallel_runs,
                "stale_locks_cleared": len(stale_run_ids),
                "stale_lock_cleared": bool(stale_run_ids),
                "stale_after_sec": stale_after_sec,
                "previous_active_run_id": stale_run_ids[0] if stale_run_ids else None,
            }

    def release_run_lock(self, key_record: dict[str, Any] | None, run_id: str) -> bool:
        if not key_record:
            return False
        key_id = str(key_record.get("key_id") or "")
        if not key_id:
            return False
        with _LOCK:
            locks = _LOCAL_ACTIVE_RUNS.get(key_id)
            if not locks or run_id not in locks:
                return False
            locks.pop(run_id, None)
            if not locks:
                _LOCAL_ACTIVE_RUNS.pop(key_id, None)
            active_records = [record for record in (locks or {}).values() if record.get("status") == "running"]
            _apply_active_summary_to_record(key_record, active_records, _max_parallel_runs(key_record))
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

        self._cleanup_stale_key_locks(key_record, policy_result)
        now = dt.datetime.now(dt.timezone.utc)
        stale_after_sec = _lock_stale_after_sec(policy_result)

        def acquire(transaction):
            key_ref = self._key_ref(key_record)
            key_doc_id = self._key_doc_id(key_record)
            state_ref = self._key_state_ref(key_doc_id)
            snapshot = key_ref.get(transaction=transaction)
            if not getattr(snapshot, "exists", True):
                raise ApiError(403, "api_key_not_found", "API key record was not found.")
            record = snapshot.to_dict() or {}
            if not _record_active(record):
                raise ApiError(403, "api_key_inactive", "API key is inactive.")

            key_id = str(record.get("key_id") or key_record.get("key_id") or "")
            max_parallel_runs = _max_parallel_runs(record)
            state_snapshot = state_ref.get(transaction=transaction)
            state = state_snapshot.to_dict() if getattr(state_snapshot, "exists", False) else {}
            active_count = max(0, _int_or_zero((state or {}).get("active_count")))
            legacy_active_run_id = record.get("active_run_id")
            legacy_active_count = 0
            legacy_stale_lock_cleared = False
            legacy_lock = None
            if active_count == 0 and legacy_active_run_id:
                legacy_lock = _legacy_key_lock_record(record, key_id, key_doc_id, stale_after_sec)
                legacy_stale_lock_cleared = _key_lock_is_stale(legacy_lock, stale_after_sec, now)
                if not legacy_stale_lock_cleared:
                    legacy_active_count = 1
            effective_active_count = max(active_count, legacy_active_count)
            if effective_active_count >= max_parallel_runs:
                active_records = self._active_key_lock_records(key_doc_id)
                if not active_records and legacy_active_run_id and not legacy_stale_lock_cleared:
                    active_records = [_legacy_key_lock_record(record, key_id, key_doc_id, stale_after_sec)]
                _raise_active_run_exists(
                    key_id,
                    _active_lock_summary(active_records, max_parallel_runs, fallback_count=effective_active_count),
                    stale_after_sec,
                )

            lock_record = _key_lock_record(
                key_id=key_id,
                key_doc_id=key_doc_id,
                run_id=run_id,
                now=now,
                stale_after_sec=stale_after_sec,
                max_parallel_runs=max_parallel_runs,
                user_agent=user_agent,
                ip_address=ip_address,
            )
            new_count = effective_active_count + 1

            updates = {
                "active_run_id": run_id,
                "active_run_started_at": now,
                "active_run_status": "running",
                "active_run_count": new_count,
                "max_parallel_runs": max_parallel_runs,
                "active_run_user_agent": user_agent,
                "active_run_ip": ip_address,
                "updated_at": _server_timestamp(),
            }
            if legacy_stale_lock_cleared:
                updates["previous_active_run_id"] = legacy_active_run_id
            if legacy_active_count and legacy_lock:
                transaction.set(self._key_lock_ref(key_doc_id, str(legacy_active_run_id)), legacy_lock, merge=True)
            transaction.set(self._key_lock_ref(key_doc_id, run_id), lock_record, merge=True)
            transaction.set(
                state_ref,
                {
                    "key_id": key_id,
                    "key_doc_id": key_doc_id,
                    "active_count": new_count,
                    "max_parallel_runs": max_parallel_runs,
                    "updated_at": _server_timestamp(),
                },
                merge=True,
            )
            transaction.update(key_ref, updates)
            key_record.update(updates)
            return {
                "acquired": True,
                "store": "firestore",
                "active_run_count": new_count,
                "max_parallel_runs": max_parallel_runs,
                "stale_lock_cleared": legacy_stale_lock_cleared,
                "stale_after_sec": stale_after_sec,
                "previous_active_run_id": legacy_active_run_id if legacy_stale_lock_cleared else None,
            }

        result = self._run_transaction(acquire)
        self._refresh_key_active_summary(key_record)
        return result

    def release_run_lock(self, key_record: dict[str, Any] | None, run_id: str) -> bool:
        if not key_record:
            return False

        def release(transaction):
            key_ref = self._key_ref(key_record)
            key_doc_id = self._key_doc_id(key_record)
            state_ref = self._key_state_ref(key_doc_id)
            lock_ref = self._key_lock_ref(key_doc_id, run_id)
            lock_snapshot = lock_ref.get(transaction=transaction)
            if not getattr(lock_snapshot, "exists", False):
                legacy_snapshot = key_ref.get(transaction=transaction)
                legacy_record = legacy_snapshot.to_dict() if getattr(legacy_snapshot, "exists", False) else {}
                if legacy_record.get("active_run_id") != run_id:
                    return False
                transaction.update(
                    key_ref,
                    {
                        "active_run_id": None,
                        "active_run_started_at": None,
                        "active_run_status": None,
                        "active_run_user_agent": None,
                        "active_run_ip": None,
                        "active_run_count": 0,
                        "updated_at": _server_timestamp(),
                    },
                )
                transaction.set(
                    state_ref,
                    {"active_count": 0, "updated_at": _server_timestamp()},
                    merge=True,
                )
                _clear_active_run_fields(key_record)
                return True

            lock_record = lock_snapshot.to_dict() or {}
            if lock_record.get("run_id") != run_id or lock_record.get("status") != "running":
                return False
            snapshot = key_ref.get(transaction=transaction)
            if not getattr(snapshot, "exists", True):
                return False
            state_snapshot = state_ref.get(transaction=transaction)
            state = state_snapshot.to_dict() if getattr(state_snapshot, "exists", False) else {}
            active_count = max(0, _int_or_zero((state or {}).get("active_count")))
            new_count = max(active_count - 1, 0)
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
                    "active_count": new_count,
                    "updated_at": _server_timestamp(),
                },
                merge=True,
            )
            key_updates = {
                "active_run_count": new_count,
                "updated_at": _server_timestamp(),
            }
            if new_count == 0:
                key_updates.update(
                    {
                        "active_run_id": None,
                        "active_run_started_at": None,
                        "active_run_status": None,
                        "active_run_user_agent": None,
                        "active_run_ip": None,
                    }
                )
            transaction.update(
                key_ref,
                key_updates,
            )
            return True

        released = bool(self._run_transaction(release))
        if released:
            self._refresh_key_active_summary(key_record)
        return released

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
        return self.client.collection(Config.FIRESTORE_KEY_COLLECTION).document(self._key_doc_id(key_record))

    def _key_doc_id(self, key_record: dict[str, Any]) -> str:
        doc_id = key_record.get("_firestore_doc_id") or key_record.get("key_id")
        return str(doc_id)

    def _key_state_ref(self, key_doc_id: str):
        return self.client.collection(Config.FIRESTORE_KEY_RUN_STATE_COLLECTION).document(str(key_doc_id))

    def _key_lock_ref(self, key_doc_id: str, run_id: str):
        return self.client.collection(Config.FIRESTORE_KEY_RUN_LOCK_COLLECTION).document(
            _key_lock_doc_id(key_doc_id, run_id)
        )

    def _public_state_ref(self):
        return self.client.collection(Config.FIRESTORE_PUBLIC_RUN_STATE_COLLECTION).document("global")

    def _public_lock_ref(self, run_id: str):
        return self.client.collection(Config.FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION).document(str(run_id))

    def _active_key_lock_records(self, key_doc_id: str) -> list[dict[str, Any]]:
        try:
            snapshots = list(
                self.client.collection(Config.FIRESTORE_KEY_RUN_LOCK_COLLECTION)
                .where("key_doc_id", "==", str(key_doc_id))
                .stream()
            )
        except Exception:
            return []
        records = []
        for snapshot in snapshots:
            record = snapshot.to_dict() or {}
            if record.get("status") == "running":
                record.setdefault("run_id", record.get("active_run_id") or getattr(snapshot, "id", ""))
                records.append(record)
        records.sort(key=lambda record: str(record.get("started_at") or ""))
        return records

    def _cleanup_stale_key_locks(self, key_record: dict[str, Any], policy_result=None) -> int:
        key_doc_id = self._key_doc_id(key_record)
        stale_after_sec = _lock_stale_after_sec(policy_result)
        now = dt.datetime.now(dt.timezone.utc)
        active_records = self._active_key_lock_records(key_doc_id)
        stale_run_ids = []
        for record in active_records:
            job_record = self._job_record_for_lock(record)
            if _key_lock_is_stale(record, stale_after_sec, now, job_record=job_record):
                stale_run_ids.append(str(record.get("run_id") or ""))

        if not stale_run_ids:
            if active_records:
                self._refresh_key_active_summary(key_record)
            return 0

        def cleanup(transaction):
            state_ref = self._key_state_ref(key_doc_id)
            state_snapshot = state_ref.get(transaction=transaction)
            state = state_snapshot.to_dict() if getattr(state_snapshot, "exists", False) else {}
            active_count = max(0, _int_or_zero((state or {}).get("active_count")))
            cleared = 0
            for stale_run_id in stale_run_ids:
                if not stale_run_id:
                    continue
                lock_ref = self._key_lock_ref(key_doc_id, stale_run_id)
                lock_snapshot = lock_ref.get(transaction=transaction)
                if not getattr(lock_snapshot, "exists", False):
                    continue
                lock_record = lock_snapshot.to_dict() or {}
                if lock_record.get("status") != "running":
                    continue
                job_record = self._job_record_for_lock(lock_record)
                if not _key_lock_is_stale(lock_record, stale_after_sec, now, job_record=job_record):
                    continue
                transaction.set(
                    lock_ref,
                    {
                        "status": "stale_released",
                        "released_at": _server_timestamp(),
                        "stale_release_reason": _key_lock_stale_reason(lock_record, stale_after_sec, now, job_record),
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

        cleared_count = int(self._run_transaction(cleanup) or 0)
        self._refresh_key_active_summary(key_record)
        return cleared_count

    def _refresh_key_active_summary(self, key_record: dict[str, Any]) -> None:
        try:
            key_doc_id = self._key_doc_id(key_record)
            key_ref = self._key_ref(key_record)
            active_records = self._active_key_lock_records(key_doc_id)
            max_parallel_runs = _max_parallel_runs(key_record)
            state_ref = self._key_state_ref(key_doc_id)
            state_ref.set(
                {
                    "key_id": key_record.get("key_id") or key_doc_id,
                    "key_doc_id": key_doc_id,
                    "active_count": len(active_records),
                    "max_parallel_runs": max_parallel_runs,
                    "updated_at": _server_timestamp(),
                },
                merge=True,
            )
            summary_updates = _active_summary_updates(active_records, max_parallel_runs)
            key_ref.set(summary_updates, merge=True)
            _apply_active_summary_to_record(key_record, active_records, max_parallel_runs)
        except Exception:
            return None

    def _job_record_for_lock(self, lock_record: dict[str, Any]) -> dict[str, Any] | None:
        run_id = str(lock_record.get("run_id") or "")
        if not run_id:
            return None
        try:
            snapshot = self.client.collection(Config.FIRESTORE_JOB_COLLECTION).document(run_id).get()
        except Exception:
            return None
        if not getattr(snapshot, "exists", False):
            return None
        return snapshot.to_dict() or {}

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
            "active_run_ids": key_record.get("active_run_ids") or [],
            "active_run_count": _int_or_zero(key_record.get("active_run_count")),
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
    record["active_run_count"] = 0
    record["active_run_ids"] = []


def _max_parallel_runs(record: dict[str, Any] | None) -> int:
    parsed = _int_or_none((record or {}).get("max_parallel_runs"))
    return max(1, parsed or 1)


def _key_lock_record(
    *,
    key_id: str,
    key_doc_id: str,
    run_id: str,
    now: dt.datetime,
    stale_after_sec: float,
    max_parallel_runs: int,
    user_agent: str | None,
    ip_address: str | None,
) -> dict[str, Any]:
    return json_safe(
        {
            "run_id": run_id,
            "key_id": key_id,
            "key_doc_id": key_doc_id,
            "status": "running",
            "started_at": now,
            "stale_after_sec": float(stale_after_sec),
            "max_parallel_runs": int(max_parallel_runs),
            "active_run_user_agent": user_agent,
            "active_run_ip": ip_address,
        }
    )


def _legacy_key_lock_record(
    record: dict[str, Any],
    key_id: str,
    key_doc_id: str,
    stale_after_sec: float,
) -> dict[str, Any]:
    return {
        "run_id": record.get("active_run_id"),
        "key_id": key_id,
        "key_doc_id": key_doc_id,
        "status": record.get("active_run_status") or "running",
        "started_at": record.get("active_run_started_at"),
        "stale_after_sec": stale_after_sec,
        "max_parallel_runs": _max_parallel_runs(record),
        "active_run_user_agent": record.get("active_run_user_agent"),
        "active_run_ip": record.get("active_run_ip"),
    }


def _key_lock_doc_id(key_doc_id: str, run_id: str) -> str:
    return f"{_doc_id_safe(key_doc_id)}__{_doc_id_safe(run_id)}"


def _doc_id_safe(value: str) -> str:
    return str(value).replace("/", "_")


def _active_summary_updates(active_records: list[dict[str, Any]], max_parallel_runs: int) -> dict[str, Any]:
    if not active_records:
        return {
            "active_run_id": None,
            "active_run_started_at": None,
            "active_run_status": None,
            "active_run_user_agent": None,
            "active_run_ip": None,
            "active_run_count": 0,
            "active_run_ids": [],
            "max_parallel_runs": int(max_parallel_runs),
            "updated_at": _server_timestamp(),
        }
    active_records = sorted(active_records, key=lambda record: str(record.get("started_at") or ""))
    display_record = active_records[-1]
    return {
        "active_run_id": display_record.get("run_id"),
        "active_run_started_at": display_record.get("started_at"),
        "active_run_status": "running",
        "active_run_user_agent": display_record.get("active_run_user_agent"),
        "active_run_ip": display_record.get("active_run_ip"),
        "active_run_count": len(active_records),
        "active_run_ids": [record.get("run_id") for record in active_records if record.get("run_id")],
        "max_parallel_runs": int(max_parallel_runs),
        "updated_at": _server_timestamp(),
    }


def _apply_active_summary_to_record(
    record: dict[str, Any],
    active_records: list[dict[str, Any]],
    max_parallel_runs: int,
) -> None:
    updates = _active_summary_updates(active_records, max_parallel_runs)
    record.update(updates)


def _active_lock_summary(
    active_records: list[dict[str, Any]],
    max_parallel_runs: int,
    fallback_count: int | None = None,
) -> dict[str, Any]:
    active_records = list(active_records or [])
    first = active_records[0] if active_records else {}
    active_run_ids = [record.get("run_id") for record in active_records if record.get("run_id")]
    active_count = len(active_run_ids) if active_run_ids else _int_or_zero(fallback_count)
    return {
        "active_run_id": first.get("run_id"),
        "active_run_ids": active_run_ids,
        "active_run_count": active_count,
        "active_run_started_at": first.get("started_at"),
        "active_run_status": first.get("status") or "running",
        "max_parallel_runs": max_parallel_runs,
    }


def _key_lock_is_stale(
    lock_record: dict[str, Any],
    stale_after_sec: float,
    now: dt.datetime | None = None,
    *,
    job_record: dict[str, Any] | None = None,
) -> bool:
    return _key_lock_stale_reason(lock_record, stale_after_sec, now, job_record) is not None


def _key_lock_stale_reason(
    lock_record: dict[str, Any],
    stale_after_sec: float,
    now: dt.datetime | None = None,
    job_record: dict[str, Any] | None = None,
) -> str | None:
    status = str((job_record or {}).get("status") or "").strip().lower()
    if status in {"completed", "failed", "cancelled"}:
        return f"job_status_{status}"
    heartbeat_at = (job_record or {}).get("heartbeat_at")
    heartbeat_stale_after_sec = _heartbeat_stale_after_sec()
    if heartbeat_at and _active_lock_is_stale(heartbeat_at, heartbeat_stale_after_sec, now):
        return "job_heartbeat_stale"
    started_at = lock_record.get("started_at") or lock_record.get("active_run_started_at")
    if _active_lock_is_stale(started_at, stale_after_sec, now):
        return "lock_age_stale"
    return None


def _heartbeat_stale_after_sec() -> float:
    configured = _float_or_none(os.getenv("QAOA_RUN_LOCK_HEARTBEAT_STALE_SEC"))
    if configured is not None and configured > 0:
        return configured
    return 1800.0


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
            "active_run_ids": active.get("active_run_ids") or [],
            "active_run_count": _int_or_zero(active.get("active_run_count")),
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
