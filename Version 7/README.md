# QAOA RQP API - Version 7.0.16

Version 7.0.16 adds a Firestore-backed public demo concurrency gate.
It keeps the existing optimizer math unchanged, preserves Firestore key/usage tracking and authenticated per-key run locking, allows keyless public demo runs, and limits anonymous/public_demo `/run-qaoa` execution to 5 concurrent runs globally.

Current confirmed Cloud Run URL:

```text
https://qaoa-rqp-api-186148318189.europe-west6.run.app
```

## Working State

- Docker image builds locally from the repository root.
- Cloud Run deployment works with a `linux/amd64` image.
- `/health`, `/capabilities`, and `/run-qaoa` work on Cloud Run.
- `/run-qaoa` with `mode=classical_only` accepts Excel uploads and returns a real classical optimization result.
- `/inspect-workbook` accepts the same workbook upload and returns a QUBO/workbook summary plus runtime estimate without executing optimization or decrementing usage.
- Compact, standard, and full response shaping works for every usage level.
- `/run-qaoa` defaults to `response_level=full` when no response level is submitted.
- `/run-qaoa` includes a `reporting` object with result-summary data; standard/full responses include offline-style tables, and full includes chart data URLs.
- `mode=qaoa_limited` is enabled for all usage levels, including public/no-key, with usage-level-specific exact-statevector caps.
- `mode=qaoa_full` remains intentionally disabled; legacy `mode=qaoa` is accepted as an alias for `qaoa_full` and is also disabled.
- API-key data can come from local/mock YAML or Firestore `qaoa_keys`.
- Usage runs can be disabled, local JSON, or Firestore-backed through `qaoa_usage_events`.
- `/run-qaoa` allows different keys to run in parallel, but rejects a second simultaneous run for the same authenticated key with `active_run_exists`.
- Anonymous/public_demo `/run-qaoa` requests do not need an API key, but they are limited to 5 concurrent public runs globally.
- If public capacity is full, `/run-qaoa` returns `429` with `code=public_demo_capacity_exceeded`.
- Version 7.0.4+ is the first production-safe usage-counter layer when deployed with Firestore mode.
- Production-like deployments must set `KEY_HASH_SECRET`; the local-development fallback is only enabled when `QAOA_RQP_LOCAL_DEV=1`.
- No Cloud Storage, payments, user accounts, or Vercel frontend yet.

## API

Supported endpoints:

- `GET /`
- `GET /health`
- `GET /capabilities`
- `GET /license-status`
- `GET /ledger-summary`
- `POST /demo-run`
- `POST /upload-excel-demo`
- `POST /inspect-workbook`
- `POST /run-qaoa`

Execution mode:

- `mode=classical_only` is implemented.
- `mode=qaoa_limited` is implemented with effective limits by usage level: public_demo allows max 8 qubits, 1 layer, 10 iterations, and 1 restart; qualified_demo allows max 8 qubits, 2 layers, 20 iterations, and 1 restart; tester allows max 16 qubits, 3 layers, 50 iterations, and 2 restarts; internal_power allows max 24 qubits, 8 layers, 300 iterations, and 5 restarts.
- `mode=qaoa_full` still goes through policy validation, then returns `501` with `qaoa_full_disabled`.
- Legacy `mode=qaoa` is normalized to `qaoa_full` and returns the same disabled response.

Response levels:

- If omitted, `response_level` defaults to `full`.
- `response_level=compact` includes `reporting.summary`.
- `response_level=standard` adds components, up to 5 top candidates, and reporting tables for classical candidates, solver comparison, and best portfolio contents.
- `response_level=full` preserves the previous full response as closely as possible and includes all reporting tables plus chart data URLs.

Diagnostics logs:

- Compact `/run-qaoa` responses include `diagnostics.logs` capped to 20 important lines.
- Standard `/run-qaoa` responses include `diagnostics.logs` capped to 50 important lines.
- Full `/run-qaoa` responses include the full collected log list.
- Optimizer logs are returned only in the final synchronous response. There is no streaming, polling, or job-mode endpoint.
- Returned logs use `Refresh of Data: True/False` wording.

## Inspect Workbook

`POST /inspect-workbook` accepts the same multipart `file` field as `/run-qaoa` and optional runtime form fields such as `mode`, `layers`, `iterations`, `restarts`, `warm_start`, `lambda_budget`, `lambda_variance`, `risk_free_rate`, `qaoa_shots`, and `restart_perturbation`.

