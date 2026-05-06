"""Configuration for the Version 9 Cloud Run API and async job worker."""

import os
import tempfile
from pathlib import Path


_matplotlib_cache = Path(tempfile.gettempdir()) / "qaoa-rqp-matplotlib"
_matplotlib_cache.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(_matplotlib_cache))


class Config:
    SERVICE_NAME = "qaoa-rqp-api-v9"
    VERSION = "9.0.0"
    MODEL_VERSION = "9.0.0"

    API_KEY_HEADER = "X-API-Key"
    VERSION_DIR = Path(__file__).resolve().parents[1]
    CONFIG_DIR = VERSION_DIR / "config"
    DATA_DIR = VERSION_DIR / "data"
    USAGE_LEVELS_PATH = CONFIG_DIR / "usage_levels.yaml"
    DEMO_KEYS_PATH = CONFIG_DIR / "demo_keys.yaml"
    FIRESTORE_KEY_COLLECTION = os.getenv("QAOA_FIRESTORE_KEY_COLLECTION", "qaoa_keys")
    FIRESTORE_USAGE_COLLECTION = os.getenv("QAOA_FIRESTORE_USAGE_COLLECTION", "qaoa_usage_events")
    FIRESTORE_PUBLIC_RUN_STATE_COLLECTION = os.getenv(
        "QAOA_FIRESTORE_PUBLIC_RUN_STATE_COLLECTION",
        "qaoa_public_run_state_v9",
    )
    FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION = os.getenv(
        "QAOA_FIRESTORE_PUBLIC_RUN_LOCK_COLLECTION",
        "qaoa_public_run_locks_v9",
    )
    FIRESTORE_KEY_RUN_STATE_COLLECTION = os.getenv(
        "QAOA_FIRESTORE_KEY_RUN_STATE_COLLECTION",
        "qaoa_key_run_state_v9",
    )
    FIRESTORE_KEY_RUN_LOCK_COLLECTION = os.getenv(
        "QAOA_FIRESTORE_KEY_RUN_LOCK_COLLECTION",
        "qaoa_key_run_locks_v9",
    )
    FIRESTORE_JOB_COLLECTION = os.getenv("QAOA_FIRESTORE_JOB_COLLECTION", "qaoa_jobs_v9")

    JOB_BUCKET = os.getenv("QAOA_JOB_BUCKET")
    LOCAL_JOB_DIR = Path(os.getenv("QAOA_LOCAL_JOB_DIR", str(DATA_DIR / "jobs")))
    CLOUD_RUN_PROJECT = os.getenv("CLOUD_RUN_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT")
    CLOUD_RUN_REGION = os.getenv("CLOUD_RUN_REGION")
    QAOA_WORKER_JOB_NAME = os.getenv("QAOA_WORKER_JOB_NAME")
    RUN_JOBS_INLINE_FOR_LOCAL = os.getenv("RUN_JOBS_INLINE_FOR_LOCAL") == "1"

    @staticmethod
    def job_bucket() -> str | None:
        return os.getenv("QAOA_JOB_BUCKET") or Config.JOB_BUCKET

    MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_MB * 1024 * 1024
    ALLOWED_UPLOAD_SUFFIXES = {".xlsx"}

    @staticmethod
    def key_store_mode() -> str:
        configured = os.getenv("QAOA_KEY_STORE") or os.getenv("QAOA_RQP_KEY_STORE")
        if configured:
            value = configured.strip().lower()
            if value in {"yaml", "local"}:
                return "local"
            if value == "auto":
                return "local" if os.getenv("QAOA_RQP_LOCAL_DEV") == "1" else "firestore"
            return value
        return "local" if os.getenv("QAOA_RQP_LOCAL_DEV") == "1" else "firestore"

    @staticmethod
    def ledger_store_mode() -> str:
        configured = os.getenv("QAOA_LEDGER_STORE") or os.getenv("QAOA_RQP_LEDGER_STORE")
        if configured:
            return configured.strip().lower()
        if os.getenv("QAOA_RQP_ENABLE_LOCAL_LEDGER") == "1":
            return "local"
        return "disabled" if os.getenv("QAOA_RQP_LOCAL_DEV") == "1" else "firestore"

    @staticmethod
    def job_store_mode() -> str:
        configured = os.getenv("QAOA_JOB_STORE")
        if configured:
            value = configured.strip().lower()
            if value in {"yaml", "local"}:
                return "local"
            if value == "auto":
                return "local" if os.getenv("QAOA_RQP_LOCAL_DEV") == "1" else "firestore"
            return value
        return "local" if os.getenv("QAOA_RQP_LOCAL_DEV") == "1" else "firestore"

    @staticmethod
    def job_storage_mode() -> str:
        configured = os.getenv("QAOA_JOB_STORAGE")
        if configured:
            value = configured.strip().lower()
            if value in {"gcs", "cloud_storage"}:
                return "gcs"
            if value == "auto":
                if Config.job_bucket():
                    return "gcs"
                return "local" if os.getenv("QAOA_RQP_LOCAL_DEV") == "1" else "gcs"
            return value
        if Config.job_bucket():
            return "gcs"
        return "local" if os.getenv("QAOA_RQP_LOCAL_DEV") == "1" else "gcs"

    REQUIRED_CLASSICAL_INPUT_SHEETS = ("Settings", "Assets", "AnnualizedCovariance")
    LIKELY_INPUT_SHEETS = (
        "ReadMe",
        "Settings",
        "Assets",
        "Returns",
        "Covariance",
        "AnnualizedCovariance",
        "PriceHistory",
        "Sources",
    )
    IGNORED_OUTPUT_SHEETS = frozenset(
        {
            "Classical_Candidates",
            "Optimization_History",
            "QAOA_Best_QUBO",
            "QAOA_Samples",
            "Results_Overview",
            "Results_Portfolios",
            "Results_Summary",
            "Solver_Comparison",
        }
    )
