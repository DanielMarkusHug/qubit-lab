# Version 8.0.0 Deployment Notes

Version 8 uses the same container image for two Cloud Run targets:

- API: Cloud Run service, handling HTTP validation, workbook upload, job creation, lock acquisition, and worker triggering.
- Worker: Cloud Run Job, running `python -m app.job_worker` for one `JOB_ID`.

The async production path uses Firestore for `qaoa_jobs`, existing Firestore key/usage collections, and GCS for uploaded workbooks and result JSON payloads.

## Shell Variables

Set these once from the repository root. Do not hardcode the project ID in commands.

```bash
PROJECT_ID="$(gcloud config get-value project)"
REGION="europe-west6"
AR_REPO="qaoa-rqp"
API_SERVICE_NAME="qaoa-rqp-api-v8"
WORKER_JOB_NAME="qaoa-rqp-worker-v8"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/qaoa-rqp-api:8.0.0"
QAOA_JOB_BUCKET="qaoa-rqp-jobs-$PROJECT_ID"

API_SERVICE_ACCOUNT="qaoa-rqp-api-v8@$PROJECT_ID.iam.gserviceaccount.com"
WORKER_SERVICE_ACCOUNT="qaoa-rqp-worker-v8@$PROJECT_ID.iam.gserviceaccount.com"

# Use the same HMAC secret that was used to create Firestore key hashes.
# For production, prefer Secret Manager. For a first smoke deployment, exporting
# this shell variable and passing it as an env var is acceptable.
export KEY_HASH_SECRET="replace-with-your-real-secret"
```

## Required API Environment

The API service needs:

```bash
cat > /tmp/qaoa-v8-api-env.yaml <<EOF
QAOA_RQP_LOCAL_DEV: "0"
KEY_HASH_SECRET: "$KEY_HASH_SECRET"
QAOA_KEY_STORE: "firestore"
QAOA_LEDGER_STORE: "firestore"
QAOA_JOB_STORE: "firestore"
QAOA_JOB_STORAGE: "gcs"
QAOA_JOB_BUCKET: "$QAOA_JOB_BUCKET"
QAOA_FIRESTORE_JOB_COLLECTION: "qaoa_jobs"
CLOUD_RUN_PROJECT: "$PROJECT_ID"
CLOUD_RUN_REGION: "$REGION"
QAOA_WORKER_JOB_NAME: "$WORKER_JOB_NAME"
EOF
```

`CLOUD_RUN_PROJECT`, `CLOUD_RUN_REGION`, and `QAOA_WORKER_JOB_NAME` are required by the API trigger helper.

## Required Worker Environment

The worker job needs access to the same Firestore and GCS resources. `JOB_ID` is supplied per execution by the API service or manual smoke command.

```bash
cat > /tmp/qaoa-v8-worker-env.yaml <<EOF
QAOA_RQP_LOCAL_DEV: "0"
KEY_HASH_SECRET: "$KEY_HASH_SECRET"
QAOA_KEY_STORE: "firestore"
QAOA_LEDGER_STORE: "firestore"
QAOA_JOB_STORE: "firestore"
QAOA_JOB_STORAGE: "gcs"
QAOA_JOB_BUCKET: "$QAOA_JOB_BUCKET"
QAOA_FIRESTORE_JOB_COLLECTION: "qaoa_jobs"
CLOUD_RUN_PROJECT: "$PROJECT_ID"
CLOUD_RUN_REGION: "$REGION"
QAOA_WORKER_JOB_NAME: "$WORKER_JOB_NAME"
EOF
```

## Enable APIs

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
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
cat > /tmp/qaoa-v8-cloudbuild.yaml <<EOF
steps:
  - name: "gcr.io/cloud-builders/docker"
    args:
      - "build"
      - "--platform"
      - "linux/amd64"
      - "-f"
      - "Version 8/Dockerfile"
      - "-t"
      - "$IMAGE"
      - "."