The endpoint authenticates if `X-API-Key` is present, applies the same usage policy and upload/qubit/runtime checks, builds the QUBO through the same input path, and returns:

- `workbook_summary`: decision-variable count, state-space size, fixed/variable blocks, unique tickers, budget, currency, invested/candidate amounts, QUBO shape, referenced assets, and settings count.
- `runtime_estimate`: deterministic estimate with requested mode, estimated seconds, allowed seconds, limit status, and basis values.
- `diagnostics.effective_settings`: the final settings used for the estimate after applying precedence.
- `diagnostics.runtime_inputs`: the runtime subset used by the estimator.
- `diagnostics.logs`: capped inspection logs.

It does not run classical search or QAOA and does not consume or record a usage run.

Settings precedence is:

1. Explicit multipart form values.
2. Workbook `Settings` sheet values.
3. Backend defaults.

Supported override fields include `layers`/`qaoa_p`, `iterations`/`qaoa_maxiter`, `restarts`/`qaoa_multistart_restarts`, `warm_start`, `qaoa_shots`, `lambda_budget`, `lambda_variance`, `risk_free_rate`, and `restart_perturbation`.

In exact statevector `qaoa_limited` mode, shot sampling is not used. Responses report:

```json
{
  "qaoa_shots": null,
  "qaoa_shots_display": "exact",
  "shots_mode": "exact"
}
```

## Reporting Object

`/run-qaoa` returns:

```json
"reporting": {
  "summary": {},
  "classical_candidates": [],
  "quantum_samples": [],
  "qaoa_best_qubo": [],
  "solver_comparison": [],
  "portfolio_contents": [],
  "optimization_history": [],
  "circuit": {},
  "charts": {}
}
```

For `mode=classical_only`, `classical_candidates`, `solver_comparison`, and `portfolio_contents` are populated. `quantum_samples` and `qaoa_best_qubo` are empty, and the summary explicitly marks QAOA as disabled/not available in the Version 7 classical-only path.

For `mode=qaoa_limited`, the API first runs the unchanged classical heuristic as a baseline, then runs limited PennyLane QAOA with exact statevector probabilities. Shot sampling is not used in this mode, even if `qaoa_shots` is submitted. `quantum_samples`, `qaoa_best_qubo`, the quantum summary card, QAOA diagnostics, and solver comparison are populated. QAOA candidate rows use `source="qaoa_limited"` and `selection_scope="qaoa exact probability sample"`. The quantum result is selected by lowest QUBO value within the exported QAOA probability sample set, not by highest probability alone.

`reporting.summary` also contains two stable frontend card payloads:

- `classical_result_summary`: populated from the best classical candidate.
- `quantum_result_summary`: always present. In `classical_only` it reports `status = "Disabled / Not available"` and leaves quantum metrics as `null`; in `qaoa_limited` it is populated from `QAOA_Best_QUBO`.

Do not populate the quantum card from classical metrics. It should be sourced from `QAOA_Best_QUBO`, with `QAOA_Samples` as the underlying exported probability set.

Full responses include base64 PNG data URLs for:

- `risk_return_sharpe`
- `risk_return_qubo`
- `qubo_breakdown`, kept as the backward-compatible classical breakdown
- `qubo_breakdown_classical`
- `qubo_breakdown_quantum`, populated when QAOA candidates are available
- `optimization_history`, populated when QAOA optimization history is available
- `circuit_overview`, populated when circuit metrics are available
- `solver_comparison`

`reporting.circuit` and `diagnostics.circuit` include QAOA circuit overview fields such as qubits, layers, mixer type, QUBO nonzero entries, estimated gate counts, sequential two-qubit depth, exact/sampling mode, and `qaoa_shots`. Current gate counts are conservative estimates and set `counts_are_estimated=true`; classical-only responses return `available=false` with a reason.

## Usage Policy And Keys

Usage levels live in:

```text
Version 7/config/usage_levels.yaml
```

Local/mock key records live in:

```text
Version 7/config/demo_keys.yaml
```

Raw API keys are not stored in YAML. Key records store only HMAC-SHA256 hashes.

Current mock keys:

- `DEMO-123` maps to `qualified_demo`
- `TESTER-123` maps to `tester`
- `INTERNAL-POWER-123` maps to `internal_power`

