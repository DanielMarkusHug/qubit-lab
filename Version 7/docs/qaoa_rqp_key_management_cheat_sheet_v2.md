# QAOA RQP Key Management Cheat Sheet v2

Updated for Version 7.0.16.

This sheet covers Firestore key management, usage logs, authenticated run locks,
and the anonymous public-demo concurrency gate.

## 1. Admin Environment

Run admin commands from the repository root:

```bash
cd "/Users/danielhug/code/qubit-lab/QAOA-Optimizer"
```

For Firestore admin actions, use the same secret that the Cloud Run service uses:

```bash
export KEY_HASH_SECRET="replace-with-production-secret"
export QAOA_FIRESTORE_PROJECT_ID="your-gcp-project-id"   # optional if ADC already knows it
```

Default Firestore collections:

```text
qaoa_keys
qaoa_usage_events
qaoa_public_run_state
qaoa_public_run_locks
```

Production Cloud Run should use:

```bash
QAOA_RQP_LOCAL_DEV=0
QAOA_KEY_STORE=firestore
QAOA_LEDGER_STORE=firestore
KEY_HASH_SECRET=...
```

Do not use `QAOA_RQP_LOCAL_DEV=1` for external demos.

## 2. Create A Firestore API Key

Create a key record. The raw API key is generated and printed exactly once.
Only the HMAC-SHA256 hash is stored in Firestore.

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" create \
  --key-id customer-demo-001 \
  --name "Customer Name" \
  --email "customer@example.com" \
  --organization "Customer Org" \
  --usage-level tester \
  --max-runs 100 \
  --expires-at "2026-12-31T23:59:59Z" \
  --created-by "admin@example.com"
```

Optional:

```bash
  --display-name "Customer Demo" \
  --notes "Pilot access" \
  --prefix qlab \
  --max-parallel-runs 1 \
  --force
```

`--max-parallel-runs` defaults to `1`. Existing keys without this field are
treated as one active run maximum and idle status.

## 3. Inspect And Manage Keys

List keys:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" list --limit 100
```

Show one key without showing its hash:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" show \
  --key-id customer-demo-001
```

Show one key with the stored hash only when explicitly needed:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" show \
  --key-id customer-demo-001 \
  --show-hash
```

Inspect a raw API key without printing it back:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" inspect \
  --api-key "PASTE-RAW-KEY-HERE"
```

Revoke or reactivate a key:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" revoke \
  --key-id customer-demo-001

.venv/bin/python "Version 7/scripts/key_admin_firestore.py" activate \
  --key-id customer-demo-001
```

## 4. Authenticated Per-Key Run Locks

Authenticated `/run-qaoa` requests use a per-key run lock. Different keys can
run in parallel. A second simultaneous run for the same key is rejected with:

```text
active_run_exists
```

Firestore key lock fields:

```text
max_parallel_runs
active_run_id
active_run_started_at
active_run_status
active_run_user_agent
active_run_ip
```

Missing fields are safe:

```text
max_parallel_runs -> 1
active_run_id -> none
active_run_started_at -> none
active_run_status -> idle
```

Manual recovery command for a stuck key lock:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" clear-lock \
  --key-id customer-demo-001 \
  --confirm
```

Without `--confirm`, the command prints a warning and does not modify Firestore.

## 5. Public Demo Access Without A Key

Anonymous users still do not need an API key. They map to `public_demo`.

`public_demo` is intentionally small:

```text
max_qubits: 8
qaoa_limited max_layers: 1
qaoa_limited max_iterations: 10
qaoa_limited max_restarts: 1
max_estimated_runtime_sec: 60
max_parallel_runs: 5
```

Only anonymous/public_demo `/run-qaoa` executions acquire a public slot.

These endpoints do not acquire public slots:

```text
/license-status
/inspect-workbook
/capabilities
```

Authenticated keys do not use the public semaphore. They use the per-key lock.

## 6. Public Demo Concurrency Gate

Firestore state document:

```text
qaoa_public_run_state/global
```

It stores:

```text
active_count
max_parallel_runs
updated_at
```

Active public locks:

```text
qaoa_public_run_locks/{run_id}
```

Each lock stores safe run metadata:

```text
run_id
usage_level = public_demo
status = running
started_at
stale_after_sec
mode
response_level
filename
estimated_runtime_sec
n_qubits
client_ip_hash
user_agent_hash
```

Raw IP addresses and raw user agents are not stored.

If all 5 public slots are busy, `/run-qaoa` rejects immediately with HTTP 429:

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

This rejection does not start optimization and does not consume usage.

## 7. Usage Logs And Public Run Views

List recent events for one authenticated key:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" usage \
  --key-id customer-demo-001 \
  --limit 20
```

List recent usage events across all keys, including public demo:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" runs \
  --days 30 \
  --limit 50
```

List public-demo events from the last month:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" runs \
  --days 30 \
  --usage-level public_demo \
  --limit 100
```

List capacity rejections, if any:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" runs \
  --days 30 \
  --usage-level public_demo \
  --status rejected \
  --limit 100
```

Summarize recent usage:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" usage-summary \
  --days 30
```

The summary includes:

```text
total_runs
completed_runs
rejected_runs
failed_runs
consumed_runs
public_demo totals
authenticated totals
by_usage_level
by_key_id
by_error_code
```

Show current public-demo semaphore state and active public locks:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" public-status \
  --limit 20
```

## 8. Usage Event Fields

`qaoa_usage_events` stores safe metadata, for example:

```text
run_id
key_id
usage_level
timestamp
status
mode
response_level
filename
binary_variables / n_qubits
layers
iterations
restarts
warm_start
qaoa_shots
estimated_runtime_sec
actual_runtime_sec
runtime_ratio
error_code
error_message
service_version
consumed_run
```

Public/no-key runs use:

```text
usage_level = public_demo
key_id = anonymous
```

Useful filters:

```text
Public runs: usage_level == public_demo
Capacity rejections: error_code == public_demo_capacity_exceeded
Per-key usage: key_id == customer-demo-001
```

## 9. Run Consumption Rules

Consumes one run:

```text
Successful completed authenticated optimization
```

Does not consume a run:

```text
Invalid key
Expired, revoked, suspended key
Run limit exceeded
Policy rejection
Qubit/runtime limit rejection
Response level rejection
qaoa_full disabled
active_run_exists
public_demo_capacity_exceeded
Invalid workbook before execution
Internal failure after execution starts
```

Public/no-key usage is tracked in usage events and controlled by concurrency,
not by a per-user run counter.

## 10. Security Notes

Never store or log raw API keys.

Firestore `qaoa_keys` stores only:

```text
key_id
key_hash
usage_level
status
identity metadata
max_runs / used_runs / remaining_runs
run-lock fields
optional limits
```

The raw API key is printed exactly once by the create command. After that, it
cannot be recovered from Firestore.

Use the same `KEY_HASH_SECRET` for:

```text
Cloud Run API validation
key_admin_firestore.py create
key_admin_firestore.py inspect
```

Changing `KEY_HASH_SECRET` invalidates existing hashes unless keys are recreated.

## 11. Common Checks

Check that public capacity appears in capabilities:

```bash
curl "$SERVICE_URL/capabilities" | python3 -m json.tool
```

Check current public status:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" public-status
```

Check last 30 days of public runs:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" runs \
  --days 30 \
  --usage-level public_demo
```

Check aggregate usage:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" usage-summary \
  --days 30
```

Clear a stuck authenticated key lock only after confirming no run is really
still active:

```bash
.venv/bin/python "Version 7/scripts/key_admin_firestore.py" clear-lock \
  --key-id customer-demo-001 \
  --confirm
```
