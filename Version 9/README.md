# QAOA RQP API - Version 9.0.0

Version 9 creates an asynchronous Cloud Run Jobs backend based on Version 7.
The optimizer math, QUBO construction, workbook parsing, license policy, HMAC
key hashing, Firestore key store, usage ledger, and run-lock behavior are kept
from Version 7.

The new main path is:

```text
POST /run-qaoa-async -> qaoa_jobs_v9 document -> Cloud Run Job worker -> poll status/result
```

Version 7's synchronous `/run-qaoa` route is still present for compatibility and
legacy tests, but long QAOA runs should use the async job flow.

## Endpoints

- `GET /`
- `GET /health`
- `GET /capabilities`
- `GET /license-status`
- `POST /inspect-workbook`
- `POST /run-qaoa`, legacy synchronous path
- `POST /run-qaoa-async`, new async submission path
- `GET /jobs/{job_id}/status`
- `GET /jobs/{job_id}/result`
- `POST /jobs/{job_id}/cancel`

`POST /run-qaoa-async` accepts the same multipart workbook upload and form
fields as `/run-qaoa` where practical. It validates the key, policy, workbook,
QUBO size, runtime limits, and active-run lock before creating the job.

Optional form fields include `mode`, `response_level`, `layers`, `iterations`,
`restarts`, `warm_start`, `lambda_budget`, `lambda_variance`, `risk_free_rate`,
`restart_perturbation`, `qaoa_shots`, and `random_seed`.

`random_seed` is optional. Empty or missing means auto/unset unless the workbook
contains a random-seed setting such as `rng_seed`. The same seed improves
reproducibility for the same workbook, code, settings, and environment, but exact
bit-for-bit reproducibility is not guaranteed across dependency versions or
runtime environments. Accepted seeds are integers in the unsigned 32-bit range:
`0 <= random_seed <= 4294967295`.

The Version 9-facing workbook cost column is `Indicative Market Cost USD`.
The optimizer core reads that column directly for both fixed holdings and
variable blocks, then applies the existing budget normalization unchanged. For
old workbooks, Version 9 can map a legacy `Approx Cost USD` column into
`Indicative Market Cost USD` for compatibility. If both columns are present,
`Indicative Market Cost USD` is used for both the classical and QAOA paths;
differing legacy values are reported as workbook warnings.

Version 9 also supports 0 to 5 optional exact type-budget constraints. The
Assets sheet may define stable numeric columns `Type A Size` through
`Type E Size`. The Settings sheet controls them with `Additional Type
Constraints` plus `Type X Name`, `Type X Budget`, and `Type X Budget Penalty`
for each active type. These add normalized exact penalties of the form
`lambda_k * (sum_i (type_k_size_i / budget_k) * x_i - 1)^2`. See
[`docs/excel_format_v9.md`](docs/excel_format_v9.md).

Successful submission returns quickly:

```json
{
  "ok": true,
  "job_id": "job_...",
  "status": "queued",
  "status_url": "/jobs/job_.../status",
  "result_url": "/jobs/job_.../result"
}
```

## Firestore Collections

Version 9 shares the existing key and usage collections:

- `qaoa_keys`
- `qaoa_usage_events`

And uses Version 9-specific runtime collections so it can be deployed and
managed independently from Version 8:

- `qaoa_key_run_state_v9`
- `qaoa_key_run_locks_v9`
- `qaoa_public_run_state_v9`
- `qaoa_public_run_locks_v9`
- `qaoa_jobs_v9`

The job and lock collections can be overridden with:

```bash
QAOA_FIRESTORE_JOB_COLLECTION=qaoa_jobs_v9
QAOA_FIRESTORE_KEY_RUN_STATE_COLLECTION=qaoa_key_run_state_v9
QAOA_FIRESTORE_KEY_RUN_LOCK_COLLECTION=qaoa_key_run_locks_v9
QAOA_FIRESTORE_PUBLIC_RUN_STATE_COLLECTION=qaoa_public_run_state_v9
QAOA_FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION=qaoa_public_run_locks_v9
```

## Job Documents

`qaoa_jobs_v9/{job_id}` stores:

- `job_id`
- `key_hash`, HMAC hash only, never the raw key
- `key_id` or `anonymous`
- `status`: `queued`, `running`, `completed`, `failed`, `cancelled`
- `phase`
- `created_at`, `started_at`, `heartbeat_at`, `finished_at`
- `settings`
- `input.storage_path`
- `input.original_filename`
- `policy`
- `progress.progress_pct`
- `progress.iteration`
- `progress.max_iterations`
- `progress.elapsed_seconds`
- `progress.eta_seconds_low`
- `progress.eta_seconds_high`
- `latest_log`
- `logs_tail`, capped to 50 entries
- `additional_type_constraints` in diagnostics/result payloads when configured
- `result.available`
- `result.storage_path`
- `result.summary`
- `error`
- `cancel_requested`

