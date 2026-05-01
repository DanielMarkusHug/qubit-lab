#!/usr/bin/env python3
"""Live Cloud Run + Firestore smoke test for Version 7.

The raw API key is read from QAOA_RQP_TEST_API_KEY and is never printed.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4


API_KEY_ENV = "QAOA_RQP_TEST_API_KEY"


class SmokeFailure(RuntimeError):
    pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test a Cloud Run QAOA RQP API using a Firestore-backed key.")
    parser.add_argument("service_url", help="Cloud Run service URL, for example https://...run.app")
    parser.add_argument("workbook_path", help="Path to the .xlsx workbook to upload")
    args = parser.parse_args()

    api_key = os.getenv(API_KEY_ENV)
    if not api_key:
        print(f"FAIL: {API_KEY_ENV} is not set.", file=sys.stderr)
        return 2

    service_url = args.service_url.rstrip("/")
    workbook_path = Path(args.workbook_path).expanduser()

    try:
        if not workbook_path.is_file():
            raise SmokeFailure(f"Workbook not found: {workbook_path}")

        capabilities = _get_json(f"{service_url}/capabilities")
        before = _get_json(f"{service_url}/license-status", api_key=api_key)
        run_payload = _post_workbook(
            f"{service_url}/run-qaoa",
            workbook_path,
            api_key=api_key,
            fields={"mode": "classical_only", "response_level": "compact"},
        )
        after = _get_json(f"{service_url}/license-status", api_key=api_key)

        _assert_counter_delta(before, after)
        _assert_run_payload(run_payload)

        print("PASS: Cloud Run Firestore smoke test completed.")
        print(f"service: {capabilities.get('service')}")
        print(f"version: {capabilities.get('version')}")
        print(f"key_id: {after.get('key_id')}")
        print(f"usage_level: {after.get('usage_level')}")
        print(f"used_runs: {before.get('used_runs')} -> {after.get('used_runs')}")
        print(f"remaining_runs: {before.get('remaining_runs')} -> {after.get('remaining_runs')}")
        print(f"run_id: {run_payload.get('run_id')}")
        print(f"binary_variables: {run_payload.get('binary_variables')}")
        return 0
    except SmokeFailure as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"FAIL: unexpected smoke-test error: {exc}", file=sys.stderr)
        return 1


def _get_json(url: str, api_key: str | None = None) -> dict:
    headers = {}
    if api_key:
        headers["X-API-Key"] = api_key
    return _request_json(urllib.request.Request(url, headers=headers, method="GET"))


def _post_workbook(url: str, workbook_path: Path, api_key: str, fields: dict[str, str]) -> dict:
    boundary = f"----qaoa-rqp-smoke-{uuid4().hex}"
    body = _multipart_body(boundary, fields, workbook_path)
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "X-API-Key": api_key,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(body)),
        },
        method="POST",
    )
    return _request_json(request)


def _request_json(request: urllib.request.Request) -> dict:
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            status = response.status
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        safe_payload = _safe_json(payload)
        raise SmokeFailure(f"HTTP {exc.code} from {request.full_url}: {_compact_json(safe_payload)}") from exc
    except urllib.error.URLError as exc:
        raise SmokeFailure(f"Request failed for {request.full_url}: {exc.reason}") from exc

    data = _safe_json(payload)
    if status < 200 or status >= 300:
        raise SmokeFailure(f"HTTP {status} from {request.full_url}: {_compact_json(data)}")
    if not isinstance(data, dict):
        raise SmokeFailure(f"Expected JSON object from {request.full_url}.")
    return data


def _multipart_body(boundary: str, fields: dict[str, str], workbook_path: Path) -> bytes:
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                str(value).encode("utf-8"),
                b"\r\n",
            ]
        )

    content_type = mimetypes.guess_type(workbook_path.name)[0] or "application/octet-stream"
    chunks.extend(
        [
            f"--{boundary}\r\n".encode("utf-8"),
            (
                f'Content-Disposition: form-data; name="file"; filename="{workbook_path.name}"\r\n'
                f"Content-Type: {content_type}\r\n\r\n"
            ).encode("utf-8"),
            workbook_path.read_bytes(),
            b"\r\n",
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
    )
    return b"".join(chunks)


def _assert_counter_delta(before: dict, after: dict) -> None:
    before_used = _int_field(before, "used_runs")
    after_used = _int_field(after, "used_runs")
    before_remaining = _int_field(before, "remaining_runs")
    after_remaining = _int_field(after, "remaining_runs")

    if after_used != before_used + 1:
        raise SmokeFailure(f"used_runs did not increase by 1: {before_used} -> {after_used}")
    if after_remaining != before_remaining - 1:
        raise SmokeFailure(f"remaining_runs did not decrease by 1: {before_remaining} -> {after_remaining}")


def _assert_run_payload(payload: dict) -> None:
    if payload.get("status") != "completed":
        raise SmokeFailure(f"Run did not complete: {_compact_json(payload)}")
    if payload.get("mode") != "classical_only":
        raise SmokeFailure(f"Unexpected run mode: {payload.get('mode')}")
    license_payload = payload.get("license") or {}
    if license_payload.get("authenticated") is not True:
        raise SmokeFailure("Run response did not include authenticated license metadata.")


def _int_field(payload: dict, field: str) -> int:
    value = payload.get(field)
    if value is None:
        raise SmokeFailure(f"License status is missing {field}.")
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise SmokeFailure(f"License status field {field} is not an integer: {value!r}") from exc


def _safe_json(payload: str):
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return {"raw_response": payload[:500]}


def _compact_json(payload) -> str:
    return json.dumps(payload, sort_keys=True)[:800]


if __name__ == "__main__":
    raise SystemExit(main())