Public/no-key requests map to `public_demo`. Public users can call `classical_only` and tightly bounded `qaoa_limited`, but the current 14-variable sample workbook is expected to reject without a key because `public_demo.max_qubits=8`.

Public demo concurrency:

- Public users still do not need API keys.
- `public_demo.max_parallel_runs=5`.
- Only anonymous/public_demo `/run-qaoa` executions acquire a public slot.
- `/inspect-workbook` and `/license-status` do not acquire public slots.
- Authenticated keys continue to use the existing per-key lock instead of the public semaphore.

If all public slots are active, the API rejects before optimization starts:

```json
{
  "status": "error",
  "error": {
    "code": "public_demo_capacity_exceeded",
    "message": "The public demo is currently busy. Please try again in a few minutes.",
    "details": {
      "usage_level": "public_demo",
      "active_public_runs": 5,
      "max_parallel_public_runs": 5
    }
  }
}
```

The frontend will handle/display this error separately.

## Storage Modes

Version 7.0.13+ supports Firestore key management while keeping YAML/mock keys as the local fallback:

```bash
QAOA_KEY_STORE=firestore|yaml|auto
QAOA_LEDGER_STORE=firestore|local|disabled
QAOA_RQP_LEDGER_STORE=firestore|local|disabled
QAOA_FIRESTORE_PROJECT_ID="optional-project-id"
QAOA_FIRESTORE_KEY_COLLECTION=qaoa_keys
QAOA_FIRESTORE_USAGE_COLLECTION=qaoa_usage_events
QAOA_FIRESTORE_PUBLIC_RUN_STATE_COLLECTION=qaoa_public_run_state
QAOA_FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION=qaoa_public_run_locks
```

Defaults:

- With `QAOA_RQP_LOCAL_DEV=1`: key store defaults to YAML/local, ledger store defaults to `disabled`.
- Without `QAOA_RQP_LOCAL_DEV=1`: key store defaults to Firestore, ledger store defaults to Firestore.
- `QAOA_KEY_STORE=auto` follows the same local-dev versus production-like default.
- Legacy `QAOA_RQP_KEY_STORE` is still accepted, but new deployments should use `QAOA_KEY_STORE`.
- `QAOA_LEDGER_STORE` is the preferred ledger-store variable; legacy `QAOA_RQP_LEDGER_STORE` is still accepted.
- `QAOA_RQP_ENABLE_LOCAL_LEDGER=1` is still accepted as a compatibility shortcut for local ledger persistence in local development.

Production-like deployments must use:

```bash
QAOA_RQP_LOCAL_DEV=0
QAOA_KEY_STORE=firestore
QAOA_RQP_LEDGER_STORE=firestore
KEY_HASH_SECRET="..."
```

YAML/local key stores are rejected at startup when `QAOA_RQP_LOCAL_DEV` is not set.

## Key Hash Secret

Key hashes use `KEY_HASH_SECRET`.

For local development only, you may set:

```bash
export QAOA_RQP_LOCAL_DEV=1
```

When `QAOA_RQP_LOCAL_DEV=1`, the app uses a clearly marked fallback secret so the checked-in development hashes work. These hashes are development-only.

When `QAOA_RQP_LOCAL_DEV` is not set, startup requires `KEY_HASH_SECRET`. For production-like Cloud Run deployments, set a real `KEY_HASH_SECRET`, create Firestore key records with the same secret, and deploy without `QAOA_RQP_LOCAL_DEV=1`.

Warning: `QAOA_RQP_LOCAL_DEV=1` must not be used for external demos. It enables development-only key behavior and exposes `/ledger-summary`.

Generate a key hash:

```bash
cd "/Users/danielhug/code/qubit-lab/QAOA-Optimizer"
KEY_HASH_SECRET="replace-with-real-secret" \
  .venv/bin/python "Version 7/scripts/generate_key_hash.py" "NEW-RAW-KEY"
```

## Run Ledger

Version 7.0.2 added a local/mock ledger abstraction. Version 7.0.4+ extends it with Firestore support in:

```text
Version 7/app/run_ledger.py
```

Local JSON persistence is enabled in local development with:

```bash
export QAOA_RQP_ENABLE_LOCAL_LEDGER=1
# or
export QAOA_RQP_LEDGER_STORE=local
```

Default behavior:

