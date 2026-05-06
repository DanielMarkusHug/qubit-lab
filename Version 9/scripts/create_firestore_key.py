#!/usr/bin/env python3
"""Create or update a Firestore-backed API key record.

The raw key is accepted as input only to compute the HMAC-SHA256 hash. It is
not stored and is never printed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import sys
import uuid
from pathlib import Path


VERSION_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VERSION_DIR))

from app.config import Config  # noqa: E402
from app.usage_policy import generate_key_hash  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a Firestore QAOA RQP API-key record.")
    parser.add_argument("raw_key", help="Raw API key to hash. This value is never stored or printed.")
    parser.add_argument("--key-id", default=None, help="Firestore document/key id. Defaults to a generated id.")
    parser.add_argument("--level", required=True, help="Usage level, for example qualified_demo or tester.")
    parser.add_argument("--name", default="")
    parser.add_argument("--email", default="")
    parser.add_argument("--organization", default="")
    parser.add_argument("--max-runs", type=int, required=True)
    parser.add_argument("--used-runs", type=int, default=0)
    parser.add_argument("--expires-at", required=True, help="ISO timestamp, for example 2026-12-31T23:59:59Z.")
    parser.add_argument("--status", default="active")
    parser.add_argument("--notes", default="")
    parser.add_argument("--project", default=None, help="Optional Google Cloud project id.")
    args = parser.parse_args()

    from google.cloud import firestore

    key_id = args.key_id or f"key-{uuid.uuid4().hex[:16]}"
    now = dt.datetime.now(dt.timezone.utc)
    project = args.project or os.getenv("QAOA_FIRESTORE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT") or None
    client = firestore.Client(project=project)
    doc_ref = client.collection(Config.FIRESTORE_KEY_COLLECTION).document(key_id)
    existing = doc_ref.get()

    payload = {
        "key_id": key_id,
        "key_hash": generate_key_hash(args.raw_key),
        "usage_level": args.level,
        "level": args.level,
        "name": args.name,
        "email": args.email,
        "organization": args.organization,
        "status": args.status,
        "max_runs": int(args.max_runs),
        "used_runs": int(args.used_runs),
        "remaining_runs": max(int(args.max_runs) - int(args.used_runs), 0),
        "max_parallel_runs": 1,
        "active_run_id": None,
        "active_run_started_at": None,
        "active_run_status": None,
        "active_run_user_agent": None,
        "active_run_ip": None,
        "expires_at": args.expires_at,
        "updated_at": now,
        "notes": args.notes,
    }
    if not existing.exists:
        payload["created_at"] = now

    doc_ref.set(payload, merge=True)

    print("Firestore API key record written.")
    print(f"key_id: {key_id}")
    print(f"level: {args.level}")
    print(f"status: {args.status}")
    print(f"max_runs: {args.max_runs}")
    print(f"used_runs: {args.used_runs}")
    print(f"expires_at: {args.expires_at}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
