# Version 7.0.16 Deployment Notes

## Confirmed Baseline

Version 7.0.1 was successfully deployed to Cloud Run and confirmed working:

- `/capabilities` works on Cloud Run.
- `/run-qaoa` works on Cloud Run with `DEMO-123`.
- Compact response works.
- `DEMO-123` can request `full`; all usage levels now allow compact, standard, and full response levels.
- `TESTER-123` can request `full`.
- Public/no-key is limited to 8 qubits.
- `qaoa_limited` is enabled for all usage levels, including public/no-key, with effective caps per usage level; `qaoa_full` remains disabled and legacy `qaoa` is treated as a disabled `qaoa_full` alias.
- Local/mock YAML keys remain available for development and tests; production-like deployments should use Firestore.

Current Cloud Run URL:

```text
https://qaoa-rqp-api-186148318189.europe-west6.run.app
```

## 7.0.2 Additions

- Local/mock run ledger abstraction in `app/run_ledger.py`.
- Optional JSON ledger persistence controlled by `QAOA_RQP_ENABLE_LOCAL_LEDGER=1`.
- Usage counters in `/license-status` and successful `/run-qaoa` responses.
- `/ledger-summary` for local development only.
- Actual runtime metrics in diagnostics:
  - `actual_runtime_sec`
  - `estimated_runtime_sec`
  - `runtime_ratio`

No optimizer math changed. QUBO construction and fixed/variable covariance cross-term logic still come from `QAOAOptimizerV61`.

## 7.0.3 Additions

- Runtime-estimation calibration now includes conservative floors plus workbook parsing, result construction, qubit-count, and candidate-count terms for `classical_only`.
- Ledger records include `actual_runtime_sec`, `estimated_runtime_sec`, `runtime_ratio`, `n_qubits`, `mode`, `layers`, `iterations`, `restarts`, and `candidate_count`.
- Production-like startup now requires `KEY_HASH_SECRET` unless `QAOA_RQP_LOCAL_DEV=1`.
- `/ledger-summary` remains local-development-only and is blocked when `QAOA_RQP_LOCAL_DEV` is not set.

## 7.0.4 Additions

- API-key storage is now abstracted behind local YAML or Firestore modes.
- Usage-run storage is now abstracted behind disabled, local JSON, or Firestore modes.
- Firestore mode now defaults to `qaoa_keys` and `qaoa_usage_events`.
- Successful authenticated completed runs increment key usage atomically in a Firestore transaction.
- Rejections, policy failures, QAOA `501`, invalid keys, and pre-execution failures do not consume runs.
- Raw API keys are still never stored or logged.

No optimizer math changed. Classical-only behavior and response shaping are intended to remain compatible with 7.0.3.

## 7.0.5 Additions

- Docker now uses JSON exec-form `CMD` to remove the Docker lint warning.
- Gunicorn reads the Cloud Run `PORT` environment variable from `app/gunicorn_conf.py`.
- Added `scripts/smoke_test_cloudrun_firestore.py` for live Cloud Run + Firestore verification.
- The smoke test checks `/capabilities`, `/license-status`, `/run-qaoa`, and verifies usage counters moved by exactly one run.

No optimizer math changed. QAOA remained disabled in this increment.

## 7.0.8 Additions

- `/run-qaoa` now includes an offline-style `reporting` object for frontend rendering.
- Compact responses include `reporting.summary`.
- Standard responses include `reporting.summary`, `classical_candidates`, `solver_comparison`, and `portfolio_contents`.
- Full responses include all reporting tables plus base64 PNG chart data URLs.
- Classical-only reporting is populated from existing optimizer dataframes such as `classical_results`, `portfolios_df`, `solver_comparison_df`, and `history_df`.
- Quantum reporting arrays remain empty for `classical_only`, and summary metadata explicitly marks QAOA unavailable in that path.
- `reporting.summary.classical_result_summary` is populated from the best classical candidate.
- `reporting.summary.quantum_result_summary` remains present while QAOA is disabled, with disabled status and null metrics. It must not mirror classical metrics.