- In local/mock mode, if no ledger store is enabled, the ledger is no-op for persistence.
- Responses still show `max_runs`, `used_runs`, and `remaining_runs` from `demo_keys.yaml`.
- Public/no-key requests are identified as anonymous `public_demo`.
- IP rate limiting is not implemented yet.

When enabled, the local ledger writes to:

```text
Version 7/data/run_ledger.json
```

Runtime JSON files under `Version 7/data/*.json` are ignored by git.

Usage counter semantics:

- One run is consumed only after a successful completed optimization.
- Invalid keys, policy rejections, oversized/public rejections, forbidden response levels, QAOA `501`, and pre-execution validation failures do not consume runs.
- Runtime/internal failures after execution starts are recorded as failed but do not consume runs.
- Rejections because another run is active for the same key return `active_run_exists` and do not consume runs.
- If `remaining_runs <= 0`, `/run-qaoa` returns `403` with `code=run_limit_exceeded`.

The local JSON ledger is not production-safe across Cloud Run instances. Firestore mode is the intended production-safe usage-counter layer for 7.0.4 and later. Do not use the local ledger on Cloud Run for real usage tracking.

Firestore collections:

- `qaoa_keys`
- `qaoa_usage_events`

`qaoa_keys` documents are keyed by `key_id` and store `key_hash`, `status`, `usage_level`, display/identity fields, timestamps, `max_runs`, `used_runs`, `remaining_runs`, active-run lock fields, notes, creator metadata, and optional per-key `general_limits` or `qaoa_limited_limits`. Raw API keys are never stored.

`qaoa_usage_events` documents store safe run metadata such as `run_id`, `key_id`, timestamp, `status`, mode, response level, filename, qubit/candidate counts, QAOA settings, runtime estimates, actual runtime, error codes/messages, and `service_version`.

Public demo semaphore collections:

- `qaoa_public_run_state/global`
- `qaoa_public_run_locks/{run_id}`

The state document stores `active_count`, `max_parallel_runs`, and `updated_at`. Each public lock document stores safe metadata such as `run_id`, `usage_level=public_demo`, `status=running`, `started_at`, `stale_after_sec`, mode, response level, filename, estimated runtime, qubit count, and optional SHA256 hashes of client IP/user agent. Raw IP addresses are not stored.

## Run Locking

For authenticated `/run-qaoa` requests, Version 7.0.16 allows one active simulation per license key by default. Different keys can run in parallel.

Firestore key documents may include:

- `active_run_id`
- `active_run_started_at`
- `active_run_status`
- `max_parallel_runs`, default `1`
- `active_run_user_agent`
- `active_run_ip`

Existing Firestore key documents do not need these fields. Missing lock fields are treated as null, and missing `max_parallel_runs` is treated as `1`.

The lock is acquired in a Firestore transaction after key, upload, workbook, mode, response-level, qubit, runtime, and usage checks pass, but before optimizer execution starts. If a non-stale active run already exists for the key, `/run-qaoa` returns:

```json
{
  "status": "error",
  "error": {
    "code": "active_run_exists",
    "message": "This license key already has an active run. Please wait until it has finished."
  }
}
```

Stale locks are cleared inside the same acquisition transaction. The stale threshold is based on the run's `max_estimated_runtime_sec` plus a safety buffer, with a conservative two-hour base if no runtime cap is available. Locks are released in a `finally` block and only if `active_run_id` still matches the current `run_id`.

## Runtime Estimation

Runtime estimation parameters live in `Version 7/config/usage_levels.yaml` under `runtime_estimator`.

Version 7.0.3 and later record and return calibration data:

- `actual_runtime_sec`
- `estimated_runtime_sec`
- `runtime_ratio`
- `n_qubits`
- `mode`
- `layers`
- `iterations`
- `restarts`
- `candidate_count`

For `classical_only`, the estimate now includes a conservative floor plus workbook parsing, result construction, qubit-count, and candidate-count terms. `qaoa_limited` uses the QAOA estimator and usage-level-specific exact-statevector caps; full `qaoa_full` execution remains disabled.
Version 7.0.11 exposes the same runtime estimate helper through `/inspect-workbook` and `/run-qaoa` diagnostics.

## Local Docker Build

From the repository root:

```bash
cd "/Users/danielhug/code/qubit-lab/QAOA-Optimizer"
docker build -f "Version 7/Dockerfile" -t qaoa-rqp-api:7.0.16 .
```

