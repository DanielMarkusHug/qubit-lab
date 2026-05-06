# Version 9.0.0 Implementation Summary

Started a new Version 9 backend from the tagged Version 8 Cloud Run Jobs
baseline, keeping Version 8 deployable as-is.

## Added

- `POST /run-qaoa-async`
- `GET /jobs/{job_id}/status`
- `GET /jobs/{job_id}/result`
- `POST /jobs/{job_id}/cancel`
- `app/job_worker.py`
- `app/job_store.py`
- `app/job_storage.py`
- `app/cloud_run_jobs.py`
- `app/type_constraints.py`

## Version 9 Feature Extension

- Optional exact type-budget constraints, controlled by `Additional Type
  Constraints` and `Type A` through `Type E` settings.
- Stable `Assets` columns: `Type A Size`, `Type B Size`, `Type C Size`,
  `Type D Size`, and `Type E Size`.
- Normalized portfolio-level QUBO penalties:
  `lambda_k * ((fixed_type_exposure_k + sum_i variable_type_size_i * x_i) / budget_k - 1)^2`.
- Result diagnostics and candidate rows include per-type achieved amounts,
  deviations, relative deviations, and penalty contributions.

## Preserved

- Existing optimizer math.
- Existing QUBO construction.
- Existing workbook parsing.
- Existing result payload generation.
- Existing HMAC key hashing.
- Existing Firestore key/usage collections.
- Existing authenticated per-key run-slot behavior.
- Existing public demo semaphore behavior, using Version 9-specific runtime
  lock collections by default.
- Existing `/run-qaoa` route for legacy testing.

## Storage

- Job documents: `qaoa_jobs_v9` by default.
- Runtime lock collections: `qaoa_key_run_state_v9`,
  `qaoa_key_run_locks_v9`, `qaoa_public_run_state_v9`, and
  `qaoa_public_run_locks_v9` by default.
- Production input/result storage: GCS through `QAOA_JOB_BUCKET`.
- Local development storage: `Version 9/data/jobs`.

## Worker

The worker runs with:

```bash
python -m app.job_worker --job-id JOB_ID
```

It loads the job document, downloads the workbook, runs the existing optimizer
path, updates progress/logs, writes the result JSON, marks completion/failure,
and releases the active run lock.

## Tests

Version 9 tests include the copied Version 7 behavior plus async job submission,
status/result, and worker success/failure lock release checks.

Current result:

```text
102 passed
```
