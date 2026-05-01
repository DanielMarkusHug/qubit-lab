# Version 8.0.0 Implementation Summary

Implemented a new Version 8 backend alongside Version 7.

## Added

- `POST /run-qaoa-async`
- `GET /jobs/{job_id}/status`
- `GET /jobs/{job_id}/result`
- `POST /jobs/{job_id}/cancel`
- `app/job_worker.py`
- `app/job_store.py`
- `app/job_storage.py`
- `app/cloud_run_jobs.py`

## Preserved

- Existing optimizer math.
- Existing QUBO construction.
- Existing workbook parsing.
- Existing result payload generation.
- Existing HMAC key hashing.
- Existing Firestore key/usage collections.
- Existing authenticated per-key lock behavior.
- Existing public demo semaphore behavior.
- Existing `/run-qaoa` route for legacy testing.

## Storage

- Job documents: `qaoa_jobs`.
- Production input/result storage: GCS through `QAOA_JOB_BUCKET`.
- Local development storage: `Version 8/data/jobs`.

## Worker

The worker runs with:

```bash
python -m app.job_worker --job-id JOB_ID
```

It loads the job document, downloads the workbook, runs the existing optimizer
path, updates progress/logs, writes the result JSON, marks completion/failure,
and releases the active run lock.

## Tests

Version 8 tests include the copied Version 7 behavior plus async job submission,
status/result, and worker success/failure lock release checks.

Current result:

```text
71 passed
```
