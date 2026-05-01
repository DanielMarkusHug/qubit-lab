#!/usr/bin/env python3
"""Admin CLI for Firestore-backed QAOA RQP API keys."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import secrets
import sys
from pathlib import Path
from typing import Any


VERSION_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VERSION_DIR))

from app.config import Config  # noqa: E402
from app.usage_policy import generate_key_hash, load_usage_config  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage QAOA RQP Firestore API keys.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create = subparsers.add_parser("create", help="Create a new Firestore key record.")
    create.add_argument("--key-id", required=True)
    create.add_argument("--name", required=True)
    create.add_argument("--email", required=True)
    create.add_argument("--organization", required=True)
    create.add_argument("--usage-level", required=True)
    create.add_argument("--max-runs", type=int, required=True)
    create.add_argument("--expires-at", required=True)
    create.add_argument("--display-name", default="")
    create.add_argument("--notes", default="")
    create.add_argument("--created-by", default="")
    create.add_argument("--status", default="active", choices=("active", "revoked", "expired", "suspended"))
    create.add_argument("--prefix", default="qlab")
    create.add_argument("--max-parallel-runs", type=int, default=1)
    create.add_argument("--force", action="store_true")

    list_cmd = subparsers.add_parser("list", help="List Firestore key records.")
    list_cmd.add_argument("--limit", type=int, default=100)

    show = subparsers.add_parser("show", help="Show one key record by key_id.")
    show.add_argument("--key-id", required=True)
    show.add_argument("--show-hash", action="store_true")

    inspect = subparsers.add_parser("inspect", help="Inspect a raw API key without printing it.")
    inspect.add_argument("--api-key", required=True)
    inspect.add_argument("--show-hash", action="store_true")

    revoke = subparsers.add_parser("revoke", help="Set key status to revoked.")
    revoke.add_argument("--key-id", required=True)

    activate = subparsers.add_parser("activate", help="Set key status to active.")
    activate.add_argument("--key-id", required=True)

    clear_lock = subparsers.add_parser("clear-lock", help="Clear an active run lock for admin recovery.")
    clear_lock.add_argument("--key-id", required=True)
    clear_lock.add_argument("--confirm", action="store_true")

    usage = subparsers.add_parser("usage", help="List recent usage events for a key.")
    usage.add_argument("--key-id", required=True)
    usage.add_argument("--limit", type=int, default=20)

    runs = subparsers.add_parser("runs", help="List recent usage events, including public demo runs.")
    runs.add_argument("--days", type=int, default=30)
    runs.add_argument("--usage-level", default="")
    runs.add_argument("--key-id", default="")
    runs.add_argument("--status", default="")
    runs.add_argument("--limit", type=int, default=50)
    runs.add_argument("--scan-limit", type=int, default=1000)

    usage_summary = subparsers.add_parser("usage-summary", help="Summarize recent usage events.")
    usage_summary.add_argument("--days", type=int, default=30)
    usage_summary.add_argument("--scan-limit", type=int, default=5000)

    public_status = subparsers.add_parser("public-status", help="Show public demo semaphore status.")
    public_status.add_argument("--limit", type=int, default=20)

    args = parser.parse_args()
    client = _firestore_client()

    if args.command == "create":
        return _create_key(client, args)
    if args.command == "list":
        return _list_keys(client, args.limit)
    if args.command == "show":
        return _show_key(client, args.key_id, show_hash=args.show_hash)
    if args.command == "inspect":
        return _inspect_key(client, args.api_key, show_hash=args.show_hash)
    if args.command == "revoke":
        return _set_status(client, args.key_id, "revoked", "revoked_at")
    if args.command == "activate":
        return _set_status(client, args.key_id, "active", "activated_at")
    if args.command == "clear-lock":
        return _clear_lock(client, args.key_id, confirm=args.confirm)
    if args.command == "usage":
        return _usage(client, args.key_id, args.limit)
    if args.command == "runs":
        return _runs(
            client,
            days=args.days,
            usage_level=args.usage_level,
            key_id=args.key_id,
            status=args.status,
            limit=args.limit,
            scan_limit=args.scan_limit,
        )
    if args.command == "usage-summary":
        return _usage_summary(client, days=args.days, scan_limit=args.scan_limit)
    if args.command == "public-status":
        return _public_status(client, limit=args.limit)

    parser.error("Unknown command.")
    return 2


def _create_key(client, args) -> int:
    _validate_usage_level(args.usage_level)
    doc_ref = client.collection(Config.FIRESTORE_KEY_COLLECTION).document(args.key_id)
    existing = doc_ref.get()
    if getattr(existing, "exists", False) and not args.force:
        raise SystemExit(f"Key {args.key_id!r} already exists. Use --force to overwrite/update.")

    raw_key = _generate_raw_key(args.prefix)
    now = _utc_now()
    used_runs = 0
    max_runs = int(args.max_runs)
    max_parallel_runs = max(1, int(args.max_parallel_runs))
    payload = {
        "key_id": args.key_id,
        "key_hash": generate_key_hash(raw_key),
        "status": args.status,
        "usage_level": args.usage_level,
        "display_name": args.display_name,
        "name": args.name,
        "email": args.email,
        "organization": args.organization,
        "created_at": now,
        "updated_at": now,
        "expires_at": args.expires_at,
        "max_runs": max_runs,
        "used_runs": used_runs,
        "remaining_runs": max(max_runs - used_runs, 0),
        "max_parallel_runs": max_parallel_runs,
        "active_run_id": None,
        "active_run_started_at": None,
        "active_run_status": None,
        "active_run_user_agent": None,
        "active_run_ip": None,
        "notes": args.notes,
        "created_by": args.created_by,
    }
    doc_ref.set(payload, merge=bool(args.force))

    print("Firestore key created.")
    print(f"key_id: {args.key_id}")
    print(f"usage_level: {args.usage_level}")
    print(f"status: {args.status}")
    print(f"max_parallel_runs: {max_parallel_runs}")
    print(f"expires_at: {args.expires_at}")
    print(f"raw_api_key: {raw_key}")
    return 0


def _list_keys(client, limit: int) -> int:
    snapshots = list(client.collection(Config.FIRESTORE_KEY_COLLECTION).limit(max(1, int(limit))).stream())
    rows = []
    for snapshot in snapshots:
        data = snapshot.to_dict() or {}
        rows.append(
            [
                str(data.get("key_id") or snapshot.id),
                str(data.get("usage_level") or data.get("level") or ""),
                str(data.get("status") or ""),
                f"{_int_or_zero(data.get('used_runs'))}/{_display(data.get('max_runs'))}",
                _display(data.get("remaining_runs")),
                _display(data.get("expires_at")),
                _display(data.get("email")),
                _display(data.get("organization")),
                _active_run_indicator(data),
            ]
        )
    _print_table(
        ["key_id", "usage_level", "status", "used/max", "remaining", "expires_at", "email", "organization", "active"],
        rows,
    )
    return 0


def _show_key(client, key_id: str, *, show_hash: bool = False) -> int:
    data = _get_key(client, key_id)
    _print_json(_safe_key_payload(data, show_hash=show_hash))
    return 0


def _inspect_key(client, raw_key: str, *, show_hash: bool = False) -> int:
    key_hash = generate_key_hash(raw_key)
    query = client.collection(Config.FIRESTORE_KEY_COLLECTION).where("key_hash", "==", key_hash).limit(10)
    for snapshot in query.stream():
        data = snapshot.to_dict() or {}
        data.setdefault("key_id", snapshot.id)
        _print_json(_safe_key_payload(data, show_hash=show_hash))
        return 0
    raise SystemExit("No Firestore key matched the provided API key.")


def _set_status(client, key_id: str, status: str, timestamp_field: str) -> int:
    doc_ref = client.collection(Config.FIRESTORE_KEY_COLLECTION).document(key_id)
    snapshot = doc_ref.get()
    if not getattr(snapshot, "exists", False):
        raise SystemExit(f"Key {key_id!r} not found.")
    now = _utc_now()
    doc_ref.set({"status": status, timestamp_field: now, "updated_at": now}, merge=True)
    print(f"key_id: {key_id}")
    print(f"status: {status}")
    print(f"{timestamp_field}: {now}")
    return 0


def _clear_lock(client, key_id: str, *, confirm: bool = False) -> int:
    doc_ref = client.collection(Config.FIRESTORE_KEY_COLLECTION).document(key_id)
    snapshot = doc_ref.get()
    if not getattr(snapshot, "exists", False):
        raise SystemExit(f"Key {key_id!r} not found.")
    if not confirm:
        print("WARNING: clear-lock requires --confirm. No Firestore fields were changed.")
        print(f"key_id: {key_id}")
        return 2

    now = _utc_now()
    doc_ref.set(
        {
            "active_run_id": None,
            "active_run_started_at": None,
            "active_run_status": None,
            "active_run_user_agent": None,
            "active_run_ip": None,
            "cleared_lock_at": now,
            "updated_at": now,
        },
        merge=True,
    )
    print(f"key_id: {key_id}")
    print("active_run_lock: cleared")
    print(f"cleared_lock_at: {now}")
    return 0


def _usage(client, key_id: str, limit: int) -> int:
    from google.cloud.firestore_v1.base_query import FieldFilter

    query = (
        client.collection(Config.FIRESTORE_USAGE_COLLECTION)
        .where(filter=FieldFilter("key_id", "==", key_id))
        .order_by("timestamp", direction="DESCENDING")
        .limit(max(1, int(limit)))
    )
    rows = []
    for snapshot in query.stream():
        data = snapshot.to_dict() or {}
        rows.append(
            [
                _display(data.get("timestamp") or data.get("timestamp_start_utc")),
                _display(data.get("run_id") or snapshot.id),
                _display(data.get("status")),
                _display(data.get("mode")),
                _display(data.get("response_level")),
                _display(data.get("binary_variables")),
                _display(data.get("estimated_runtime_sec")),
                _display(data.get("actual_runtime_sec")),
                _display(data.get("error_code")),
            ]
        )
    _print_table(
        ["timestamp", "run_id", "status", "mode", "response", "qubits", "est_sec", "actual_sec", "error"],
        rows,
    )
    return 0


def _runs(
    client,
    *,
    days: int,
    usage_level: str = "",
    key_id: str = "",
    status: str = "",
    limit: int = 50,
    scan_limit: int = 1000,
) -> int:
    events = _recent_usage_events(client, days=days, scan_limit=scan_limit)
    if usage_level:
        events = [event for event in events if str(event.get("usage_level") or "") == usage_level]
    if key_id:
        events = [event for event in events if str(event.get("key_id") or "") == key_id]
    if status:
        events = [event for event in events if str(event.get("status") or "") == status]
    events = events[: max(1, int(limit))]

    rows = []
    for event in events:
        rows.append(
            [
                _display(event.get("timestamp") or event.get("timestamp_start_utc")),
                _display(event.get("run_id")),
                _display(event.get("key_id")),
                _display(event.get("usage_level")),
                _display(event.get("status")),
                _display(event.get("mode")),
                _display(event.get("response_level")),
                _display(event.get("binary_variables") or event.get("n_qubits")),
                _display(event.get("actual_runtime_sec")),
                _display(event.get("error_code") or event.get("rejection_code")),
            ]
        )
    _print_table(
        ["timestamp", "run_id", "key_id", "usage_level", "status", "mode", "response", "qubits", "actual_sec", "error"],
        rows,
    )
    return 0


def _usage_summary(client, *, days: int, scan_limit: int = 5000) -> int:
    events = _recent_usage_events(client, days=days, scan_limit=scan_limit)
    since = _since_datetime(days)
    by_usage_level = _group_counts(events, "usage_level")
    by_key_id = _group_counts(events, "key_id")
    by_error_code = _group_counts(events, "error_code")
    public_events = [event for event in events if _is_public_event(event)]
    authenticated_events = [event for event in events if not _is_public_event(event)]

    payload = {
        "period": {
            "days": int(days),
            "since_utc": since.isoformat().replace("+00:00", "Z"),
            "scanned_events": len(events),
        },
        "total_runs": len(events),
        "completed_runs": _status_count(events, "completed"),
        "rejected_runs": _status_count(events, "rejected"),
        "failed_runs": _status_count(events, "failed"),
        "consumed_runs": sum(1 for event in events if bool(event.get("consumed_run"))),
        "public_demo": {
            "total": len(public_events),
            "completed": _status_count(public_events, "completed"),
            "rejected": _status_count(public_events, "rejected"),
            "failed": _status_count(public_events, "failed"),
            "capacity_rejections": sum(
                1 for event in public_events if event.get("error_code") == "public_demo_capacity_exceeded"
            ),
        },
        "authenticated": {
            "total": len(authenticated_events),
            "completed": _status_count(authenticated_events, "completed"),
            "rejected": _status_count(authenticated_events, "rejected"),
            "failed": _status_count(authenticated_events, "failed"),
        },
        "by_usage_level": by_usage_level,
        "by_key_id": by_key_id,
        "by_error_code": by_error_code,
    }
    _print_json(payload)
    return 0


def _public_status(client, *, limit: int = 20) -> int:
    state_snapshot = client.collection(Config.FIRESTORE_PUBLIC_RUN_STATE_COLLECTION).document("global").get()
    state = state_snapshot.to_dict() if getattr(state_snapshot, "exists", False) else {}
    locks = []
    for snapshot in client.collection(Config.FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION).stream():
        data = snapshot.to_dict() or {}
        if data.get("status") != "running":
            continue
        locks.append(
            {
                "run_id": data.get("run_id") or snapshot.id,
                "started_at": data.get("started_at"),
                "stale_after_sec": data.get("stale_after_sec"),
                "mode": data.get("mode"),
                "response_level": data.get("response_level"),
                "filename": data.get("filename"),
                "estimated_runtime_sec": data.get("estimated_runtime_sec"),
                "n_qubits": data.get("n_qubits"),
            }
        )
    locks.sort(key=lambda lock: _parse_datetime_or_min(lock.get("started_at")), reverse=True)
    locks = locks[: max(1, int(limit))]

    payload = {
        "state_document": f"{Config.FIRESTORE_PUBLIC_RUN_STATE_COLLECTION}/global",
        "locks_collection": Config.FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION,
        "active_public_runs": _int_or_zero((state or {}).get("active_count")),
        "max_parallel_runs": _int_or_zero((state or {}).get("max_parallel_runs")),
        "updated_at": (state or {}).get("updated_at"),
        "running_locks": locks,
    }
    _print_json(payload)
    return 0


def _recent_usage_events(client, *, days: int, scan_limit: int) -> list[dict[str, Any]]:
    since = _since_datetime(days)
    query = (
        client.collection(Config.FIRESTORE_USAGE_COLLECTION)
        .order_by("timestamp", direction="DESCENDING")
        .limit(max(1, int(scan_limit)))
    )
    events = []
    for snapshot in query.stream():
        data = snapshot.to_dict() or {}
        data.setdefault("run_id", snapshot.id)
        timestamp = data.get("timestamp") or data.get("timestamp_start_utc") or data.get("created_at")
        parsed_timestamp = _parse_datetime_or_none(timestamp)
        if parsed_timestamp is not None and parsed_timestamp < since:
            continue
        data["timestamp"] = timestamp
        events.append(data)
    events.sort(
        key=lambda event: _parse_datetime_or_min(event.get("timestamp") or event.get("timestamp_start_utc")),
        reverse=True,
    )
    return events


def _get_key(client, key_id: str) -> dict[str, Any]:
    snapshot = client.collection(Config.FIRESTORE_KEY_COLLECTION).document(key_id).get()
    if not getattr(snapshot, "exists", False):
        raise SystemExit(f"Key {key_id!r} not found.")
    data = snapshot.to_dict() or {}
    data.setdefault("key_id", key_id)
    return data


def _safe_key_payload(data: dict[str, Any], *, show_hash: bool = False) -> dict[str, Any]:
    payload = dict(data)
    if not show_hash:
        payload.pop("key_hash", None)
    _apply_lock_display_defaults(payload)
    return payload


def _apply_lock_display_defaults(payload: dict[str, Any]) -> None:
    payload["max_parallel_runs"] = _int_or_one(payload.get("max_parallel_runs"))
    payload["active_run_id"] = _display_or_none(payload.get("active_run_id"))
    payload["active_run_started_at"] = _display_or_none(payload.get("active_run_started_at"))
    payload["active_run_status"] = payload.get("active_run_status") or "idle"
    payload["active_run_user_agent"] = _display_or_none(payload.get("active_run_user_agent"))
    payload["active_run_ip"] = _display_or_none(payload.get("active_run_ip"))


def _active_run_indicator(data: dict[str, Any]) -> str:
    return "running" if data.get("active_run_id") else "idle"


def _display_or_none(value) -> Any:
    if value in (None, ""):
        return "none"
    return value


def _validate_usage_level(usage_level: str) -> None:
    usage_levels = load_usage_config()["usage_levels"]
    if usage_level not in usage_levels:
        valid = ", ".join(sorted(usage_levels))
        raise SystemExit(f"Unknown usage level {usage_level!r}. Valid usage levels: {valid}")


def _generate_raw_key(prefix: str) -> str:
    clean_prefix = "".join(char for char in str(prefix).strip() if char.isalnum() or char in {"_", "-"}).strip("_-")
    clean_prefix = clean_prefix or "qlab"
    return f"{clean_prefix}_{secrets.token_urlsafe(32)}"


def _firestore_client():
    try:
        from google.cloud import firestore
    except ImportError as exc:
        raise SystemExit("google-cloud-firestore is required for Firestore key administration.") from exc
    project = _project_id()
    return firestore.Client(project=project)


def _project_id() -> str | None:
    import os

    return os.getenv("QAOA_FIRESTORE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT") or None


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _display(value) -> str:
    if value is None:
        return ""
    if isinstance(value, dt.datetime):
        return value.isoformat().replace("+00:00", "Z")
    return str(value)


def _since_datetime(days: int) -> dt.datetime:
    return _utc_now() - dt.timedelta(days=max(0, int(days)))


def _parse_datetime_or_none(value) -> dt.datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, dt.datetime):
        parsed = value
    else:
        try:
            parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def _parse_datetime_or_min(value) -> dt.datetime:
    return _parse_datetime_or_none(value) or dt.datetime.min.replace(tzinfo=dt.timezone.utc)


def _status_count(events: list[dict[str, Any]], status: str) -> int:
    return sum(1 for event in events if event.get("status") == status)


def _group_counts(events: list[dict[str, Any]], field: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in events:
        value = str(event.get(field) or "unknown")
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items()))


def _is_public_event(event: dict[str, Any]) -> bool:
    return event.get("usage_level") == "public_demo" or event.get("key_id") == "anonymous"


def _int_or_zero(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _int_or_one(value) -> int:
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return 1


def _print_json(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True, default=_display))


def _print_table(headers: list[str], rows: list[list[str]]) -> None:
    widths = [len(header) for header in headers]
    for row in rows:
        for idx, value in enumerate(row):
            widths[idx] = max(widths[idx], len(str(value)))
    fmt = "  ".join("{:<" + str(width) + "}" for width in widths)
    print(fmt.format(*headers))
    print(fmt.format(*["-" * width for width in widths]))
    for row in rows:
        print(fmt.format(*row))


if __name__ == "__main__":
    raise SystemExit(main())
