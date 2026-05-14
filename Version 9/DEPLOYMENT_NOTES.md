# Version 9.2.0 Deployment Notes

Version 9 uses the same container image for two Cloud Run targets:

- API: Cloud Run service, handling HTTP validation, workbook upload, job creation, lock acquisition, and worker triggering.
- Worker: Cloud Run Job, running `python -m app.job_worker` for one `JOB_ID`.

The async production path uses Version 9 Firestore job/lock collections, existing Firestore key/usage collections, and a Version 9 GCS bucket for uploaded workbooks and result JSON payloads. Version 8 service, worker, job collection, lock collections, and bucket remain separate.

IBM hardware second-opinion runs use the existing Qiskit circuit build path plus
real IBM backend execution. For production, the API stores each submitted IBM
token as a short-lived per-job Secret Manager secret, the worker reads it once,
and the worker deletes it in a `finally` path after the hardware run completes
or fails.

## Shell Variables

Set these once from the repository root. Do not hardcode the project ID in commands.

```bash
PROJECT_ID="$(gcloud config get-value project)"
REGION="europe-west6"
AR_REPO="qaoa-rqp"
API_SERVICE_NAME="qaoa-rqp-api-v9"
WORKER_JOB_SMALL_NAME="qaoa-rqp-worker-small"
WORKER_JOB_MEDIUM_NAME="qaoa-rqp-worker-medium"
WORKER_JOB_LARGE_NAME="qaoa-rqp-worker-large"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/qaoa-rqp-api:9.2.0"
QAOA_JOB_BUCKET="qaoa-rqp-jobs-v9-$PROJECT_ID"

API_SERVICE_ACCOUNT="qaoa-rqp-api-v9@$PROJECT_ID.iam.gserviceaccount.com"
WORKER_SERVICE_ACCOUNT="qaoa-rqp-worker-v9@$PROJECT_ID.iam.gserviceaccount.com"

# Use the same HMAC secret that was used to create Firestore key hashes.
# For production, prefer Secret Manager. For a first smoke deployment, exporting
# this shell variable and passing it as an env var is acceptable.
export KEY_HASH_SECRET="replace-with-your-real-secret"
```

## Required API Environment

The API service needs:

```bash
cat > /tmp/qaoa-v9-api-env.yaml <<EOF
QAOA_RQP_LOCAL_DEV: "0"
KEY_HASH_SECRET: "$KEY_HASH_SECRET"
QAOA_KEY_STORE: "firestore"
QAOA_LEDGER_STORE: "firestore"
QAOA_JOB_STORE: "firestore"
QAOA_JOB_STORAGE: "gcs"
QAOA_JOB_BUCKET: "$QAOA_JOB_BUCKET"
QAOA_FIRESTORE_JOB_COLLECTION: "qaoa_jobs_v9"
QAOA_FIRESTORE_KEY_RUN_STATE_COLLECTION: "qaoa_key_run_state_v9"
QAOA_FIRESTORE_KEY_RUN_LOCK_COLLECTION: "qaoa_key_run_locks_v9"
QAOA_FIRESTORE_PUBLIC_RUN_STATE_COLLECTION: "qaoa_public_run_state_v9"
QAOA_FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION: "qaoa_public_run_locks_v9"
CLOUD_RUN_PROJECT: "$PROJECT_ID"
CLOUD_RUN_REGION: "$REGION"
QAOA_WORKER_JOB_SMALL_NAME: "$WORKER_JOB_SMALL_NAME"
QAOA_WORKER_JOB_MEDIUM_NAME: "$WORKER_JOB_MEDIUM_NAME"
QAOA_WORKER_JOB_LARGE_NAME: "$WORKER_JOB_LARGE_NAME"
EOF
```

`CLOUD_RUN_PROJECT`, `CLOUD_RUN_REGION`, and the `QAOA_WORKER_JOB_*_NAME`
profile variables are used by the API trigger helper. If the profile variables
are omitted, the backend defaults to `qaoa-rqp-worker-small`,
`qaoa-rqp-worker-medium`, and `qaoa-rqp-worker-large`.

## Required Worker Environment

The worker job needs access to the same Firestore and GCS resources. `JOB_ID` is supplied per execution by the API service or manual smoke command.