No optimizer math changed. QAOA remained disabled in this reporting increment.

## 7.0.9 Working Increment

- `mode=qaoa_limited` now executes for tester keys only.
- The limited path loads the workbook, builds the same QUBO as the classical path, runs the classical heuristic baseline, then runs bounded PennyLane QAOA.
- Limited QAOA uses exact statevector probabilities, not shot sampling.
- Strict limited-mode caps are enforced independently from tester classical limits: max 16 qubits, max 3 layers, max 50 iterations, max 2 restarts.
- `reporting.quantum_samples`, `reporting.qaoa_best_qubo`, `reporting.summary.quantum_result_summary`, and solver comparison are populated for successful `qaoa_limited` runs.
- QAOA candidate rows use `source="qaoa_limited"` and `selection_scope="qaoa exact probability sample"`.
- The best quantum result is selected by lowest QUBO value within the exported QAOA probability sample set, not by highest probability alone.
- Full `mode=qaoa` remains disabled and returns `501` after policy validation.

No optimizer math changed. The existing classical path is unchanged.

## 7.0.10 Usage-Policy Increment

- Added `internal_power` usage level for controlled internal testing.
- `internal_power` keeps `qaoa_full` listed for future compatibility, but actual `qaoa_full` execution remains disabled.
- Supported canonical mode names are `classical_only`, `qaoa_limited`, and `qaoa_full`.
- Legacy `mode=qaoa` is normalized to `qaoa_full` and returns `qaoa_full_disabled`.
- Tester `qaoa_limited` effective caps remain max 16 qubits, 3 layers, 50 iterations, 2 restarts, and 2700 seconds estimated runtime.
- Internal-power `qaoa_limited` effective caps are max 24 qubits, 8 layers, 300 iterations, 5 restarts, and 7200 seconds estimated runtime.
- `/license-status` now exposes both general limits and `qaoa_limited_limits` so the frontend can distinguish license-level max qubits from QAOA-limited caps.
- `/capabilities` exposes `mode_aliases` and effective `qaoa_limited` limits per usage level.

No optimizer math changed. The existing classical and limited-QAOA execution paths are unchanged.

## 7.0.11 Inspect-Workbook Increment

- Added `POST /inspect-workbook` for synchronous preflight workbook summary and runtime estimation.
- The endpoint accepts the same multipart `file` upload as `/run-qaoa` plus optional runtime form fields.
- It authenticates and applies usage policy like `/run-qaoa`, including public-demo limits, but does not check or decrement remaining runs.
- It loads the workbook and builds the QUBO through the same safe input path, then stops before classical search or QAOA execution.
- Successful responses include `workbook_summary`, `runtime_estimate`, compact license status, and capped diagnostics logs.
- `/run-qaoa` compact responses now include logs capped to 20 important lines; standard responses include logs capped to 50; full responses include full logs.

No optimizer math changed. The existing `/run-qaoa` response fields remain backward compatible, with additive diagnostics fields.

## 7.0.12 Reporting Increment

- Added `reporting.charts.qubo_breakdown_quantum` for the best QAOA candidate by lowest QUBO value.
- Added `reporting.charts.qubo_breakdown_classical` while keeping `reporting.charts.qubo_breakdown` backward-compatible.
- Added `reporting.charts.optimization_history` when QAOA history rows are available.
- Added `reporting.circuit` and `diagnostics.circuit` with QAOA circuit overview metadata.
- Added optional `reporting.charts.circuit_overview` when circuit metrics are available.
- Circuit gate/depth counts are conservative estimates unless a future circuit object exposes exact counts; responses mark `counts_are_estimated=true`.

No optimizer math changed. These are additive reporting fields.

## 7.0.13 Firestore Key-Management Increment