## Storage

Uploaded workbooks and result JSON payloads are not passed through environment
variables or command arguments.

Production uses Google Cloud Storage:

```bash
QAOA_JOB_STORAGE=gcs
QAOA_JOB_BUCKET=your-bucket-name
```

Paths use:

```text
gs://{QAOA_JOB_BUCKET}/jobs/{job_id}/input.xlsx
gs://{QAOA_JOB_BUCKET}/jobs/{job_id}/result.json
```

Local development can use local filesystem storage:

```bash
QAOA_RQP_LOCAL_DEV=1
QAOA_JOB_STORE=local
QAOA_JOB_STORAGE=local
QAOA_LOCAL_JOB_DIR="Version 9/data/jobs"
```

Runtime local job files under `Version 9/data/jobs/` are ignored by git.

## Worker

The worker entrypoint is:

```bash
python -m app.job_worker --job-id JOB_ID
```

The Cloud Run Job may also pass:

```bash
JOB_ID=job_...
```

Worker phases:

- mark job `running`
- load workbook from storage
- validate workbook and rebuild the QUBO with existing Version 7/V6.1 logic
- run the classical baseline
- optionally run `qaoa_limited`
- update progress, heartbeat, and capped logs
- write the result JSON payload
- mark job `completed` or `failed`
- release the existing key/public run lock in a `finally` path

## Local Development

Start the API locally:

```bash
cd "/Users/danielhug/code/qubit-lab/QAOA-Optimizer"
cd "Version 9"
QAOA_RQP_LOCAL_DEV=1 \
QAOA_JOB_STORE=local \
QAOA_JOB_STORAGE=local \
QAOA_LOCAL_JOB_DIR="data/jobs" \
  ../.venv/bin/python -m app.main
```

Submit an async job:

```bash
curl -X POST http://127.0.0.1:8080/run-qaoa-async \
  -H "X-API-Key: TESTER-123" \
  -F "mode=classical_only" \
  -F "response_level=full" \
  -F "random_seed=12345" \
  -F "file=@/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx" \
  | python3 -m json.tool
```

Run the local worker manually:

```bash
cd "Version 9"
QAOA_RQP_LOCAL_DEV=1 \
QAOA_JOB_STORE=local \
QAOA_JOB_STORAGE=local \
QAOA_LOCAL_JOB_DIR="data/jobs" \
  ../.venv/bin/python -m app.job_worker --job-id JOB_ID
```

Poll status:

```bash
curl http://127.0.0.1:8080/jobs/JOB_ID/status | python3 -m json.tool
```

Fetch result after completion:

```bash
curl http://127.0.0.1:8080/jobs/JOB_ID/result | python3 -m json.tool
```

For local tests only, inline execution is available:

```bash
RUN_JOBS_INLINE_FOR_LOCAL=1
```

Do not use inline mode in production.

## Tests

Run:

```bash
./.venv/bin/python -m pytest "Version 9/tests/test_api.py"
```

Current expected result:

```text
102 passed
```

## Production Environment

Required production-like variables:

```bash
QAOA_RQP_LOCAL_DEV=0
KEY_HASH_SECRET=...
QAOA_KEY_STORE=firestore
QAOA_LEDGER_STORE=firestore
QAOA_JOB_STORE=firestore
QAOA_JOB_STORAGE=gcs
QAOA_JOB_BUCKET=...
QAOA_FIRESTORE_JOB_COLLECTION=qaoa_jobs_v9
QAOA_FIRESTORE_KEY_RUN_STATE_COLLECTION=qaoa_key_run_state_v9
QAOA_FIRESTORE_KEY_RUN_LOCK_COLLECTION=qaoa_key_run_locks_v9
QAOA_FIRESTORE_PUBLIC_RUN_STATE_COLLECTION=qaoa_public_run_state_v9
QAOA_FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION=qaoa_public_run_locks_v9
CLOUD_RUN_PROJECT=...
CLOUD_RUN_REGION=europe-west6
QAOA_WORKER_JOB_NAME=qaoa-rqp-worker-v9
```

Optional compatibility variable:

```bash
QAOA_RQP_LEDGER_STORE=firestore
```

## Notes

- Raw API keys are never stored in Firestore or job documents.
- `qaoa_full` remains disabled.
- `qaoa_limited` keeps the same effective usage-level limits as Version 7.
- The long-running worker is the only component expected to run for many
  minutes. The API service should return quickly.
- Authenticated `max_parallel_runs` is enforced with per-run lock documents.
  A key can run up to its configured active-run count, stale/dead locks can be
  recovered from job status/heartbeat, and `clear-lock --confirm` remains the
  manual admin recovery path.