## Local Docker Run

For bundled development keys without persistent ledger:

```bash
docker run --rm -p 8088:8080 \
  -e QAOA_RQP_LOCAL_DEV=1 \
  qaoa-rqp-api:7.0.16
```

With local JSON ledger enabled:

```bash
docker run --rm -p 8088:8080 \
  -e QAOA_RQP_LOCAL_DEV=1 \
  -e QAOA_RQP_LEDGER_STORE=local \
  qaoa-rqp-api:7.0.16
```

With Firestore stores and a production-style secret:

```bash
docker run --rm -p 8088:8080 \
  -e QAOA_RQP_LOCAL_DEV=0 \
  -e KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  -e QAOA_KEY_STORE=firestore \
  -e QAOA_RQP_LEDGER_STORE=firestore \
  qaoa-rqp-api:7.0.16
```

## Local Tests

Health:

```bash
curl http://127.0.0.1:8088/health
```

Capabilities:

```bash
curl http://127.0.0.1:8088/capabilities | python3 -m json.tool
```

License status with no key:

```bash
curl http://127.0.0.1:8088/license-status | python3 -m json.tool
```

License status with `DEMO-123`:

```bash
curl http://127.0.0.1:8088/license-status \
  -H "X-API-Key: DEMO-123" | python3 -m json.tool
```

Ledger summary, local development only:

```bash
curl http://127.0.0.1:8088/ledger-summary | python3 -m json.tool
```

Inspect workbook with `DEMO-123` without consuming a run:

```bash
curl -X POST http://127.0.0.1:8088/inspect-workbook \
  -H "X-API-Key: DEMO-123" \
  -F "mode=classical_only" \
  -F "layers=2" \
  -F "iterations=20" \
  -F "restarts=1" \
  -F "file=@/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx" | python3 -m json.tool
```

Public/no-key compact call. This is expected to reject the current 14-qubit workbook under `public_demo.max_qubits=8`:

```bash
curl -X POST http://127.0.0.1:8088/run-qaoa \
  -F "mode=classical_only" \
  -F "response_level=compact" \
  -F "file=@/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx" | python3 -m json.tool
```

`DEMO-123` compact call:

```bash
curl -X POST http://127.0.0.1:8088/run-qaoa \
  -H "X-API-Key: DEMO-123" \
  -F "mode=classical_only" \
  -F "response_level=compact" \
  -F "file=@/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx" | python3 -m json.tool
```

`DEMO-123` standard call:

```bash
curl -X POST http://127.0.0.1:8088/run-qaoa \
  -H "X-API-Key: DEMO-123" \
  -F "mode=classical_only" \
  -F "response_level=standard" \
  -F "file=@/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx" | python3 -m json.tool
```

`TESTER-123` full call:

```bash
curl -X POST http://127.0.0.1:8088/run-qaoa \
  -H "X-API-Key: TESTER-123" \
  -F "mode=classical_only" \
  -F "response_level=full" \
  -F "file=@/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx" | python3 -m json.tool
```

## Cloud Run Build And Push

Cloud Run requires a Linux x86_64-compatible image. On Apple Silicon, build with `--platform linux/amd64`:

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

## Cloud Run Deploy

For bundled development mock keys only, during testing:

```bash
gcloud run deploy qaoa-rqp-api \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars QAOA_RQP_LOCAL_DEV=1
```

For local/mock ledger enabled on Cloud Run during testing only:

```bash
gcloud run deploy qaoa-rqp-api \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars QAOA_RQP_LOCAL_DEV=1,QAOA_RQP_LEDGER_STORE=local
```

Do not use `QAOA_RQP_LOCAL_DEV=1` or the local JSON ledger for production-like deployments.

For production-style Firestore key verification and usage counters:

```bash
gcloud run deploy qaoa-rqp-api \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars QAOA_RQP_LOCAL_DEV=0,KEY_HASH_SECRET="$KEY_HASH_SECRET",QAOA_KEY_STORE=firestore,QAOA_RQP_LEDGER_STORE=firestore
```

The Cloud Run service account must have Firestore read/write access to `qaoa_keys`, `qaoa_usage_events`, `qaoa_public_run_state`, and `qaoa_public_run_locks`. A simple project-level role for testing is `roles/datastore.user`; for production, prefer the narrowest custom role that can query `qaoa_keys`, update usage counters and active-run lock fields, create/update `qaoa_usage_events`, and acquire/release public demo slots.

