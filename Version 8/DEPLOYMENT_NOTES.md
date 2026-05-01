# Version 8.0.0 Deployment Notes

Version 8 moves long optimizer execution out of the HTTP request path and into a
Cloud Run Job worker.

The API service handles validation, job creation, input upload, run-lock
acquisition, and worker triggering. The worker handles the optimizer run,
progress/log updates, result writing, usage-event recording, and lock release.

## Build And Push

From the repository root:

```bash
PROJECT_ID="$(gcloud config get-value project)"
REGION="europe-west6"
REPO="qaoa-rqp"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/qaoa-rqp-api:8.0.0"

docker build --platform linux/amd64 \
  -f "Version 8/Dockerfile" \
  -t "$IMAGE" .

docker push "$IMAGE"
```

## Storage Bucket

Create or choose a GCS bucket for job input/result payloads:

```bash
JOB_BUCKET="qaoa-rqp-jobs-$PROJECT_ID"
gcloud storage buckets create "gs://$JOB_BUCKET" \
  --location "$REGION"
```

The bucket name is passed to both the API service and worker job:

```bash
QAOA_JOB_BUCKET="$JOB_BUCKET"
```

## Deploy API Service

The service should return quickly. It still exposes legacy `/run-qaoa`, but the
main long-run path is `/run-qaoa-async`.

```bash
gcloud run deploy qaoa-rqp-api-v8 \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars QAOA_RQP_LOCAL_DEV=0,KEY_HASH_SECRET="$KEY_HASH_SECRET",QAOA_KEY_STORE=firestore,QAOA_LEDGER_STORE=firestore,QAOA_JOB_STORE=firestore,QAOA_JOB_STORAGE=gcs,QAOA_JOB_BUCKET="$JOB_BUCKET",CLOUD_RUN_PROJECT="$PROJECT_ID",CLOUD_RUN_REGION="$REGION",QAOA_WORKER_JOB_NAME=qaoa-rqp-worker
```

## Create Or Update Worker Job

Create the worker job:

```bash
gcloud run jobs create qaoa-rqp-worker \
  --image "$IMAGE" \
  --region "$REGION" \
  --command python \
  --args -m,app.job_worker \
  --task-timeout 7200 \
  --set-env-vars QAOA_RQP_LOCAL_DEV=0,KEY_HASH_SECRET="$KEY_HASH_SECRET",QAOA_KEY_STORE=firestore,QAOA_LEDGER_STORE=firestore,QAOA_JOB_STORE=firestore,QAOA_JOB_STORAGE=gcs,QAOA_JOB_BUCKET="$JOB_BUCKET",CLOUD_RUN_PROJECT="$PROJECT_ID",CLOUD_RUN_REGION="$REGION",QAOA_WORKER_JOB_NAME=qaoa-rqp-worker
```

Update an existing worker job:

```bash
gcloud run jobs update qaoa-rqp-worker \
  --image "$IMAGE" \
  --region "$REGION" \
  --command python \
  --args -m,app.job_worker \
  --task-timeout 7200 \
  --set-env-vars QAOA_RQP_LOCAL_DEV=0,KEY_HASH_SECRET="$KEY_HASH_SECRET",QAOA_KEY_STORE=firestore,QAOA_LEDGER_STORE=firestore,QAOA_JOB_STORE=firestore,QAOA_JOB_STORAGE=gcs,QAOA_JOB_BUCKET="$JOB_BUCKET",CLOUD_RUN_PROJECT="$PROJECT_ID",CLOUD_RUN_REGION="$REGION",QAOA_WORKER_JOB_NAME=qaoa-rqp-worker
```

The API triggers executions by passing `JOB_ID` as an execution override.

## IAM

The API service account needs permission to execute the worker job. For example:

```bash
API_SA="$(gcloud run services describe qaoa-rqp-api-v8 \
  --region "$REGION" \
  --format='value(spec.template.spec.serviceAccountName)')"

gcloud run jobs add-iam-policy-binding qaoa-rqp-worker \
  --region "$REGION" \
  --member "serviceAccount:$API_SA" \
  --role "roles/run.developer"
```

Both the API service account and worker service account need:

- Firestore access to `qaoa_keys`, `qaoa_usage_events`, `qaoa_public_run_state`,
  `qaoa_public_run_locks`, and `qaoa_jobs`.
- GCS read/write access to `QAOA_JOB_BUCKET`.

For smoke testing, `roles/datastore.user` plus bucket object read/write access is
usually enough. For production, prefer a narrow custom role.

## Manual Worker Execution

For a queued job document:

```bash
gcloud run jobs execute qaoa-rqp-worker \
  --region "$REGION" \
  --update-env-vars JOB_ID="job_..."
```

Alternatively, run locally with local job storage:

```bash
cd "/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 8"
QAOA_RQP_LOCAL_DEV=1 \
QAOA_JOB_STORE=local \
QAOA_JOB_STORAGE=local \
QAOA_LOCAL_JOB_DIR="data/jobs" \
  ../.venv/bin/python -m app.job_worker --job-id JOB_ID
```

## Submit And Poll

Submit:

```bash
curl -X POST "$SERVICE_URL/run-qaoa-async" \
  -H "X-API-Key: $QAOA_RQP_TEST_API_KEY" \
  -F "mode=qaoa_limited" \
  -F "layers=4" \
  -F "iterations=30" \
  -F "restarts=1" \
  -F "warm_start=true" \
  -F "response_level=full" \
  -F "file=@/path/to/input.xlsx" \
  | python3 -m json.tool
```

Poll:

```bash
curl "$SERVICE_URL/jobs/JOB_ID/status" | python3 -m json.tool
```

Fetch result:

```bash
curl "$SERVICE_URL/jobs/JOB_ID/result" | python3 -m json.tool
```

If the job is still running, `/jobs/{job_id}/result` returns HTTP `409` with
`code=job_not_completed`.

## Progress Model

The worker stores progress in `qaoa_jobs/{job_id}.progress`.

Intended ranges:

- 0-5%: accepted/input loading
- 5-15%: workbook validation and QUBO construction
- 15-90%: optimization
- 90-97%: result processing
- 97-100%: finalization

`eta_seconds_high` is set to roughly `eta_seconds_low * 1.4`.

`logs_tail` is capped at 50 messages. Full unbounded logs are not stored in the
job document.

## Locking And Usage

- Authenticated jobs acquire the existing per-key lock at submission time.
- Public/no-key jobs acquire the existing public demo semaphore at submission
  time.
- The worker releases the lock/semaphore in a `finally` path.
- Successful authenticated completed jobs consume one run.
- Failed/cancelled/rejected jobs do not consume a run.

## Current Limits

- `qaoa_full` remains disabled.
- `qaoa_limited` remains synchronous inside the worker task, but not inside the
  HTTP request.
- Cancellation is cooperative: queued jobs can be cancelled immediately; running
  jobs see `cancel_requested`, but fine-grained iteration cancellation is future
  work.