```bash
cat > /tmp/qaoa-v9-worker-env.yaml <<EOF
QAOA_RQP_LOCAL_DEV: "0"
KEY_HASH_SECRET: "$KEY_HASH_SECRET"
QAOA_KEY_STORE: "firestore"
QAOA_LEDGER_STORE: "firestore"
QAOA_JOB_STORE: "firestore"
QAOA_JOB_STORAGE: "gcs"
QAOA_JOB_BUCKET: "$QAOA_JOB_BUCKET"
QAOA_FIRESTORE_JOB_COLLECTION: "qaoa_jobs_v9"
QAOA_FIRESTORE_KEY_RUN_STATE_COLLECTION: "qaoa_key_run_state_v9"
QAOA_FIRESTORE_KEY_RUN_LOCK_COLLECTION: "qaoa_key_run_locks_v9"
QAOA_FIRESTORE_PUBLIC_RUN_STATE_COLLECTION: "qaoa_public_run_state_v9"
QAOA_FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION: "qaoa_public_run_locks_v9"
CLOUD_RUN_PROJECT: "$PROJECT_ID"
CLOUD_RUN_REGION: "$REGION"
QAOA_WORKER_JOB_SMALL_NAME: "$WORKER_JOB_SMALL_NAME"
QAOA_WORKER_JOB_MEDIUM_NAME: "$WORKER_JOB_MEDIUM_NAME"
QAOA_WORKER_JOB_LARGE_NAME: "$WORKER_JOB_LARGE_NAME"
EOF
```

## Enable APIs

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  iam.googleapis.com \
  --project "$PROJECT_ID"
```

## Artifact Registry And Image Build

Create the Artifact Registry repository if needed:

```bash
gcloud artifacts repositories describe "$AR_REPO" \
  --location "$REGION" \
  --project "$PROJECT_ID" \
  || gcloud artifacts repositories create "$AR_REPO" \
    --repository-format docker \
    --location "$REGION" \
    --description "QAOA RQP container images" \
    --project "$PROJECT_ID"
```

Build and push the linux/amd64 image with Cloud Build:

```bash
cat > /tmp/qaoa-v9-cloudbuild.yaml <<EOF
steps:
  - name: "gcr.io/cloud-builders/docker"
    args:
      - "build"
      - "--platform"
      - "linux/amd64"
      - "-f"
      - "Version 9/Dockerfile"
      - "-t"
      - "$IMAGE"
      - "."
images:
  - "$IMAGE"
EOF

gcloud builds submit \
  --project "$PROJECT_ID" \
  --config /tmp/qaoa-v9-cloudbuild.yaml \
  .
```

Local Apple Silicon build alternative:

```bash
docker build --platform linux/amd64 \
  -f "Version 9/Dockerfile" \
  -t "$IMAGE" .

docker push "$IMAGE"
```

## GCS Bucket

Create the job payload bucket if needed:

```bash
gcloud storage buckets describe "gs://$QAOA_JOB_BUCKET" \
  --project "$PROJECT_ID" \
  || gcloud storage buckets create "gs://$QAOA_JOB_BUCKET" \
    --project "$PROJECT_ID" \
    --location "$REGION" \
    --uniform-bucket-level-access
```

The API writes `jobs/{job_id}/input.xlsx`, and the worker writes `jobs/{job_id}/result.json`.

Workbook cost input should use `Indicative Market Cost USD` in the `Assets`
sheet. The optimizer core reads this column directly for fixed holdings and
variable blocks, then applies the existing budget normalization unchanged. For
old workbooks, Version 9 can map a legacy `Approx Cost USD` column into
`Indicative Market Cost USD` for compatibility.

Version 9 workbooks may also define optional subtype budget constraints:
`Additional Type Constraints` in `Settings`, plus `Type A Size` through
`Type E Size` in `Assets` and the corresponding `Type X Name`, `Type X Budget`,
and `Type X Budget Penalty` settings. These exact subtype budgets are V9-only
workbook additions; Version 8 workbooks without them continue to run unchanged.

## Service Accounts

Create dedicated service accounts if needed:

```bash
gcloud iam service-accounts describe "$API_SERVICE_ACCOUNT" \
  --project "$PROJECT_ID" \
  || gcloud iam service-accounts create qaoa-rqp-api-v9 \
    --display-name "QAOA RQP API v9" \
    --project "$PROJECT_ID"

gcloud iam service-accounts describe "$WORKER_SERVICE_ACCOUNT" \
  --project "$PROJECT_ID" \
  || gcloud iam service-accounts create qaoa-rqp-worker-v9 \
    --display-name "QAOA RQP Worker v9" \
    --project "$PROJECT_ID"
```

## IAM Grants

Grant both runtime service accounts access to Firestore and the GCS bucket:

```bash
for SA in "$API_SERVICE_ACCOUNT" "$WORKER_SERVICE_ACCOUNT"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:$SA" \
    --role "roles/datastore.user"

  gcloud storage buckets add-iam-policy-binding "gs://$QAOA_JOB_BUCKET" \
    --member "serviceAccount:$SA" \
    --role "roles/storage.objectAdmin"
done
```

Grant both runtime service accounts permission to create/read/delete the
transient IBM token secrets used for hardware runs:

```bash
for SA in "$API_SERVICE_ACCOUNT" "$WORKER_SERVICE_ACCOUNT"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:$SA" \
    --role "roles/secretmanager.admin"