images:
  - "$IMAGE"
EOF

gcloud builds submit \
  --project "$PROJECT_ID" \
  --config /tmp/qaoa-v8-cloudbuild.yaml \
  .
```

Local Apple Silicon build alternative:

```bash
docker build --platform linux/amd64 \
  -f "Version 8/Dockerfile" \
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

## Service Accounts

Create dedicated service accounts if needed:

```bash
gcloud iam service-accounts describe "$API_SERVICE_ACCOUNT" \
  --project "$PROJECT_ID" \
  || gcloud iam service-accounts create qaoa-rqp-api-v8 \
    --display-name "QAOA RQP API v8" \
    --project "$PROJECT_ID"

gcloud iam service-accounts describe "$WORKER_SERVICE_ACCOUNT" \
  --project "$PROJECT_ID" \
  || gcloud iam service-accounts create qaoa-rqp-worker-v8 \
    --display-name "QAOA RQP Worker v8" \
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
  --memory 2Gi \
  --cpu 2 \
  --env-vars-file /tmp/qaoa-v8-api-env.yaml
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

Create the worker job:

```bash
gcloud run jobs create "$WORKER_JOB_NAME" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$WORKER_SERVICE_ACCOUNT" \
  --command python \
  --args -m,app.job_worker \
  --tasks 1 \
  --max-retries 0 \
  --task-timeout 7200s \
  --memory 4Gi \
  --cpu 2 \
  --env-vars-file /tmp/qaoa-v8-worker-env.yaml
```

Update an existing worker job:

```bash
gcloud run jobs update "$WORKER_JOB_NAME" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$WORKER_SERVICE_ACCOUNT" \
  --command python \
  --args -m,app.job_worker \
  --tasks 1 \
  --max-retries 0 \
  --task-timeout 7200s \
  --memory 4Gi \
  --cpu 2 \
  --env-vars-file /tmp/qaoa-v8-worker-env.yaml
```

Set or confirm the worker timeout separately:

```bash
gcloud run jobs update "$WORKER_JOB_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --task-timeout 7200s
```

Grant the API service account permission to execute the worker job after the job exists. The `roles/run.developer` role includes the Cloud Run job execution permissions needed for execution overrides such as `JOB_ID`.

```bash
gcloud run jobs add-iam-policy-binding "$WORKER_JOB_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --member "serviceAccount:$API_SERVICE_ACCOUNT" \
  --role "roles/run.developer"
```

## Manual Worker Smoke Test

If a queued `job_id` already exists in `qaoa_jobs`, manually execute the worker:

```bash
JOB_ID="job_replace_me"

gcloud run jobs execute "$WORKER_JOB_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --update-env-vars "JOB_ID=$JOB_ID" \
  --task-timeout 7200s \
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

Version 8 reads/writes these collections by default:

- `qaoa_keys`
- `qaoa_usage_events`
- `qaoa_public_run_state`
- `qaoa_public_run_locks`
- `qaoa_jobs`

The job collection can be overridden with `QAOA_FIRESTORE_JOB_COLLECTION`, but the deployment commands above use the default `qaoa_jobs`.

## Progress And Logs

The worker stores status in `qaoa_jobs/{job_id}`:

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

- Authenticated jobs acquire the existing per-key lock at submission time.
- Public/no-key jobs acquire the public demo semaphore at submission time.
- If Cloud Run Job triggering fails, the API releases the acquired lock/slot.
- The worker releases the lock/slot in a `finally` path on completed, failed, and cancelled jobs.
- Successful authenticated completed jobs consume one run.
- Failed/cancelled/rejected jobs do not consume a run.

## Current Limits

- `qaoa_full` remains disabled.
- `qaoa_limited` runs inside the worker task, not inside the HTTP request.
- Cancellation is cooperative. Queued jobs can be cancelled immediately; fine-grained cancellation during optimizer iterations is future work.