## Firestore Key Admin

Create a Firestore-backed key record. The script generates a cryptographically random raw API key, stores only its HMAC-SHA256 hash, and prints the raw API key exactly once:

```bash
cd "/Users/danielhug/code/qubit-lab/QAOA-Optimizer"
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

New key records initialize `active_run_id`, `active_run_started_at`, `active_run_status`, `active_run_user_agent`, and `active_run_ip` to null. Existing key records without these fields still work; the admin display treats them as one active run allowed and idle.

Useful admin commands:

```bash
KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" list

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" show \
  --key-id "demo-qualified-001"

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" inspect \
  --api-key "$RAW_API_KEY"

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" revoke \
  --key-id "demo-qualified-001"

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" activate \
  --key-id "demo-qualified-001"

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" clear-lock \
  --key-id "demo-qualified-001" \
  --confirm

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" usage \
  --key-id "demo-qualified-001" \
  --limit 20

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" runs \
  --days 30 \
  --usage-level public_demo \
  --limit 50

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" usage-summary \
  --days 30

KEY_HASH_SECRET="$KEY_HASH_SECRET" \
  .venv/bin/python "Version 7/scripts/key_admin_firestore.py" public-status
```

`list` includes a compact `active` column (`idle` or `running`). `show` includes lock fields and hides `key_hash` unless `--show-hash` is passed. `inspect` accepts a raw key only to hash and locate the Firestore record; it does not print the raw key or hash. `clear-lock` is for admin recovery only and does nothing unless `--confirm` is provided.

Run-view commands:

- `usage --key-id ...` lists recent usage for one authenticated key.
- `runs --days 30 --usage-level public_demo` lists recent public/no-key runs from `qaoa_usage_events`.
- `usage-summary --days 30` prints aggregate completed/rejected/failed/public/authenticated counts, including public capacity rejections.
- `public-status` shows `qaoa_public_run_state/global` and currently running public locks without exposing raw IPs or raw user-agent values.

## Firestore Smoke Test

After deploying Cloud Run with Firestore mode and creating a Firestore-backed test key, run:

```bash
cd "/Users/danielhug/code/qubit-lab/QAOA-Optimizer"
QAOA_RQP_TEST_API_KEY="NEW-RAW-KEY" \
  .venv/bin/python "Version 7/scripts/smoke_test_cloudrun_firestore.py" \
  "https://qaoa-rqp-api-186148318189.europe-west6.run.app" \
  "/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx"
```

The smoke test calls `/capabilities`, checks `/license-status`, runs `mode=classical_only` with `response_level=compact`, checks `/license-status` again, and verifies `used_runs +1` and `remaining_runs -1`. It never prints the raw API key.

## Cloud Run Tests

Health:

```bash
curl https://qaoa-rqp-api-186148318189.europe-west6.run.app/health
```

`DEMO-123` compact call:

```bash
curl -X POST https://qaoa-rqp-api-186148318189.europe-west6.run.app/run-qaoa \
  -H "X-API-Key: DEMO-123" \
  -F "mode=classical_only" \
  -F "response_level=compact" \
  -F "file=@/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx" | python3 -m json.tool
```

## Implementation Notes

- The container listens on the `PORT` environment variable, normally `8080` on Cloud Run.
- Temporary uploads are written to the platform temp directory and deleted after each request.
- Prior output sheets are ignored for workbook introspection and optimization input handling.
- `/inspect-workbook` builds the QUBO for summary/estimate purposes but does not execute classical search or QAOA.
- The classical path delegates to `QAOAOptimizerV61` to preserve the existing QUBO construction and fixed/variable holding covariance behavior.
- `full` response level preserves the Version 7.0.0 full response shape as closely as possible and adds license/policy metadata.
- The `reporting` object is built from the existing `QAOAOptimizerV61` result dataframes after classical result generation.
- Key and ledger stores are interface-like so local/mock and Firestore modes preserve the same API behavior.
- `/ledger-summary` is available only when `QAOA_RQP_LOCAL_DEV=1`; it is blocked in production mode.
- Docker uses JSON exec-form `CMD` with `app/gunicorn_conf.py` reading the `PORT` environment variable.
- Before commercial use, the API still needs IP/user abuse controls, fixed-holdings regression cases, operational monitoring, and QAOA integration.