done
```

If execution fails with an `actAs` or service-account impersonation error, grant the API service account permission to use the worker service account:

```bash
gcloud iam service-accounts add-iam-policy-binding "$WORKER_SERVICE_ACCOUNT" \
  --project "$PROJECT_ID" \
  --member "serviceAccount:$API_SERVICE_ACCOUNT" \
  --role "roles/iam.serviceAccountUser"
```

The deployer running the commands also needs permission to deploy the API service and worker job and to act as both runtime service accounts.

## Deploy Or Update API Service

```bash
gcloud run deploy "$API_SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --service-account "$API_SERVICE_ACCOUNT" \
  --allow-unauthenticated \
  --timeout 300s \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 20 \
  --env-vars-file /tmp/qaoa-v9-api-env.yaml
```

Get the deployed service URL:

```bash
SERVICE_URL="$(gcloud run services describe "$API_SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format 'value(status.url)')"
echo "$SERVICE_URL"
```

## Create Or Update Worker Job

Version 9 uses selectable worker profiles. Each profile maps to a predefined
Cloud Run Job because CPU and memory are configured on the job definition, not
per execution override.

Profiles:

- Small: `qaoa-rqp-worker-small`, 2 vCPU, 2 GiB RAM, demo/trial/power.
- Medium: `qaoa-rqp-worker-medium`, 4 vCPU, 4 GiB RAM, trial/power.
- Large: `qaoa-rqp-worker-large`, 4 vCPU, 8 GiB RAM, power.

Create the worker jobs:

```bash
gcloud run jobs create "$WORKER_JOB_SMALL_NAME" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$WORKER_SERVICE_ACCOUNT" \
  --command=python \
  --args=-m,app.job_worker \
  --tasks 1 \
  --max-retries 0 \
  --task-timeout 72h \
  --memory 2Gi \
  --cpu 2 \
  --env-vars-file /tmp/qaoa-v9-worker-env.yaml

gcloud run jobs create "$WORKER_JOB_MEDIUM_NAME" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$WORKER_SERVICE_ACCOUNT" \
  --command=python \
  --args=-m,app.job_worker \
  --tasks 1 \
  --max-retries 0 \
  --task-timeout 72h \
  --memory 4Gi \
  --cpu 4 \
  --env-vars-file /tmp/qaoa-v9-worker-env.yaml

gcloud run jobs create "$WORKER_JOB_LARGE_NAME" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$WORKER_SERVICE_ACCOUNT" \
  --command=python \
  --args=-m,app.job_worker \
  --tasks 1 \
  --max-retries 0 \
  --task-timeout 72h \
  --memory 8Gi \
  --cpu 4 \
  --env-vars-file /tmp/qaoa-v9-worker-env.yaml
```

Update existing worker jobs:

```bash
gcloud run jobs update "$WORKER_JOB_SMALL_NAME" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$WORKER_SERVICE_ACCOUNT" \
  --command=python \
  --args=-m,app.job_worker \
  --tasks 1 \
  --max-retries 0 \
  --task-timeout 72h \
  --memory 2Gi \
  --cpu 2 \
  --env-vars-file /tmp/qaoa-v9-worker-env.yaml

gcloud run jobs update "$WORKER_JOB_MEDIUM_NAME" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$WORKER_SERVICE_ACCOUNT" \
  --command=python \
  --args=-m,app.job_worker \
  --tasks 1 \
  --max-retries 0 \
  --task-timeout 72h \
  --memory 4Gi \
  --cpu 4 \
  --env-vars-file /tmp/qaoa-v9-worker-env.yaml

gcloud run jobs update "$WORKER_JOB_LARGE_NAME" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$WORKER_SERVICE_ACCOUNT" \
  --command=python \
  --args=-m,app.job_worker \
  --tasks 1 \
  --max-retries 0 \
  --task-timeout 72h \
  --memory 8Gi \
  --cpu 4 \
  --env-vars-file /tmp/qaoa-v9-worker-env.yaml
```

Grant the API service account permission to execute the worker job after the job exists. The `roles/run.developer` role includes the Cloud Run job execution permissions needed for execution overrides such as `JOB_ID`.

```bash
for JOB_NAME in "$WORKER_JOB_SMALL_NAME" "$WORKER_JOB_MEDIUM_NAME" "$WORKER_JOB_LARGE_NAME"; do
  gcloud run jobs add-iam-policy-binding "$JOB_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --member "serviceAccount:$API_SERVICE_ACCOUNT" \
    --role "roles/run.developer"