- Firestore key records now use the `qaoa_keys` collection by default.
- Usage events now use the `qaoa_usage_events` collection by default.
- `QAOA_KEY_STORE=firestore|yaml|auto` controls key validation. Legacy `QAOA_RQP_KEY_STORE` is still accepted, but new deployments should use `QAOA_KEY_STORE`.
- Firestore key documents are keyed by `key_id`, store only HMAC-SHA256 `key_hash`, and include `usage_level`, `status`, identity metadata, `max_runs`, `used_runs`, `remaining_runs`, and optional per-key limit overrides.
- Successful authenticated completed runs increment `used_runs` and decrement `remaining_runs` transactionally.
- Added `scripts/key_admin_firestore.py` for creating, listing, inspecting, revoking, activating, and reviewing usage for Firestore keys.

No optimizer math changed. Local YAML/mock key behavior remains available for development and tests.

## 7.0.14 Per-Key Run-Locking Increment

- `/run-qaoa` now acquires a per-license-key active-run lock before simulation execution starts.
- Different keys can run in parallel, but a second simultaneous run for the same key is rejected immediately with `active_run_exists`.
- Firestore key documents can store `active_run_id`, `active_run_started_at`, `active_run_status`, `max_parallel_runs`, `active_run_user_agent`, and `active_run_ip`.
- Existing Firestore key documents do not need these fields; missing lock fields are treated as null and missing `max_parallel_runs` defaults to `1`.
- Lock acquisition and stale-lock clearing happen in a Firestore transaction.
- Locks are released in a `finally` block and only when the stored `active_run_id` still matches the current `run_id`.
- `active_run_exists` rejections do not consume a run. They may be stored as rejected usage events with `error_code=active_run_exists`.

No optimizer math changed. `/license-status` and `/inspect-workbook` do not acquire run locks.

## 7.0.15 Policy And Diagnostics Increment

- `/run-qaoa` now defaults to `response_level=full` when the frontend omits `response_level`.
- All usage levels allow `compact`, `standard`, and `full`.
- `qaoa_limited` is allowed for all usage levels, with conservative effective caps for public and qualified-demo keys.
- Public `qaoa_limited` remains small: max 8 qubits, 1 layer, 10 iterations, 1 restart, and 60 seconds estimated runtime.
- Workbook `Settings` values are used as backend defaults for runtime and model settings when form values are omitted.
- Explicit form fields still override workbook settings.
- `/run-qaoa` and `/inspect-workbook` return `diagnostics.effective_settings` and `diagnostics.runtime_inputs`.
- Exact statevector mode reports `qaoa_shots=null`, `qaoa_shots_display="exact"`, and `shots_mode="exact"`.
- Returned logs use `Refresh of Data: True/False`.
- `/run-qaoa` remains synchronous. Logs are returned in the final response only; no streaming, polling, or job-mode endpoints were added.

No optimizer math changed. Firestore key/usage storage, run locking, collection names, and key hashing are unchanged.

## 7.0.16 Public Demo Concurrency Increment

- Anonymous/public_demo users can still call `/run-qaoa` without an API key.
- `public_demo.max_parallel_runs=5` limits total concurrent public demo runs globally.
- Authenticated keys continue to use the existing per-key run lock and do not consume public slots.
- `/inspect-workbook` and `/license-status` do not acquire public slots.
- Firestore mode uses `qaoa_public_run_state/global` and `qaoa_public_run_locks/{run_id}`.
- `qaoa_public_run_state/global` stores `active_count`, `max_parallel_runs`, and `updated_at`.
- `qaoa_public_run_locks/{run_id}` stores safe active-run metadata, including optional SHA256 hashes of IP/user-agent values. Raw IP addresses are not stored.
- Public capacity exhaustion returns HTTP `429` with `code=public_demo_capacity_exceeded`.
- Capacity rejections do not start optimization and do not consume usage.
- The frontend will handle/display `public_demo_capacity_exceeded` separately.

No optimizer math changed. Firestore key collection `qaoa_keys`, usage collection `qaoa_usage_events`, and key hashing are unchanged.

## Ledger Persistence