done
```

## Manual Worker Smoke Test

If a queued `job_id` already exists in `qaoa_jobs_v9`, manually execute the worker:

```bash
JOB_ID="job_replace_me"
WORKER_JOB_NAME="$WORKER_JOB_SMALL_NAME"  # or medium/large for that job's worker_profile

gcloud run jobs execute "$WORKER_JOB_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --update-env-vars "JOB_ID=$JOB_ID" \
  --task-timeout 72h \
  --wait
```

## Curl Smoke Tests

Set a workbook path and, for authenticated tests, an API key. Do not print the raw key in logs.

```bash
WORKBOOK="/Users/danielhug/code/qubit-lab/QAOA-Optimizer/Version 3/parametric_assets_only_input_small.xlsx"
export QAOA_RQP_TEST_API_KEY="replace-with-test-key"
```

Health:

```bash
curl "$SERVICE_URL/health"
```

Inspect workbook:

```bash
curl -X POST "$SERVICE_URL/inspect-workbook" \
  -H "X-API-Key: $QAOA_RQP_TEST_API_KEY" \
  -F "mode=classical_only" \
  -F "worker_profile=small" \
  -F "random_seed=12345" \
  -F "file=@$WORKBOOK" \
  | python3 -m json.tool
```

Submit async job:

```bash
JOB_ID="$(
  curl -sS -X POST "$SERVICE_URL/run-qaoa-async" \
    -H "X-API-Key: $QAOA_RQP_TEST_API_KEY" \
    -F "mode=classical_only" \
    -F "response_level=full" \
    -F "worker_profile=small" \
    -F "random_seed=12345" \
    -F "file=@$WORKBOOK" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["job_id"])'
)"
echo "$JOB_ID"
```

Poll status:

```bash
curl "$SERVICE_URL/jobs/$JOB_ID/status" | python3 -m json.tool
```

Fetch result:

```bash
curl "$SERVICE_URL/jobs/$JOB_ID/result" | python3 -m json.tool
```

If the job is still running, `/jobs/{job_id}/result` returns HTTP `409` with `code=job_not_completed`.

## Firestore Collections

Version 9 reads/writes these collections by default:

- `qaoa_keys`
- `qaoa_usage_events`
- `qaoa_key_run_state_v9`
- `qaoa_key_run_locks_v9`
- `qaoa_public_run_state_v9`
- `qaoa_public_run_locks_v9`
- `qaoa_jobs_v9`

The job and lock collections can be overridden with the `QAOA_FIRESTORE_*`
environment variables. The deployment commands above keep Version 9 runtime
state separate from Version 8 while sharing the existing key and usage
collections.

## Progress And Logs

The worker stores status in `qaoa_jobs_v9/{job_id}`:

- `status`
- `phase`
- `progress.progress_pct`
- `progress.iteration`
- `progress.max_iterations`
- `progress.elapsed_seconds`
- `progress.eta_seconds_low`
- `progress.eta_seconds_high`
- `latest_log`
- `logs_tail`, capped to 50 entries
- `heartbeat_at`
- `worker_profile`
- `worker_profile_label`
- `configured_cpu`
- `configured_memory_gib`
- `worker_job_name`
- `memory_used_gib`
- `memory_limit_gib`
- `memory_remaining_gib`
- `memory_used_pct`
- `peak_memory_used_gib`
- `memory_history`
- `result.available`
- `result.storage_path`
- `error`

Progress ranges:

- 0-5%: accepted/input loading
- 5-15%: workbook validation and QUBO construction
- 15-90%: optimization
- 90-97%: result processing
- 97-100%: finalization

## Locking And Usage

- Authenticated jobs acquire a per-key run slot at submission time. Each active
  run has its own lock document, so keys with `max_parallel_runs > 1` can run
  multiple jobs concurrently up to that limit.
- Public/no-key jobs acquire the public demo semaphore at submission time.
- If Cloud Run Job triggering fails, the API releases the acquired lock/slot.
- The worker releases the lock/slot in a `finally` path on completed, failed,
  cancelled, and handled termination-signal paths.
- Stale authenticated locks can be cleared automatically when the linked job is
  completed/failed/cancelled or its heartbeat is stale. Admin recovery is still
  available with `scripts/key_admin_firestore.py clear-lock --key-id ... --confirm`.
- Successful authenticated completed jobs consume one run.
- Failed/cancelled/rejected jobs do not consume a run.

## Current Limits

- `qaoa_full` remains disabled.
- `qaoa_limited` runs inside the worker task, not inside the HTTP request.
- Cancellation is cooperative. Queued jobs can be cancelled immediately; fine-grained cancellation during optimizer iterations is future work.
- `random_seed` is optional. Reusing the same integer seed improves reproducibility
  under the same workbook/settings/code/environment, but exact bit-for-bit
  reproducibility is not guaranteed across runtime or dependency changes.