Local development can still use no-op or local JSON persistence. Production-like deployments should use Firestore.

Enable local JSON persistence with:

```bash
QAOA_RQP_LEDGER_STORE=local
# or compatibility shortcut:
QAOA_RQP_ENABLE_LOCAL_LEDGER=1
```

Local ledger file:

```text
Version 7/data/run_ledger.json
```

Runtime JSON files under `Version 7/data/*.json` are ignored by git.

Important production note: the Version 7.0.2/7.0.3 local JSON ledger is not production-safe across Cloud Run instances. Version 7.0.4+ Firestore mode is the first production-safe usage-counter layer. Do not use the local ledger on Cloud Run for real usage tracking.

Consumed-run rules:

- Successful completed optimization: consumes one run.
- Invalid key: does not consume.
- Policy rejection: does not consume.
- Oversized/public rejection: does not consume.
- `response_level_not_allowed`: does not consume.
- QAOA `501`: does not consume.
- `active_run_exists`: does not consume.
- Internal validation failure before execution: does not consume.
- Runtime/internal failure after execution starts: records failed, does not consume.

## Platform Requirements

- Cloud Run expects the container to listen on `PORT`, normally `8080`.
- Cloud Run requires Linux x86_64-compatible images.
- On Apple Silicon, build with `docker build --platform linux/amd64`.
- Production-like Cloud Run deployments require `KEY_HASH_SECRET` and should not set `QAOA_RQP_LOCAL_DEV=1`.
- Production-like Cloud Run deployments should set `QAOA_KEY_STORE=firestore` and `QAOA_LEDGER_STORE=firestore` or legacy `QAOA_RQP_LEDGER_STORE=firestore`.
- Optional Firestore environment variables are `QAOA_FIRESTORE_PROJECT_ID`, `QAOA_FIRESTORE_KEY_COLLECTION`, `QAOA_FIRESTORE_USAGE_COLLECTION`, `QAOA_FIRESTORE_PUBLIC_RUN_STATE_COLLECTION`, and `QAOA_FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION`; the default collections are `qaoa_keys`, `qaoa_usage_events`, `qaoa_public_run_state`, and `qaoa_public_run_locks`.
- External demos must not use `QAOA_RQP_LOCAL_DEV=1`.
- The Cloud Run service account needs Firestore permissions for `qaoa_keys`, `qaoa_usage_events`, `qaoa_public_run_state`, and `qaoa_public_run_locks`. `roles/datastore.user` is sufficient for smoke testing; for production, prefer a narrow custom role.

## Current Limits

- Full `mode=qaoa_full` is not implemented in Version 7.0.16.
- Legacy `mode=qaoa` is accepted only as an alias for disabled `qaoa_full`.
- `mode=qaoa_limited` is intended for bounded exact-statevector validation runs.
- Local/mock mode remains available for development and tests.
- Firestore mode is available for production-like key validation and usage counters.
- No Cloud Storage.
- No payments.
- No user accounts.
- No Vercel frontend.

## Commands

Local build:

```bash
cd "/Users/danielhug/code/qubit-lab/QAOA-Optimizer"
docker build -f "Version 7/Dockerfile" -t qaoa-rqp-api:7.0.16 .
```

Local run with bundled development keys:

```bash
docker run --rm -p 8088:8080 \
  -e QAOA_RQP_LOCAL_DEV=1 \
  qaoa-rqp-api:7.0.16
```

Local run with local JSON ledger enabled:

```bash
docker run --rm -p 8088:8080 \
  -e QAOA_RQP_LOCAL_DEV=1 \
  -e QAOA_RQP_LEDGER_STORE=local \
  qaoa-rqp-api:7.0.16
```

Local license status:

```bash
curl http://127.0.0.1:8088/license-status \
  -H "X-API-Key: DEMO-123" | python3 -m json.tool
```

Local ledger summary:

```bash
curl http://127.0.0.1:8088/ledger-summary | python3 -m json.tool
```

Local inspect without consuming a run:

```bash
curl -X POST http://127.0.0.1:8088/inspect-workbook \
  -H "X-API-Key: DEMO-123" \
  -F "mode=classical_only" \
  -F "layers=2" \
  -F "iterations=20" \
  -F "restarts=1" \
  -F "file=@/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx" | python3 -m json.tool
```

Local `DEMO-123` compact:

```bash
curl -X POST http://127.0.0.1:8088/run-qaoa \
  -H "X-API-Key: DEMO-123" \
  -F "mode=classical_only" \
  -F "response_level=compact" \
  -F "file=@/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx" | python3 -m json.tool
```

Cloud Run build and push:

```bash
PROJECT_ID="$(gcloud config get-value project)"
REGION="europe-west6"
REPO="qaoa-rqp"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/qaoa-rqp-api:7.0.16"

docker build --platform linux/amd64 \
  -f "Version 7/Dockerfile" \
  -t "$IMAGE" .

docker push "$IMAGE"
```

Cloud Run deploy with bundled development keys, for testing only:

```bash
gcloud run deploy qaoa-rqp-api \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars QAOA_RQP_LOCAL_DEV=1
```

Cloud Run deploy with local/mock ledger enabled, for testing only:

```bash
gcloud run deploy qaoa-rqp-api \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars QAOA_RQP_LOCAL_DEV=1,QAOA_RQP_LEDGER_STORE=local
```

Production-like Cloud Run deploy with Firestore-backed keys and usage:

```bash
gcloud run deploy qaoa-rqp-api \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars QAOA_RQP_LOCAL_DEV=0,KEY_HASH_SECRET="$KEY_HASH_SECRET",QAOA_KEY_STORE=firestore,QAOA_RQP_LEDGER_STORE=firestore
```

Create a Firestore-backed key. The admin script generates a random raw API key, stores only the HMAC hash, and prints the raw key exactly once:

```bash
KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" create \
  --key-id "demo-qualified-001" \
  --usage-level "qualified_demo" \
  --name "Demo User" \
  --email "demo@example.com" \
  --organization "Qubit Lab" \
  --max-runs 1000 \
  --max-parallel-runs 1 \
  --expires-at "2026-12-31T23:59:59Z"
```

Useful Firestore key-admin commands:

```bash
KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" list

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" show --key-id "demo-qualified-001"

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" inspect --api-key "$RAW_API_KEY"

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" revoke --key-id "demo-qualified-001"

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" activate --key-id "demo-qualified-001"

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" clear-lock --key-id "demo-qualified-001" --confirm

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" usage --key-id "demo-qualified-001" --limit 20

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" runs --days 30 --usage-level public_demo --limit 50

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" usage-summary --days 30

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" public-status
```

`clear-lock` is for admin recovery if an active-run lock was left behind. Existing Firestore keys without lock fields are displayed as `max_parallel_runs=1` and active status `idle`.

Run-view commands:

- `runs` lists recent usage events from `qaoa_usage_events`, including public/no-key runs where `key_id=anonymous` and `usage_level=public_demo`.
- `usage-summary` aggregates recent completed/rejected/failed runs and public capacity rejections.
- `public-status` shows the current public semaphore state and running public locks without exposing raw IPs or raw user-agent values.

Run the live Firestore smoke test:

```bash
QAOA_RQP_TEST_API_KEY="NEW-RAW-KEY" \
  .venv/bin/python "Version 7/scripts/smoke_test_cloudrun_firestore.py" \
  "https://qaoa-rqp-api-186148318189.europe-west6.run.app" \
  "/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx"
```

The smoke test never prints the raw API key. It verifies `used_runs` increased by 1 and `remaining_runs` decreased by 1.

## Before Commercial Use

- Add abuse controls and IP/user rate limits.
- Add fixed-holdings regression cases to protect covariance/cross-term behavior.
- Add operational monitoring and alerting around Firestore failures and usage anomalies.
- Integrate QAOA in a later controlled milestone.
