"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_VQC_API_BASE?.trim() ||
  process.env.NEXT_PUBLIC_QAOA_RQP_API_URL?.trim() ||
  "http://localhost:8000";

const ENDPOINTS = {
  health: "/health",
  licenseStatus: "/license-status",
  datasetUploadTarget: "/datasets/upload-target",
  inspectWorkbook: "/inspect-workbook",
  prepareData: "/prepare-data",
  planRun: "/plan-run",
  executeRun: "/execute-run",
  jobs: "/jobs",
} as const;

type PipelineStepKey = "inspect" | "prepare" | "plan" | "baselines" | "vqc" | "report";
type PipelineStepStatus = "pending" | "running" | "done" | "error" | "cancelled";
type JobStatusValue = "idle" | "queued" | "running" | "completed" | "failed" | "cancelled";
type DatasetLoadState = "idle" | "loading" | "loaded" | "error";
type LogLevel = "info" | "success" | "warning" | "error";
type ArtifactPathMap = Record<string, string>;
type JsonRecord = Record<string, unknown>;
type TableCellValue = string | number | boolean | null | undefined;
type MetricTableRow = Record<string, TableCellValue>;
type OptimizerOption = "adam" | "cobyla" | "spsa";
type FeatureMapOption = "angle" | "zz_like" | "iqp" | "amplitude" | "basis";
type AnsatzOption = "hardware_efficient" | "custom_rx_ry_cz" | "strongly_entangling" | "real_amplitudes_like" | "basic_entangler";
type WorkerProfileOption = "small" | "medium" | "large";
type SimulatorBackendOption = "pennylane_default_qubit" | "pennylane_lightning";

interface ClientLogEntry {
  id: string;
  timestamp: string;
  source: "client" | "backend";
  level: LogLevel;
  stage?: string | null;
  message: string;
}

interface HealthResponse {
  status: string;
  app?: string;
  version?: string;
}

interface LicenseStatusResponse {
  status: string;
  usage_level: string;
  display_name: string;
  authenticated?: boolean;
  usage_level_id?: number;
  valid_for?: string[];
  key_id?: string | null;
  name?: string | null;
  organization?: string | null;
  expires_at?: string | null;
  remaining_runs?: string | number | null;
  allowed_modes?: string[];
  allowed_worker_profiles?: string[];
  features?: string[];
  vqc_limits?: JsonRecord;
}

interface ParameterOverridesState {
  featureMapType: FeatureMapOption;
  featureMapRepeats: number;
  ansatzType: AnsatzOption;
  ansatzReps: number;
  nQubits: number;
  backend: SimulatorBackendOption;
  workerProfile: WorkerProfileOption;
  iterations: number;
  learningRate: number;
  repeats: number;
  batchSize: number;
  optimizer: OptimizerOption;
  earlyStopping: boolean;
  patience: number;
  balanceTrainingOnly: boolean;
}

interface SavedVqcReviewSnapshot {
  schema: "vqc-rqp-review-snapshot";
  schema_version: 1;
  saved_at: string;
  api_base: string;
  original_workbook_filename: string | null;
  dataset_reference_uri: string | null;
  dataset_path_input: string | null;
  job_id: string | null;
  parameter_overrides: ParameterOverridesState;
  step_status: Record<PipelineStepKey, PipelineStepStatus>;
  license: LicenseStatusResponse | null;
  health_response: HealthResponse | null;
  inspect_response: InspectWorkbookResponse | null;
  prepare_response: PrepareDataResponse | null;
  plan_response: PlanRunResponse | null;
  baselines_response: RunBaselinesResponse | null;
  vqc_response: RunVqcResponse | null;
  report_response: GenerateReportResponse | null;
  execute_response: ExecuteRunResponse | null;
  job_status: JobStatusResponse | null;
  job_log_response: JobLogResponse | null;
  client_log_entries: ClientLogEntry[];
}

interface BaseApiResponse {
  status?: string;
  warnings?: string[];
  errors?: string[];
  artifact_paths?: ArtifactPathMap;
  effective_settings?: JsonRecord;
  config_source?: string;
  workbook_metadata?: JsonRecord;
  [key: string]: unknown;
}

interface InspectWorkbookResponse extends BaseApiResponse {
  filename?: string;
  parsed_settings?: JsonRecord;
  inferred_classification_mode?: string;
  feature_map_type?: string;
  ansatz_type?: string;
  mandatory_baseline_status?: JsonRecord;
}

interface PrepareDataResponse extends BaseApiResponse {
  job_id?: string;
  dataset_file?: string;
  label_column?: string;
  task_type?: string;
  inferred_classification_mode?: string;
  number_of_rows_input?: number;
  number_of_features_input?: number;
  number_of_selected_features?: number;
  number_of_quantum_features?: number;
  train_rows?: number;
  validation_rows?: number;
  test_rows?: number;
  class_distribution?: JsonRecord;
  selected_features?: string[];
  quantum_feature_names?: string[];
  preprocessing_summary?: JsonRecord;
}

interface DatasetUploadTargetResponse extends BaseApiResponse {
  upload_url: string;
  gs_uri: string;
  object_name: string;
  content_type?: string | null;
  size_bytes?: number | null;
  upload_transport: string;
}

interface PlanRunResponse extends BaseApiResponse {
  job_id?: string;
  planning_report_path?: string;
  data_summary?: JsonRecord;
  model_summary?: JsonRecord;
  vqc_workload_estimate?: JsonRecord;
  baseline_workload_estimate?: JsonRecord;
  circuit_estimate?: JsonRecord;
  hardware_feasibility?: JsonRecord;
  runtime_estimate?: JsonRecord;
  memory_estimate?: JsonRecord;
  recommendations?: string[];
}

interface RunBaselinesResponse extends BaseApiResponse {
  job_id?: string;
  classification_mode?: string;
  number_of_classes?: number;
  baseline_metrics?: JsonRecord;
  benchmark_method_specs?: JsonRecord;
  model_comparison?: MetricTableRow[];
  runtime_summary?: JsonRecord;
}

interface RunVqcResponse extends BaseApiResponse {
  job_id?: string;
  classification_mode?: string;
  number_of_classes?: number;
  vqc_metrics?: JsonRecord;
  validation_metrics?: JsonRecord;
  test_metrics?: JsonRecord;
  training_history?: Array<Record<string, unknown>>;
  training_history_summary?: JsonRecord;
  circuit_summary?: JsonRecord;
  baseline_comparison_preview?: JsonRecord;
}

interface GenerateReportResponse extends BaseApiResponse {
  job_id?: string;
  report_generated?: boolean;
  run_summary?: JsonRecord;
  model_comparison?: MetricTableRow[];
}

interface ExecuteRunResponse extends BaseApiResponse {
  job_id?: string;
  job_status?: JobStatusValue;
  current_stage?: string | null;
  progress?: number;
  stage_status?: Record<string, string>;
  result_summaries?: Record<string, JsonRecord>;
  message?: string;
  runtime_tracking?: JsonRecord;
}

interface JobStatusResponse extends BaseApiResponse {
  job_id?: string;
  job_status?: JobStatusValue;
  current_stage?: string | null;
  message?: string | null;
  progress?: number;
  stage_status?: Record<string, string>;
  result_summaries?: Record<string, JsonRecord>;
  cancel_requested?: boolean;
  created_at?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  runtime_tracking?: JsonRecord;
}

interface JobLogResponse extends BaseApiResponse {
  job_id?: string;
  job_status?: JobStatusValue;
  current_stage?: string | null;
  log_entries?: Array<{
    timestamp?: string;
    level?: string;
    stage?: string | null;
    message?: string;
    extra?: JsonRecord;
  }>;
}

interface JobListResponse extends BaseApiResponse {
  jobs?: Array<{
    job_id?: string;
    job_status?: JobStatusValue;
    current_stage?: string | null;
    message?: string | null;
    progress?: number;
    updated_at?: string | null;
    created_at?: string | null;
  }>;
}

const INITIAL_STEPS: Record<PipelineStepKey, PipelineStepStatus> = {
  inspect: "pending",
  prepare: "pending",
  plan: "pending",
  baselines: "pending",
  vqc: "pending",
  report: "pending",
};

function cloneInitialSteps(): Record<PipelineStepKey, PipelineStepStatus> {
  return { ...INITIAL_STEPS };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item ?? "")).filter(Boolean);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    return Math.abs(value) >= 1000 ? value.toLocaleString() : value.toFixed(Number.isInteger(value) ? 0 : 4);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => formatValue(item)).join(", ") : "-";
  }
  if (isRecord(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatPercent(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return formatValue(value);
  }
  return `${(value * 100).toFixed(0)}%`;
}

function formatIsoTimestamp(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return "-";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDurationSeconds(value: unknown): string {
  const seconds = asFiniteNumber(value);
  if (seconds === null || seconds < 0) {
    return formatValue(value);
  }
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  if (minutes < 60) {
    return `${minutes}m ${remainder}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function asTableCellValue(value: unknown): TableCellValue {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return formatValue(value);
}

function orderedKeys(record: JsonRecord, preferred: string[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  preferred.forEach((key) => {
    if (key in record) {
      keys.push(key);
      seen.add(key);
    }
  });

  Object.keys(record)
    .filter((key) => !seen.has(key))
    .forEach((key) => keys.push(key));

  return keys;
}

function metricEntries(metrics: JsonRecord): Array<{ key: string; value: unknown }> {
  const preferred = [
    "primary_metric_name",
    "primary_metric_validation",
    "primary_metric_test",
    "accuracy",
    "precision",
    "recall",
    "f1",
    "f1_weighted",
    "precision_macro",
    "recall_macro",
    "f1_macro",
    "roc_auc",
    "roc_auc_ovr",
    "pr_auc",
    "positive_class_ratio",
    "false_positives",
    "false_negatives",
    "true_positives",
    "true_negatives",
  ];
  const excluded = new Set(["confusion_matrix", "class_distribution", "per_class_precision", "per_class_recall", "per_class_f1", "warnings"]);

  return orderedKeys(metrics, preferred)
    .filter((key) => !excluded.has(key))
    .map((key) => ({ key, value: metrics[key] }));
}

function normalizeStageStatus(value: string | undefined): PipelineStepStatus {
  switch ((value ?? "").toLowerCase()) {
    case "done":
    case "completed":
      return "done";
    case "running":
    case "queued":
      return "running";
    case "failed":
    case "error":
      return "error";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

function buildStepStatusFromJob(status: JobStatusResponse | null): Record<PipelineStepKey, PipelineStepStatus> | null {
  const stageStatus = asRecord(status?.stage_status);
  if (!stageStatus) {
    return null;
  }
  return {
    inspect: normalizeStageStatus(typeof stageStatus.inspect === "string" ? stageStatus.inspect : undefined),
    prepare: normalizeStageStatus(typeof stageStatus.prepare === "string" ? stageStatus.prepare : undefined),
    plan: normalizeStageStatus(typeof stageStatus.plan === "string" ? stageStatus.plan : undefined),
    baselines: normalizeStageStatus(typeof stageStatus.baselines === "string" ? stageStatus.baselines : undefined),
    vqc: normalizeStageStatus(typeof stageStatus.vqc === "string" ? stageStatus.vqc : undefined),
    report: normalizeStageStatus(typeof stageStatus.report === "string" ? stageStatus.report : undefined),
  };
}

function mergeWarnings(existing: string[], incoming: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const warning of [...existing, ...incoming]) {
    const trimmed = warning.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(trimmed);
    }
  }
  return merged;
}

function extractWarnings(response: unknown): string[] {
  if (!isRecord(response)) {
    return [];
  }
  const directWarnings = toStringArray(response.warnings);
  const directErrors = toStringArray(response.errors);
  const runSummaryWarnings = isRecord(response.run_summary) ? toStringArray(response.run_summary.main_warnings) : [];
  return mergeWarnings(directWarnings, [...directErrors, ...runSummaryWarnings]);
}

function requestHeaders(apiKey: string) {
  return apiKey.trim() ? { "X-API-Key": apiKey.trim() } : undefined;
}

async function parseResponseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return response.json();
}

function extractErrorMessage(payload: unknown): string {
  if (isRecord(payload)) {
    if (isRecord(payload.error)) {
      const nestedMessage = payload.error.message;
      if (typeof nestedMessage === "string" && nestedMessage.trim()) {
        return nestedMessage;
      }
    }
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
    if (isRecord(payload.detail)) {
      const detailErrors = toStringArray(payload.detail.errors);
      const detailWarnings = toStringArray(payload.detail.warnings);
      if (detailErrors.length) {
        return detailErrors.join(" | ");
      }
      if (detailWarnings.length) {
        return detailWarnings.join(" | ");
      }
    }
    const errors = toStringArray(payload.errors);
    if (errors.length) {
      return errors.join(" | ");
    }
  }
  return "The request failed.";
}

async function getJson<T>(endpoint: string, apiKey = ""): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, { method: "GET", headers: requestHeaders(apiKey) });
  const payload = await parseResponseJson(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }
  return payload as T;
}

async function postMultipart<T>(endpoint: string, formData: FormData, apiKey = ""): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    body: formData,
    headers: requestHeaders(apiKey),
  });
  const payload = await parseResponseJson(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }
  return payload as T;
}

async function postJson<T>(endpoint: string, body: unknown, apiKey = ""): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      ...requestHeaders(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await parseResponseJson(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }
  return payload as T;
}

async function postEmpty<T>(endpoint: string, apiKey = ""): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: requestHeaders(apiKey),
  });
  const payload = await parseResponseJson(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }
  return payload as T;
}

function normalizeWorkerProfile(value: unknown): WorkerProfileOption {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "medium" || normalized === "standard") {
    return "medium";
  }
  if (normalized === "large" || normalized === "power") {
    return "large";
  }
  return "small";
}

function normalizeSimulatorBackend(value: unknown): SimulatorBackendOption {
  return String(value ?? "").trim().toLowerCase() === "pennylane_lightning"
    ? "pennylane_lightning"
    : "pennylane_default_qubit";
}

function defaultParameterOverrides(): ParameterOverridesState {
  return {
    featureMapType: "angle",
    featureMapRepeats: 1,
    ansatzType: "hardware_efficient",
    ansatzReps: 1,
    nQubits: 4,
    backend: "pennylane_default_qubit",
    workerProfile: "small",
    iterations: 50,
    learningRate: 0.01,
    repeats: 1,
    batchSize: 32,
    optimizer: "adam",
    earlyStopping: true,
    patience: 8,
    balanceTrainingOnly: false,
  };
}

function hydrateOverridesFromSettings(settings: JsonRecord | null): ParameterOverridesState {
  const model = asRecord(settings?.model);
  const training = asRecord(settings?.training);
  const defaults = defaultParameterOverrides();
  return {
    featureMapType: (typeof model?.feature_map_type === "string" ? model.feature_map_type : defaults.featureMapType) as FeatureMapOption,
    featureMapRepeats: Number(model?.feature_map_repeats ?? defaults.featureMapRepeats),
    ansatzType: (typeof model?.ansatz_type === "string" ? model.ansatz_type : defaults.ansatzType) as AnsatzOption,
    ansatzReps: Number(model?.ansatz_reps ?? defaults.ansatzReps),
    nQubits: Number(model?.n_qubits ?? defaults.nQubits),
    backend: normalizeSimulatorBackend(model?.backend),
    workerProfile: normalizeWorkerProfile(asRecord(settings?.execution)?.worker_profile),
    iterations: Number(training?.iterations ?? defaults.iterations),
    learningRate: Number(training?.learning_rate ?? defaults.learningRate),
    repeats: Number(training?.repeats ?? defaults.repeats),
    batchSize: Number(training?.batch_size ?? defaults.batchSize),
    optimizer: (typeof training?.optimizer === "string" ? training.optimizer : defaults.optimizer) as OptimizerOption,
    earlyStopping: Boolean(training?.early_stopping ?? defaults.earlyStopping),
    patience: Number(training?.patience ?? defaults.patience),
    balanceTrainingOnly: Boolean(training?.balance_training_only ?? defaults.balanceTrainingOnly),
  };
}

function buildConfigOverridesPayload(overrides: ParameterOverridesState): JsonRecord {
  return {
    model: {
      feature_map_type: overrides.featureMapType,
      feature_map_repeats: overrides.featureMapRepeats,
      ansatz_type: overrides.ansatzType,
      ansatz_reps: overrides.ansatzReps,
      n_qubits: overrides.nQubits,
      n_quantum_features: overrides.nQubits,
      backend: overrides.backend,
    },
    training: {
      optimizer: overrides.optimizer,
      iterations: overrides.iterations,
      learning_rate: overrides.learningRate,
      repeats: overrides.repeats,
      batch_size: overrides.batchSize,
      early_stopping: overrides.earlyStopping,
      patience: overrides.patience,
      balance_training_only: overrides.balanceTrainingOnly,
    },
    execution: {
      worker_profile: overrides.workerProfile,
    },
  };
}

function summarizeMandatoryBaselines(status: unknown): string {
  const record = asRecord(status);
  if (!record) {
    return "-";
  }
  const forced = asStringArray(record.forced);
  if (forced.length) {
    return `Required baselines enforced (${forced.map(formatLabel).join(", ")})`;
  }
  return "All mandatory baselines enabled";
}

function Card({
  title,
  subtitle,
  accent = false,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={[
        "rounded-2xl border p-5 shadow-sm",
        accent ? "border-cyan-900/70 bg-slate-950/80" : "border-slate-800 bg-slate-900/70",
        className,
      ].join(" ")}
    >
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">{title}</p>
        {subtitle ? <p className="mt-2 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function benchmarkModeLabel(mode: unknown): string {
  return String(mode ?? "").trim().toLowerCase() === "best_reference" ? "Best Reference" : "Strict Parity";
}

function sanitizeDownloadStem(value: string): string {
  return value
    .trim()
    .replace(/\.[A-Za-z0-9]+$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "vqc_run";
}

function timestampForFilename(isoValue: string): string {
  return isoValue.replace(/[:]/g, "-").replace(/\.\d+Z$/, "Z");
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getFilenameFromContentDisposition(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const basicMatch = headerValue.match(/filename="?([^"]+)"?/i);
  return basicMatch?.[1] ?? null;
}

function benchmarkModeDescription(mode: unknown): string {
  return String(mode ?? "").trim().toLowerCase() === "best_reference"
    ? "Stronger practical classical reference using the selected pre-quantum feature matrix and a larger row budget."
    : "Matched fairness mode using the same reduced feature matrix and VQC-style row budget.";
}

function sortBenchmarkMethodEntries(entries: Array<[string, JsonRecord]>): Array<[string, JsonRecord]> {
  const modeOrder = { parity: 0, best_reference: 1 } as const;
  const modelOrder = { logistic_regression: 0, random_forest: 1, gradient_boosting: 2 } as const;
  return [...entries].sort((a, b) => {
    const aRecord = a[1];
    const bRecord = b[1];
    const aMode = typeof aRecord.mode === "string" ? aRecord.mode : "";
    const bMode = typeof bRecord.mode === "string" ? bRecord.mode : "";
    const aBase = typeof aRecord.base_model === "string" ? aRecord.base_model : "";
    const bBase = typeof bRecord.base_model === "string" ? bRecord.base_model : "";
    const aModeRank = aMode in modeOrder ? modeOrder[aMode as keyof typeof modeOrder] : 99;
    const bModeRank = bMode in modeOrder ? modeOrder[bMode as keyof typeof modeOrder] : 99;
    if (aModeRank !== bModeRank) {
      return aModeRank - bModeRank;
    }
    const aModelRank = aBase in modelOrder ? modelOrder[aBase as keyof typeof modelOrder] : 99;
    const bModelRank = bBase in modelOrder ? modelOrder[bBase as keyof typeof modelOrder] : 99;
    if (aModelRank !== bModelRank) {
      return aModelRank - bModelRank;
    }
    return a[0].localeCompare(b[0]);
  });
}

function extractBenchmarkHyperparameterItems(spec: JsonRecord): Array<{ label: string; value: unknown }> {
  const hyperparameters = asRecord(spec.hyperparameters);
  const baseModel = typeof spec.base_model === "string" ? spec.base_model : "";
  const nestedModel = asRecord(hyperparameters?.model);
  const source = nestedModel ?? hyperparameters;

  if (baseModel === "logistic_regression") {
    return [
      { label: "Scaler", value: hyperparameters?.scaler ?? spec.scaler_strategy },
      { label: "Max iterations", value: source?.max_iter },
      { label: "Solver", value: source?.solver },
      { label: "Class weight", value: source?.class_weight ?? spec.class_weight_mode },
      { label: "Random state", value: source?.random_state },
    ];
  }
  if (baseModel === "random_forest") {
    return [
      { label: "Estimators", value: source?.n_estimators },
      { label: "Max features", value: source?.max_features },
      { label: "Class weight", value: source?.class_weight ?? spec.class_weight_mode },
      { label: "Jobs", value: source?.n_jobs },
      { label: "Random state", value: source?.random_state },
    ];
  }
  if (baseModel === "gradient_boosting") {
    return [
      { label: "Estimators", value: source?.n_estimators },
      { label: "Learning rate", value: source?.learning_rate },
      { label: "Max depth", value: source?.max_depth },
      { label: "Subsample", value: source?.subsample },
      { label: "Random state", value: source?.random_state },
    ];
  }
  return [];
}

function buildComparisonRowFromMetrics(modelName: string, classificationMode: string, metrics: JsonRecord | null): MetricTableRow {
  if (classificationMode === "multiclass") {
    return {
      model: modelName,
      accuracy: asTableCellValue(metrics?.accuracy),
      precision_macro: asTableCellValue(metrics?.precision_macro),
      recall_macro: asTableCellValue(metrics?.recall_macro),
      f1_macro: asTableCellValue(metrics?.f1_macro),
      f1_weighted: asTableCellValue(metrics?.f1_weighted),
      roc_auc_ovr: asTableCellValue(metrics?.roc_auc_ovr),
    };
  }
  return {
    model: modelName,
    accuracy: asTableCellValue(metrics?.accuracy),
    precision: asTableCellValue(metrics?.precision),
    recall: asTableCellValue(metrics?.recall),
    f1: asTableCellValue(metrics?.f1),
    f1_weighted: asTableCellValue(metrics?.f1_weighted),
    roc_auc: asTableCellValue(metrics?.roc_auc),
    pr_auc: asTableCellValue(metrics?.pr_auc),
    false_positives: asTableCellValue(metrics?.false_positives),
    false_negatives: asTableCellValue(metrics?.false_negatives),
  };
}

function formatBackendLogLine(entry: {
  timestamp?: string;
  stage?: string | null;
  message?: string;
  extra?: JsonRecord;
}): string {
  const fragments = [
    `${formatIsoTimestamp(entry.timestamp)} ${entry.stage ? `[${entry.stage}] ` : ""}${entry.message ?? "Backend event"}`,
  ];
  const extra = asRecord(entry.extra);
  if (extra) {
    const annotations: string[] = [];
    if (asFiniteNumber(extra.current_stage_elapsed_seconds) !== null) {
      annotations.push(`step ${formatDurationSeconds(extra.current_stage_elapsed_seconds)}`);
    }
    if (asFiniteNumber(extra.cumulative_elapsed_seconds) !== null) {
      annotations.push(`total ${formatDurationSeconds(extra.cumulative_elapsed_seconds)}`);
    }
    if (asFiniteNumber(extra.estimated_remaining_seconds) !== null) {
      annotations.push(`ETA ${formatDurationSeconds(extra.estimated_remaining_seconds)}`);
    }
    if (
      asFiniteNumber(extra.current_repeat) !== null &&
      asFiniteNumber(extra.repeats_requested) !== null &&
      asFiniteNumber(extra.current_iteration) !== null &&
      asFiniteNumber(extra.iterations_requested) !== null
    ) {
      annotations.push(
        `repeat ${formatValue(extra.current_repeat)}/${formatValue(extra.repeats_requested)} · iter ${formatValue(extra.current_iteration)}/${formatValue(extra.iterations_requested)}`,
      );
    }
    if (asFiniteNumber(extra.train_loss) !== null) {
      annotations.push(`loss ${formatValue(extra.train_loss)}`);
    }
    if (typeof extra.validation_primary_metric_name === "string" && asFiniteNumber(extra.validation_primary_metric) !== null) {
      annotations.push(`${formatLabel(extra.validation_primary_metric_name)} ${formatValue(extra.validation_primary_metric)}`);
    }
    if (annotations.length) {
      fragments.push(`  ·  ${annotations.join("  ·  ")}`);
    }
  }
  return fragments.join("");
}

function InfoGrid({ items }: { items: Array<{ label: string; value: unknown }> }) {
  const visibleItems = items.filter(({ value }) => value !== undefined);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {visibleItems.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
          <div className="mt-2 break-words text-sm text-slate-100">{formatValue(item.value)}</div>
        </div>
      ))}
    </div>
  );
}

function DetailList({ items }: { items: Array<{ label: string; value: unknown }> }) {
  const visibleItems = items.filter(({ value }) => value !== null && value !== undefined && value !== "");
  if (!visibleItems.length) {
    return <p className="text-sm text-slate-500">No details available yet.</p>;
  }
  return (
    <div className="space-y-2">
      {visibleItems.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-4 text-sm">
          <span className="text-slate-400">{item.label}</span>
          <span className="max-w-[65%] text-right text-slate-100">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function TagList({ values }: { values: string[] }) {
  if (!values.length) {
    return <p className="text-sm text-slate-500">-</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span key={value} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-200">
          {value}
        </span>
      ))}
    </div>
  );
}

function GenericTable({ rows }: { rows: MetricTableRow[] }) {
  const columns = useMemo(() => {
    const ordered = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((key) => ordered.add(key)));
    return Array.from(ordered);
  }, [rows]);

  if (!rows.length || !columns.length) {
    return <p className="text-sm text-slate-500">No table rows available.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-950/70">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {formatLabel(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/40">
          {rows.map((row, index) => (
            <tr key={`row-${index}`}>
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 align-top text-slate-100">
                  {formatValue(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonBarChart({
  rows,
  preferredMetricKeys,
}: {
  rows: MetricTableRow[];
  preferredMetricKeys: string[];
}) {
  const metricKey = useMemo(
    () =>
      preferredMetricKeys.find((key) =>
        rows.some((row) => typeof row[key] === "number" && Number.isFinite(row[key] as number)),
      ) ?? null,
    [preferredMetricKeys, rows],
  );

  const chartRows = useMemo(() => {
    if (!metricKey) {
      return [];
    }
    return rows
      .map((row) => ({
        model: formatValue(row.model ?? row.model_name),
        value: typeof row[metricKey] === "number" ? (row[metricKey] as number) : null,
      }))
      .filter((row) => row.value !== null) as Array<{ model: string; value: number }>;
  }, [metricKey, rows]);

  if (!metricKey || !chartRows.length) {
    return <p className="text-sm text-slate-500">No comparison plot available yet.</p>;
  }

  const maxValue = Math.max(...chartRows.map((row) => row.value), 1);
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-200">Visual comparison · {formatLabel(metricKey)}</p>
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        {chartRows.map((row) => (
          <div key={row.model} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-200">{row.model}</span>
              <span className="text-slate-400">{formatValue(row.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-cyan-500" style={{ width: `${(row.value / maxValue) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrainingLossChart({ history }: { history: Array<Record<string, unknown>> }) {
  const points = history
    .map((entry, index) => {
      const batchLoss = asFiniteNumber(entry.train_loss);
      const stableEvalLoss = asFiniteNumber(entry.train_eval_loss);
      if (batchLoss === null && stableEvalLoss === null) {
        return null;
      }
      const repeat = asFiniteNumber(entry.repeat) ?? 1;
      const iteration = asFiniteNumber(entry.iteration) ?? index + 1;
      return {
        x: index + 1,
        label: `R${repeat} · I${iteration}`,
        batchLoss,
        stableEvalLoss,
      };
    })
    .filter(
      (point): point is { x: number; label: string; batchLoss: number | null; stableEvalLoss: number | null } => point !== null,
    );

  if (points.length < 2) {
    return <p className="text-sm text-slate-500">Training loss plot appears after at least two optimization trace points.</p>;
  }

  const width = 920;
  const height = 280;
  const padLeft = 56;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 34;
  const lossValues = points.flatMap((point) =>
    [point.batchLoss, point.stableEvalLoss].filter((value): value is number => value !== null),
  );
  const minLoss = Math.min(...lossValues);
  const maxLoss = Math.max(...lossValues);
  const lossRange = Math.max(maxLoss - minLoss, 1e-6);
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const xFor = (value: number) => padLeft + ((value - 1) / Math.max(points.length - 1, 1)) * chartWidth;
  const yFor = (loss: number) => padTop + chartHeight - ((loss - minLoss) / lossRange) * chartHeight;
  const batchPath = points
    .filter((point) => point.batchLoss !== null)
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xFor(point.x).toFixed(1)} ${yFor(point.batchLoss as number).toFixed(1)}`,
    )
    .join(" ");
  const stablePath = points
    .filter((point) => point.stableEvalLoss !== null)
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xFor(point.x).toFixed(1)} ${yFor(point.stableEvalLoss as number).toFixed(1)}`,
    )
    .join(" ");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <p className="font-medium text-slate-200">Cost function during training</p>
        <span className="inline-flex items-center gap-2 text-slate-400">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400" />
          Batch loss
        </span>
        <span className="inline-flex items-center gap-2 text-slate-400">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-300" />
          Fixed train-slice loss
        </span>
      </div>
      <p className="text-xs text-slate-500">
        Batch loss is intentionally noisy. The amber line evaluates a fixed slice of the training split, so it is the steadier one to watch for convergence.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px]">
          <line x1={padLeft} y1={padTop} x2={padLeft} y2={height - padBottom} stroke="rgba(148,163,184,0.35)" />
          <line x1={padLeft} y1={height - padBottom} x2={width - padRight} y2={height - padBottom} stroke="rgba(148,163,184,0.35)" />
          {batchPath ? <path d={batchPath} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {stablePath ? <path d={stablePath} fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {points
            .filter((point) => point.batchLoss !== null)
            .map((point) => (
              <circle key={`${point.label}-batch`} cx={xFor(point.x)} cy={yFor(point.batchLoss as number)} r="2.5" fill="#22d3ee" />
            ))}
          {points
            .filter((point) => point.stableEvalLoss !== null)
            .map((point) => (
              <circle
                key={`${point.label}-stable`}
                cx={xFor(point.x)}
                cy={yFor(point.stableEvalLoss as number)}
                r="3.5"
                fill="#facc15"
              />
            ))}
          <text x={padLeft - 10} y={padTop + 6} fill="#94a3b8" fontSize="11" textAnchor="end">
            {formatValue(maxLoss)}
          </text>
          <text x={padLeft - 10} y={height - padBottom + 4} fill="#94a3b8" fontSize="11" textAnchor="end">
            {formatValue(minLoss)}
          </text>
          <text x={width / 2} y={height - 8} fill="#94a3b8" fontSize="11" textAnchor="middle">
            Optimization history points
          </text>
        </svg>
      </div>
    </div>
  );
}

function ClassDistributionBars({ distribution }: { distribution: JsonRecord | null }) {
  if (!distribution) {
    return <p className="text-sm text-slate-500">No class distribution plot available yet.</p>;
  }

  const rows = Object.entries(distribution)
    .map(([split, rawValue]) => {
      const splitRecord = asRecord(rawValue);
      if (!splitRecord) {
        return null;
      }
      const entries = Object.entries(splitRecord).map(([label, value]) => ({
        label,
        value: typeof value === "number" ? value : Number(value),
      }));
      const total = entries.reduce((sum, entry) => sum + (Number.isFinite(entry.value) ? entry.value : 0), 0);
      return { split: formatLabel(split), entries, total };
    })
    .filter((row): row is { split: string; entries: Array<{ label: string; value: number }>; total: number } => Boolean(row));

  if (!rows.length) {
    return <p className="text-sm text-slate-500">No class distribution plot available yet.</p>;
  }

  const colors = ["bg-cyan-500", "bg-emerald-500", "bg-amber-400", "bg-fuchsia-500", "bg-sky-400"];

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      {rows.map((row) => (
        <div key={row.split} className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-200">{row.split}</span>
            <span className="text-slate-400">{row.total} rows</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-800">
            {row.entries.map((entry, index) => (
              <div
                key={`${row.split}-${entry.label}`}
                className={colors[index % colors.length]}
                style={{ width: `${row.total > 0 ? (entry.value / row.total) * 100 : 0}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {row.entries.map((entry, index) => (
              <span key={`${row.split}-${entry.label}-tag`} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${colors[index % colors.length]}`} />
                Class {entry.label}: {formatValue(entry.value)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricSummaryTable({ title, metrics }: { title: string; metrics: JsonRecord | null }) {
  if (!metrics) {
    return null;
  }
  const rows = metricEntries(metrics).map(({ key, value }) => ({
    metric: formatLabel(key),
    value: asTableCellValue(value),
  }));
  if (!rows.length) {
    return null;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <GenericTable rows={rows} />
    </div>
  );
}

function ConfusionMatrixHeatmap({ title, matrix }: { title: string; matrix: unknown }) {
  if (!Array.isArray(matrix) || !matrix.length || !matrix.every((row) => Array.isArray(row))) {
    return null;
  }
  const numericMatrix = matrix.map((row) =>
    (row as unknown[]).map((value) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value))),
  );
  const maxValue = Math.max(
    1,
    ...numericMatrix.flat().filter((value) => Number.isFinite(value)),
  );

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${numericMatrix[0]?.length ?? 0}, minmax(54px, 1fr))` }}
        >
          {numericMatrix.flatMap((row, rowIndex) =>
            row.map((cell, columnIndex) => {
              const intensity = Math.max(0, Math.min(1, cell / maxValue));
              const background = `rgba(34, 211, 238, ${0.12 + intensity * 0.55})`;
              return (
                <div
                  key={`${title}-${rowIndex}-${columnIndex}`}
                  className="rounded-lg border border-slate-800 px-2 py-3 text-center"
                  style={{ background }}
                >
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    A{rowIndex} / P{columnIndex}
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-100">{formatValue(cell)}</div>
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

function ClassDistributionTable({ distribution }: { distribution: JsonRecord | null }) {
  if (!distribution) {
    return <p className="text-sm text-slate-500">No class distribution available yet.</p>;
  }

  const rows: MetricTableRow[] = [];
  Object.entries(distribution).forEach(([split, rawValue]) => {
    const splitRecord = asRecord(rawValue);
    if (!splitRecord) {
      rows.push({ split: formatLabel(split), class: "-", count: asTableCellValue(rawValue) });
      return;
    }
    Object.entries(splitRecord).forEach(([label, count]) => {
      rows.push({ split: formatLabel(split), class: label, count: asTableCellValue(count) });
    });
  });

  return <GenericTable rows={rows} />;
}

function deriveEffectiveTrainingDistribution(
  distribution: JsonRecord | null,
  options: {
    balanceTrainingOnly: boolean;
  },
): JsonRecord | null {
  const { balanceTrainingOnly } = options;
  const trainDistribution = asRecord(distribution?.train);
  if (!trainDistribution) {
    return null;
  }

  const numericEntries = Object.entries(trainDistribution)
    .map(([label, value]) => ({
      label,
      value: typeof value === "number" ? value : Number(value),
    }))
    .filter((entry) => Number.isFinite(entry.value));

  if (!numericEntries.length) {
    return null;
  }

  if (!balanceTrainingOnly) {
    return {
      effective_train: Object.fromEntries(
        numericEntries.map((entry) => [entry.label, entry.value]),
      ),
    };
  }

  const targetCount = Math.min(...numericEntries.map((entry) => entry.value));
  return {
    effective_train: Object.fromEntries(
      numericEntries.map((entry) => [entry.label, targetCount]),
    ),
  };
}

function PreprocessingSummaryPanel({ summary }: { summary: JsonRecord | null }) {
  if (!summary) {
    return <p className="text-sm text-slate-500">No preprocessing summary available yet.</p>;
  }

  const featureResolution = asRecord(summary.feature_resolution);
  const sampling = asRecord(summary.sampling);
  const split = asRecord(summary.split);
  const balancing = asRecord(summary.balancing);
  const encoding = asRecord(summary.encoding);
  const featureSelection = asRecord(summary.feature_selection);
  const quantumReduction = asRecord(summary.quantum_feature_reduction);

  return (
    <div className="space-y-4">
      <InfoGrid
        items={[
          { label: "Dataset", value: summary.dataset_name },
          {
            label: "Input shape",
            value: Array.isArray(summary.input_shape) ? summary.input_shape.join(" x ") : summary.input_shape,
          },
          {
            label: "Sampled shape",
            value: Array.isArray(summary.sampled_shape) ? summary.sampled_shape.join(" x ") : summary.sampled_shape,
          },
          { label: "Classification mode", value: summary.classification_mode },
          { label: "Label classes", value: summary.label_classes },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Feature Resolution">
          <DetailList
            items={[
              { label: "Requested features", value: featureResolution?.requested_input_features },
              { label: "Used features", value: featureResolution?.feature_columns },
              { label: "Missing requested features", value: featureResolution?.missing_requested_features },
              { label: "Excluded by role", value: featureResolution?.excluded_by_role },
              { label: "Used inference fallback", value: featureResolution?.used_inference },
            ]}
          />
        </Card>

        <Card title="Split + Sampling">
          <DetailList
            items={[
              { label: "Sampling applied", value: sampling?.applied },
              { label: "Sampling strategy", value: sampling?.strategy_requested },
              { label: "Rows before", value: sampling?.rows_before },
              { label: "Rows after", value: sampling?.rows_after },
              { label: "Split strategy", value: split?.strategy_effective ?? split?.strategy_requested },
              { label: "Train / Val / Test", value: `${formatPercent(split?.train_size)} / ${formatPercent(split?.validation_size)} / ${formatPercent(split?.test_size)}` },
              { label: "Time column", value: split?.time_column_used },
              { label: "Fallback reason", value: split?.fallback_reason },
            ]}
          />
        </Card>

        <Card title="Encoding + Balancing">
          <DetailList
            items={[
              { label: "Numeric columns", value: encoding?.numeric_columns },
              { label: "Categorical columns", value: encoding?.categorical_columns },
              { label: "Missing numeric", value: encoding?.missing_numeric },
              { label: "Missing categorical", value: encoding?.missing_categorical },
              { label: "Categorical encoding", value: encoding?.categorical_encoding },
              { label: "Numeric scaling", value: encoding?.numeric_scaling },
              { label: "Balancing applied", value: balancing?.applied },
              { label: "Balancing strategy", value: balancing?.strategy },
            ]}
          />
        </Card>

        <Card title="Feature Reduction">
          <DetailList
            items={[
              { label: "Selection method", value: featureSelection?.method },
              { label: "Score", value: featureSelection?.score_name },
              { label: "Max selected features", value: featureSelection?.max_selected_features },
              { label: "Input feature count", value: featureSelection?.input_feature_count },
              { label: "Selected feature count", value: featureSelection?.selected_feature_count },
              { label: "Selected features", value: featureSelection?.selected_feature_names },
              { label: "Quantum reduction method", value: quantumReduction?.method },
              { label: "Target quantum dimension", value: quantumReduction?.target_dim },
              { label: "Quantum features", value: quantumReduction?.selected_feature_names },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function MandatoryBaselineStatusPanel({ status }: { status: JsonRecord | null }) {
  if (!status) {
    return <p className="text-sm text-slate-500">Workbook baseline status has not been parsed yet.</p>;
  }
  const rows: MetricTableRow[] = [
    { status: "Enabled", models: asStringArray(status.enabled).join(", ") || "-" },
    { status: "Disabled", models: asStringArray(status.disabled).join(", ") || "-" },
    { status: "Forced", models: asStringArray(status.forced).join(", ") || "-" },
  ];
  return <GenericTable rows={rows} />;
}

function TrainingHistorySummaryPanel({ summary }: { summary: JsonRecord | null }) {
  if (!summary) {
    return <p className="text-sm text-slate-500">Training history becomes available after a VQC run.</p>;
  }
  return (
    <DetailList
      items={[
        { label: "Iterations requested", value: summary.iterations_requested },
        { label: "Repeats requested", value: summary.repeats_requested },
        { label: "Optimization trace points", value: summary.history_points },
        { label: "Best validation metric", value: summary.best_validation_primary_metric },
        { label: "Best validation metric name", value: summary.validation_primary_metric_name },
        { label: "Early-stopped repeats", value: summary.early_stopped_repeats },
        { label: "Average stop iteration", value: summary.average_stop_iteration },
        { label: "Max stop iteration", value: summary.max_stop_iteration },
      ]}
    />
  );
}

function BaselineComparisonPreviewPanel({ preview }: { preview: JsonRecord | null }) {
  const rows = Array.isArray(preview?.rows) ? (preview?.rows as MetricTableRow[]) : [];
  if (!rows.length) {
    return <p className="text-sm text-slate-500">Comparison preview appears after both baselines and VQC complete.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-200">
        Primary metric: {formatValue(preview?.primary_metric_name)}
      </p>
      <GenericTable rows={rows} />
    </div>
  );
}

function BenchmarkMethodCatalogPanel({ specs }: { specs: JsonRecord | null }) {
  if (!specs) {
    return <p className="text-sm text-slate-500">Benchmark method details appear after the classical stage finishes.</p>;
  }

  const entries = sortBenchmarkMethodEntries(
    Object.entries(specs).filter((entry): entry is [string, JsonRecord] => isRecord(entry[1])),
  );

  if (!entries.length) {
    return <p className="text-sm text-slate-500">No benchmark method details available yet.</p>;
  }

  const parityEntries = entries.filter(([, spec]) => String(spec.mode ?? "").toLowerCase() === "parity");
  const referenceEntries = entries.filter(([, spec]) => String(spec.mode ?? "").toLowerCase() === "best_reference");

  function renderGroup(title: string, entriesForGroup: Array<[string, JsonRecord]>) {
    if (!entriesForGroup.length) {
      return null;
    }
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-200">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{benchmarkModeDescription(entriesForGroup[0][1].mode)}</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {entriesForGroup.map(([methodName, spec]) => (
            <div key={methodName} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-medium text-slate-100">{formatLabel(methodName)}</p>
              <p className="mt-1 text-xs text-slate-400">{formatValue(spec.description)}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400">Base model</span>
                  <span className="max-w-[60%] text-right text-slate-100">{formatValue(spec.base_model)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400">Mode</span>
                  <span className="max-w-[60%] text-right text-slate-100">{benchmarkModeLabel(spec.mode)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400">Rows used</span>
                  <span className="max-w-[60%] text-right text-slate-100">{formatValue(spec.train_rows_used)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400">Features used</span>
                  <span className="max-w-[60%] text-right text-slate-100">{formatValue(spec.feature_count_used)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400">Feature space</span>
                  <span className="max-w-[60%] text-right text-slate-100">{formatValue(spec.feature_space)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400">Scaling</span>
                  <span className="max-w-[60%] text-right text-slate-100">{formatValue(spec.scaler_strategy)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400">Class weighting</span>
                  <span className="max-w-[60%] text-right text-slate-100">{formatValue(spec.class_weight_mode)}</span>
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Hyperparameters</p>
                <DetailList items={extractBenchmarkHyperparameterItems(spec)} />
              </div>
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Limitations</p>
                <TagList values={toStringArray(spec.limitations)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderGroup("Strict Parity Benchmarks", parityEntries)}
      {renderGroup("Best Reference Benchmarks", referenceEntries)}
    </div>
  );
}

function RunSummaryPanel({ summary }: { summary: JsonRecord | null }) {
  if (!summary) {
    return <p className="text-sm text-slate-500">Run summary becomes available after report generation.</p>;
  }

  return (
    <div className="space-y-4">
      <InfoGrid
        items={[
          { label: "Status", value: summary.status },
          { label: "Generated at", value: formatIsoTimestamp(summary.generated_at) },
          { label: "Dataset file", value: summary.dataset_file },
          { label: "Label column", value: summary.label_column },
          { label: "Classification mode", value: summary.classification_mode },
          { label: "Number of classes", value: summary.number_of_classes },
          { label: "Train rows", value: summary.train_rows },
          { label: "Validation rows", value: summary.validation_rows },
          { label: "Test rows", value: summary.test_rows },
          { label: "Qubits", value: summary.n_qubits },
          { label: "Feature map", value: summary.feature_map_type },
          { label: "Ansatz", value: summary.ansatz_type },
          { label: "Ansatz reps", value: summary.ansatz_reps },
          { label: "Backend", value: summary.backend },
          { label: "Best baseline", value: summary.best_baseline_model },
          { label: "Baselines complete", value: summary.mandatory_baselines_complete },
          { label: "VQC complete", value: summary.vqc_complete },
        ]}
      />
      <Card title="Main Warnings">
        <TagList values={toStringArray(summary.main_warnings)} />
      </Card>
    </div>
  );
}

function TextLogPanel({ lines, emptyText }: { lines: Array<{ id: string; text: string; tone?: string }>; emptyText: string }) {
  if (!lines.length) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }
  return (
    <div className="h-64 overflow-y-auto rounded-xl border border-slate-800 bg-black/30 p-3 font-mono text-xs text-slate-200">
      <div className="space-y-1.5">
        {lines.map((line) => (
          <div key={line.id} className={line.tone ?? "text-slate-200"}>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VqcClassifierPage() {
  const [apiKey, setApiKey] = useState("");
  const [license, setLicense] = useState<LicenseStatusResponse | null>(null);
  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [datasetLoadState, setDatasetLoadState] = useState<DatasetLoadState>("idle");
  const [datasetPathInput, setDatasetPathInput] = useState("");
  const [datasetReferenceUri, setDatasetReferenceUri] = useState("");
  const [jobId, setJobId] = useState("");
  const [dismissedReconnectJobId, setDismissedReconnectJobId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<Record<PipelineStepKey, PipelineStepStatus>>(() => cloneInitialSteps());
  const [clientLogEntries, setClientLogEntries] = useState<ClientLogEntry[]>([]);
  const [parameterOverrides, setParameterOverrides] = useState<ParameterOverridesState>(() => defaultParameterOverrides());
  const [parameterOverridesDirty, setParameterOverridesDirty] = useState(false);

  const [healthResponse, setHealthResponse] = useState<HealthResponse | null>(null);
  const [inspectResponse, setInspectResponse] = useState<InspectWorkbookResponse | null>(null);
  const [prepareResponse, setPrepareResponse] = useState<PrepareDataResponse | null>(null);
  const [planResponse, setPlanResponse] = useState<PlanRunResponse | null>(null);
  const [baselinesResponse, setBaselinesResponse] = useState<RunBaselinesResponse | null>(null);
  const [vqcResponse, setVqcResponse] = useState<RunVqcResponse | null>(null);
  const [reportResponse, setReportResponse] = useState<GenerateReportResponse | null>(null);
  const [executeResponse, setExecuteResponse] = useState<ExecuteRunResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [jobLogResponse, setJobLogResponse] = useState<JobLogResponse | null>(null);
  const [jobListResponse, setJobListResponse] = useState<JobListResponse | null>(null);
  const workbookInputRef = useRef<HTMLInputElement | null>(null);
  const datasetInputRef = useRef<HTMLInputElement | null>(null);
  const reviewJsonInputRef = useRef<HTMLInputElement | null>(null);

  const pushClientLog = useCallback((level: LogLevel, message: string, stage?: PipelineStepKey | string | null) => {
    setClientLogEntries((entries) => [
      {
        id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        source: "client",
        level,
        stage,
        message,
      },
      ...entries,
    ]);
  }, []);

  function resetForWorkbookChange() {
    setPrepareResponse(null);
    setPlanResponse(null);
    setBaselinesResponse(null);
    setVqcResponse(null);
    setReportResponse(null);
    setExecuteResponse(null);
    setJobStatus(null);
    setJobLogResponse(null);
    setJobId("");
    setStepStatus(cloneInitialSteps());
    setParameterOverridesDirty(false);
    setDismissedReconnectJobId(null);
  }

  function resetForDataChange() {
    setPrepareResponse(null);
    setPlanResponse(null);
    setBaselinesResponse(null);
    setVqcResponse(null);
    setReportResponse(null);
    setExecuteResponse(null);
    setJobStatus(null);
    setJobLogResponse(null);
    setJobId("");
    setDatasetReferenceUri("");
    setStepStatus((previous) => ({
      inspect: previous.inspect,
      prepare: "pending",
      plan: "pending",
      baselines: "pending",
      vqc: "pending",
      report: "pending",
    }));
    setDismissedReconnectJobId(null);
    setDatasetLoadState("idle");
  }

  const applySettingsToOverrides = useCallback((settings: JsonRecord | null) => {
    setParameterOverrides(hydrateOverridesFromSettings(settings));
    setParameterOverridesDirty(false);
  }, []);

  function updateOverride<K extends keyof ParameterOverridesState>(key: K, value: ParameterOverridesState[K]) {
    setParameterOverrides((previous) => ({ ...previous, [key]: value }));
    setParameterOverridesDirty(true);
  }

  const syncResultSummaries = useCallback((status: JobStatusResponse) => {
    const summaries = asRecord(status.result_summaries) ?? {};
    const effectiveSettings = asRecord(status.effective_settings) ?? {};
    const commonPayload = {
      status: "ok",
      job_id: status.job_id,
      artifact_paths: status.artifact_paths ?? {},
      effective_settings: effectiveSettings,
      config_source: status.config_source,
      workbook_metadata: status.workbook_metadata ?? {},
      warnings: extractWarnings(status),
      errors: [],
    };

    const planSummary = asRecord(summaries.plan);
    if (planSummary) {
      setPlanResponse((previous) => ({
        ...(previous ?? {}),
        ...commonPayload,
        ...planSummary,
      }));
    }

    const baselineSummary = asRecord(summaries.baselines);
    if (baselineSummary) {
      setBaselinesResponse((previous) => ({
        ...(previous ?? {}),
        ...commonPayload,
        ...baselineSummary,
      }));
    }

    const vqcSummary = asRecord(summaries.vqc);
    if (vqcSummary) {
      setVqcResponse((previous) => ({
        ...(previous ?? {}),
        ...commonPayload,
        ...vqcSummary,
      }));
    }

    const reportSummary = asRecord(summaries.report);
    if (reportSummary) {
      setReportResponse((previous) => ({
        ...(previous ?? {}),
        ...commonPayload,
        ...reportSummary,
      }));
    }
  }, []);

  const refreshRecentJobs = useCallback(async () => {
    try {
      const response = await getJson<JobListResponse>(`${ENDPOINTS.jobs}?limit=8`, apiKey);
      setJobListResponse(response);
    } catch {
      // keep the page quiet if recent job polling fails
    }
  }, [apiKey]);

  const checkBackend = useCallback(async () => {
    setActiveRequest("Checking backend");
    setLastError(null);
    try {
      const response = await getJson<HealthResponse>(ENDPOINTS.health, apiKey);
      setHealthResponse(response);
      pushClientLog("success", "Backend connectivity verified.", "inspect");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check backend failed.";
      setHealthResponse(null);
      setLastError(message);
      pushClientLog("error", `Backend check failed: ${message}`, "inspect");
    } finally {
      setActiveRequest(null);
    }
  }, [apiKey, pushClientLog]);

  async function checkLicense() {
    setActiveRequest("Checking access");
    setLastError(null);
    try {
      const response = await getJson<LicenseStatusResponse>(ENDPOINTS.licenseStatus, apiKey);
      setLicense(response);
      pushClientLog(
        "success",
        `Access ready: ${response.display_name}${response.valid_for?.length ? ` (${response.valid_for.join(", ")})` : ""}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "License check failed.";
      if (message.includes("Not Found")) {
        const fallbackLicense: LicenseStatusResponse = {
          status: "active",
          usage_level: "public_demo",
          display_name: "Public Demo (fallback)",
          valid_for: ["QAOA", "VQC"],
          remaining_runs: "unlimited",
          organization: "Local Demo",
          features: ["inspect_workbook", "prepare_data", "async_execute_run"],
        };
        setLicense(fallbackLicense);
        pushClientLog("warning", "Access endpoint missing on this backend revision. Falling back to local public demo access.");
      } else {
        setLicense(null);
        setLastError(message);
        pushClientLog("error", `Access check failed: ${message}`);
      }
    } finally {
      setActiveRequest(null);
    }
  }

  async function inspectWorkbook(file: File, options?: { chainPrepare?: boolean }) {
    setActiveRequest("Inspecting workbook");
    setLastError(null);
    setStepStatus((previous) => ({
      ...cloneInitialSteps(),
      inspect: "running",
      prepare: previous.prepare === "done" && options?.chainPrepare ? "pending" : "pending",
    }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await postMultipart<InspectWorkbookResponse>(ENDPOINTS.inspectWorkbook, formData, apiKey);
      setInspectResponse(response);
      applySettingsToOverrides(asRecord(response.effective_settings));
      setStepStatus((previous) => ({ ...previous, inspect: "done" }));
      pushClientLog("success", `Workbook inspected: ${file.name}`, "inspect");

      if (options?.chainPrepare && (datasetReferenceUri.trim() || datasetFile || datasetPathInput.trim())) {
        await prepareData({
          workbookOverride: file,
          datasetOverride: datasetReferenceUri.trim() ? null : datasetFile,
          datasetPathOverride: datasetReferenceUri.trim() || datasetPathInput.trim(),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workbook inspection failed.";
      setStepStatus((previous) => ({ ...previous, inspect: "error" }));
      setLastError(message);
      pushClientLog("error", `Workbook inspection failed: ${message}`, "inspect");
    } finally {
      setActiveRequest(null);
    }
  }

  const runPlan = useCallback(async (targetJobId: string, workbookOverride?: File | null) => {
    if (!targetJobId) {
      return null;
    }

    setStepStatus((previous) => ({ ...previous, plan: "running" }));
    pushClientLog("info", `Refreshing runtime estimate for ${targetJobId}.`, "plan");

    try {
      const formData = new FormData();
      formData.append("job_id", targetJobId);
      const workbookToUse = workbookOverride ?? workbookFile;
      if (workbookToUse) {
        formData.append("workbook", workbookToUse);
      }
      formData.append("config_overrides", JSON.stringify(buildConfigOverridesPayload(parameterOverrides)));
      const response = await postMultipart<PlanRunResponse>(ENDPOINTS.planRun, formData, apiKey);
      setPlanResponse(response);
      setStepStatus((previous) => ({ ...previous, plan: "done" }));
      pushClientLog("success", `Planning estimate refreshed for ${targetJobId}.`, "plan");
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Run planning failed.";
      setStepStatus((previous) => ({ ...previous, plan: "error" }));
      setLastError(message);
      pushClientLog("error", `Run planning failed: ${message}`, "plan");
      return null;
    }
  }, [apiKey, parameterOverrides, parameterOverridesDirty, pushClientLog, workbookFile]);

  async function prepareData(options?: {
    workbookOverride?: File | null;
    datasetOverride?: File | null;
    datasetPathOverride?: string;
  }) {
    const workbookToUse = options?.workbookOverride ?? workbookFile;
    const explicitDatasetPath = options?.datasetPathOverride;
    const datasetPathToUse = (explicitDatasetPath !== undefined ? explicitDatasetPath : (datasetReferenceUri || datasetPathInput)).trim();
    const datasetToUse = datasetPathToUse ? null : (options?.datasetOverride ?? datasetFile);

    if (!workbookToUse) {
      const message = "Load a workbook first so we have a config to inspect and prepare against.";
      setLastError(message);
      pushClientLog("warning", message, "prepare");
      return null;
    }

    setActiveRequest("Preparing data");
    setLastError(null);
    setStepStatus((previous) => ({
      ...previous,
      prepare: "running",
      plan: "pending",
      baselines: "pending",
      vqc: "pending",
      report: "pending",
    }));

    try {
      const formData = new FormData();
      formData.append("workbook", workbookToUse);
      if (datasetToUse) {
        formData.append("dataset", datasetToUse);
      } else if (datasetPathToUse) {
        formData.append("dataset_path", datasetPathToUse);
      }

      const response = await postMultipart<PrepareDataResponse>(ENDPOINTS.prepareData, formData, apiKey);
      setPrepareResponse(response);
      setJobId(response.job_id ?? "");
      setDatasetLoadState("loaded");
      setStepStatus((previous) => ({ ...previous, prepare: "done" }));
      pushClientLog("success", `Prepared data for ${response.dataset_file ?? "dataset"} as ${response.job_id}.`, "prepare");

      if (response.job_id) {
        await runPlan(response.job_id, workbookToUse);
        await refreshRecentJobs();
      }

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Data preparation failed.";
      setStepStatus((previous) => ({ ...previous, prepare: "error" }));
      setDatasetLoadState("error");
      setLastError(message);
      pushClientLog("error", `Data preparation failed: ${message}`, "prepare");
      return null;
    } finally {
      setActiveRequest(null);
    }
  }

  const uploadDatasetToCloud = useCallback(async (file: File) => {
    const uploadTarget = await postJson<DatasetUploadTargetResponse>(
      ENDPOINTS.datasetUploadTarget,
      {
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      },
      apiKey,
    );

    const uploadResponse = await fetch(uploadTarget.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || uploadTarget.content_type || "application/octet-stream",
      },
      body: file,
    });
    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      throw new Error(text.trim() || `Direct dataset upload failed with status ${uploadResponse.status}.`);
    }
    return uploadTarget;
  }, [apiKey]);

  const refreshJobState = useCallback(async (targetJobId: string, silent = true) => {
    try {
      const [statusResponse, logResponse] = await Promise.all([
        getJson<JobStatusResponse>(`${ENDPOINTS.jobs}/${encodeURIComponent(targetJobId)}`, apiKey),
        getJson<JobLogResponse>(`${ENDPOINTS.jobs}/${encodeURIComponent(targetJobId)}/log?tail=200`, apiKey),
      ]);

      setJobStatus(statusResponse);
      setJobLogResponse(logResponse);
      if (statusResponse.job_id) {
        setJobId(statusResponse.job_id);
      }
      if (!parameterOverridesDirty) {
        applySettingsToOverrides(asRecord(statusResponse.effective_settings));
      }

      const mappedSteps = buildStepStatusFromJob(statusResponse);
      if (mappedSteps) {
        setStepStatus(mappedSteps);
      }
      syncResultSummaries(statusResponse);

      if (statusResponse.job_status === "completed") {
        pushClientLog("success", `Async run ${targetJobId} completed.`, statusResponse.current_stage);
        setActiveRequest(null);
      } else if (statusResponse.job_status === "failed") {
        pushClientLog("error", `Async run ${targetJobId} failed.`, statusResponse.current_stage);
        setActiveRequest(null);
      } else if (statusResponse.job_status === "cancelled") {
        pushClientLog("warning", `Async run ${targetJobId} was cancelled.`, statusResponse.current_stage);
        setActiveRequest(null);
      }

      await refreshRecentJobs();
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : "Job refresh failed.";
        setLastError(message);
        pushClientLog("error", `Could not refresh job ${targetJobId}: ${message}`);
      }
    }
  }, [apiKey, applySettingsToOverrides, parameterOverridesDirty, pushClientLog, refreshRecentJobs, syncResultSummaries]);

  async function executeRun() {
    let ensuredJobId = jobId.trim();
    setLastError(null);

    if (!ensuredJobId) {
      const prepared = await prepareData();
      ensuredJobId = prepared?.job_id ?? "";
    }

    if (!ensuredJobId) {
      return;
    }

    setActiveRequest("Queuing async run");
    try {
      const formData = new FormData();
      formData.append("job_id", ensuredJobId);
      if (workbookFile) {
        formData.append("workbook", workbookFile);
      }
      formData.append("config_overrides", JSON.stringify(buildConfigOverridesPayload(parameterOverrides)));
      const response = await postMultipart<ExecuteRunResponse>(ENDPOINTS.executeRun, formData, apiKey);
      setExecuteResponse(response);
      setJobId(response.job_id ?? ensuredJobId);
      pushClientLog("info", `Queued async run for ${response.job_id ?? ensuredJobId}.`, "plan");
      await refreshJobState(response.job_id ?? ensuredJobId, false);
      setActiveRequest(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execute run failed.";
      setLastError(message);
      pushClientLog("error", `Execute run failed: ${message}`, "plan");
      setActiveRequest(null);
    }
  }

  async function cancelJob(targetJobId?: string) {
    const resolvedJobId = (targetJobId ?? jobId).trim();
    if (!resolvedJobId) {
      return;
    }
    setActiveRequest("Requesting cancel");
    setLastError(null);
    try {
      await postEmpty(`${ENDPOINTS.jobs}/${encodeURIComponent(resolvedJobId)}/cancel`, apiKey);
      setJobId(resolvedJobId);
      pushClientLog("warning", `Cancellation requested for ${resolvedJobId}.`, "vqc");
      await refreshJobState(resolvedJobId, false);
      setActiveRequest(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cancel request failed.";
      setLastError(message);
      pushClientLog("error", `Cancel request failed: ${message}`, "vqc");
      setActiveRequest(null);
    }
  }

  async function loadJob(targetJobId: string) {
    if (!targetJobId.trim()) {
      return;
    }
    setJobId(targetJobId.trim());
    setActiveRequest("Loading job");
    setLastError(null);
    pushClientLog("info", `Loading async job ${targetJobId.trim()}.`);
    await refreshJobState(targetJobId.trim(), false);
    setActiveRequest(null);
  }

  async function downloadJobArtifact(artifactKey: string, fallbackFilename: string) {
    const resolvedJobId = (reportResponse?.job_id ?? jobId).trim();
    if (!resolvedJobId) {
      setLastError("No completed run is selected for download yet.");
      return;
    }

    setActiveRequest(`Downloading ${fallbackFilename}`);
    setLastError(null);
    try {
      const response = await fetch(`${API_BASE}${ENDPOINTS.jobs}/${encodeURIComponent(resolvedJobId)}/artifact/${encodeURIComponent(artifactKey)}`, {
        headers: apiKey ? { "X-API-Key": apiKey } : undefined,
      });
      if (!response.ok) {
        const message = (await response.text()).trim() || `Download failed with status ${response.status}.`;
        throw new Error(message);
      }
      const filename =
        getFilenameFromContentDisposition(response.headers.get("Content-Disposition")) ??
        fallbackFilename;
      downloadBlob(await response.blob(), filename);
      pushClientLog("success", `Downloaded ${filename}.`, "report");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Artifact download failed.";
      setLastError(message);
      pushClientLog("error", `Artifact download failed: ${message}`, "report");
    } finally {
      setActiveRequest(null);
    }
  }

  function downloadJsonDataFile() {
    const snapshot: SavedVqcReviewSnapshot = {
      schema: "vqc-rqp-review-snapshot",
      schema_version: 1,
      saved_at: new Date().toISOString(),
      api_base: API_BASE,
      original_workbook_filename: workbookFile?.name ?? inspectResponse?.filename ?? null,
      dataset_reference_uri: datasetReferenceUri.trim() || null,
      dataset_path_input: datasetPathInput.trim() || null,
      job_id: (reportResponse?.job_id ?? jobStatus?.job_id ?? executeResponse?.job_id ?? jobId) || null,
      parameter_overrides: parameterOverrides,
      step_status: stepStatus,
      license,
      health_response: healthResponse,
      inspect_response: inspectResponse,
      prepare_response: prepareResponse,
      plan_response: planResponse,
      baselines_response: baselinesResponse,
      vqc_response: vqcResponse,
      report_response: reportResponse,
      execute_response: executeResponse,
      job_status: jobStatus,
      job_log_response: jobLogResponse,
      client_log_entries: clientLogEntries,
    };
    const stem = sanitizeDownloadStem(
      snapshot.job_id ?? snapshot.original_workbook_filename ?? prepareResponse?.dataset_file ?? "vqc_review",
    );
    const filename = `${stem}_${timestampForFilename(snapshot.saved_at)}.json`;
    downloadBlob(
      new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }),
      filename,
    );
    pushClientLog("success", `JSON data file downloaded: ${filename}.`, "report");
  }

  async function loadJsonDataFileFromInput(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) {
      return;
    }

    setActiveRequest("Loading JSON data file");
    setLastError(null);
    try {
      const parsed = JSON.parse(await selectedFile.text()) as SavedVqcReviewSnapshot;
      if (parsed.schema !== "vqc-rqp-review-snapshot" || parsed.schema_version !== 1) {
        throw new Error("Unsupported VQC review JSON format.");
      }

      setWorkbookFile(null);
      setDatasetFile(null);
      setDatasetLoadState(parsed.prepare_response || parsed.dataset_reference_uri ? "loaded" : "idle");
      setDatasetReferenceUri(parsed.dataset_reference_uri ?? "");
      setDatasetPathInput(parsed.dataset_path_input ?? "");
      setJobId(parsed.job_id ?? "");
      setDismissedReconnectJobId(null);
      setParameterOverrides(parsed.parameter_overrides ?? defaultParameterOverrides());
      setParameterOverridesDirty(false);
      setStepStatus(parsed.step_status ?? cloneInitialSteps());
      setLicense(parsed.license ?? null);
      setHealthResponse(parsed.health_response ?? null);
      setInspectResponse(parsed.inspect_response ?? null);
      setPrepareResponse(parsed.prepare_response ?? null);
      setPlanResponse(parsed.plan_response ?? null);
      setBaselinesResponse(parsed.baselines_response ?? null);
      setVqcResponse(parsed.vqc_response ?? null);
      setReportResponse(parsed.report_response ?? null);
      setExecuteResponse(parsed.execute_response ?? null);
      setJobStatus(parsed.job_status ?? null);
      setJobLogResponse(parsed.job_log_response ?? null);
      setClientLogEntries(parsed.client_log_entries ?? []);
      setJobListResponse(null);

      pushClientLog("success", `Loaded JSON data file: ${selectedFile.name}.`, "report");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load JSON data file.";
      setLastError(message);
      pushClientLog("error", `JSON data file load failed: ${message}`, "report");
    } finally {
      setActiveRequest(null);
    }
  }

  function handleWorkbookChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setWorkbookFile(file);
    resetForWorkbookChange();
    pushClientLog("info", `Selected workbook snapshot: ${file.name}.`, "inspect");
    event.target.value = "";
    void inspectWorkbook(file, { chainPrepare: Boolean(datasetReferenceUri.trim() || datasetFile || datasetPathInput.trim()) });
  }

  function handleDatasetFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setDatasetFile(file);
    setDatasetPathInput("");
    resetForDataChange();
    setDatasetLoadState("loading");
    pushClientLog("info", `Selected dataset snapshot: ${file.name}.`, "prepare");
    event.target.value = "";
    void (async () => {
      setActiveRequest("Uploading dataset");
      setLastError(null);
      try {
        const uploadTarget = await uploadDatasetToCloud(file);
        setDatasetReferenceUri(uploadTarget.gs_uri);
        pushClientLog("success", `Uploaded dataset directly to bucket: ${uploadTarget.gs_uri}.`, "prepare");
        if (workbookFile) {
          await prepareData({ datasetOverride: null, datasetPathOverride: uploadTarget.gs_uri });
        } else {
          setDatasetLoadState("loaded");
          pushClientLog("info", "Dataset is uploaded and ready. Load a workbook to start preparation.", "prepare");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Dataset upload failed.";
        setDatasetFile(null);
        setDatasetLoadState("error");
        setLastError(message);
        pushClientLog("error", `Dataset upload failed: ${message}`, "prepare");
      } finally {
        setActiveRequest(null);
      }
    })();
  }

  async function handleDatasetPathSubmit() {
    if (!datasetPathInput.trim()) {
      return;
    }
    setDatasetFile(null);
    resetForDataChange();
    setDatasetLoadState("loading");
    setDatasetReferenceUri(datasetPathInput.trim());
    pushClientLog("info", `Preparing data from dataset path: ${datasetPathInput.trim()}.`, "prepare");
    await prepareData({ datasetOverride: null, datasetPathOverride: datasetPathInput.trim() });
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const response = await getJson<HealthResponse>(ENDPOINTS.health);
        if (mounted) {
          setHealthResponse(response);
        }
      } catch {
        if (mounted) {
          setHealthResponse(null);
        }
      }

      try {
        const response = await getJson<JobListResponse>(`${ENDPOINTS.jobs}?limit=8`);
        if (mounted) {
          setJobListResponse(response);
        }
      } catch {
        // stay quiet on mount if the async jobs endpoint is unavailable
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const isJobActive = useMemo(() => {
    const status = (jobStatus?.job_status ?? executeResponse?.job_status ?? "").toLowerCase();
    return status === "queued" || status === "running";
  }, [executeResponse?.job_status, jobStatus?.job_status]);
  const isCancelRequested = Boolean(jobStatus?.cancel_requested);

  useEffect(() => {
    if (!jobId || !isJobActive) {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshJobState(jobId, true);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [isJobActive, jobId, refreshJobState]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshRecentJobs();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [refreshRecentJobs]);

  useEffect(() => {
    if (!jobId || stepStatus.prepare !== "done" || !parameterOverridesDirty) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void runPlan(jobId);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [jobId, parameterOverrides, parameterOverridesDirty, runPlan, stepStatus.prepare]);

  const currentEffectiveSettings = useMemo(() => {
    return (
      asRecord(jobStatus?.effective_settings) ??
      asRecord(reportResponse?.effective_settings) ??
      asRecord(vqcResponse?.effective_settings) ??
      asRecord(baselinesResponse?.effective_settings) ??
      asRecord(planResponse?.effective_settings) ??
      asRecord(prepareResponse?.effective_settings) ??
      asRecord(inspectResponse?.effective_settings) ??
      null
    );
  }, [
    baselinesResponse?.effective_settings,
    inspectResponse?.effective_settings,
    jobStatus?.effective_settings,
    planResponse?.effective_settings,
    prepareResponse?.effective_settings,
    reportResponse?.effective_settings,
    vqcResponse?.effective_settings,
  ]);

  const currentWarnings = useMemo(() => {
    let merged: string[] = [];
    [
      inspectResponse,
      prepareResponse,
      planResponse,
      baselinesResponse,
      vqcResponse,
      reportResponse,
      executeResponse,
      jobStatus,
      jobLogResponse,
      jobListResponse,
    ].forEach((response) => {
      merged = mergeWarnings(merged, extractWarnings(response));
    });
    return merged;
  }, [
    baselinesResponse,
    executeResponse,
    inspectResponse,
    jobListResponse,
    jobLogResponse,
    jobStatus,
    planResponse,
    prepareResponse,
    reportResponse,
    vqcResponse,
  ]);

  const hasAccess = license?.status === "active" || license?.status === "public";
  const clientLogLines = useMemo(
    () =>
      clientLogEntries.slice(0, 120).map((entry) => ({
        id: entry.id,
        tone:
          entry.level === "error"
            ? "text-rose-300"
            : entry.level === "warning"
              ? "text-amber-300"
              : entry.level === "success"
                ? "text-emerald-300"
                : "text-slate-200",
        text: `${formatIsoTimestamp(entry.timestamp)} ${entry.stage ? `[${entry.stage}] ` : ""}${entry.message}`,
      })),
    [clientLogEntries],
  );
  const backendLogLines = useMemo(
    () =>
      [...(jobLogResponse?.log_entries ?? [])].reverse().map((entry, index) => ({
        id: `backend-${entry.timestamp ?? "t"}-${index}`,
        tone:
          entry.level === "error"
            ? "text-rose-300"
            : entry.level === "warning"
              ? "text-amber-300"
              : "text-slate-200",
        text: formatBackendLogLine(entry),
      })),
    [jobLogResponse?.log_entries],
  );

  const currentPlanSummary = useMemo(() => asRecord(asRecord(jobStatus?.result_summaries)?.plan), [jobStatus?.result_summaries]);
  const currentRuntimeEstimate = asRecord(planResponse?.runtime_estimate) ?? asRecord(currentPlanSummary?.runtime_estimate);
  const currentMemoryEstimate = asRecord(planResponse?.memory_estimate) ?? asRecord(currentPlanSummary?.memory_estimate);
  const currentCircuitEstimate = asRecord(planResponse?.circuit_estimate) ?? asRecord(currentPlanSummary?.circuit_estimate);
  const currentVqcWorkload = asRecord(planResponse?.vqc_workload_estimate) ?? asRecord(currentPlanSummary?.vqc_workload_estimate);
  const currentHardwareFeasibility = asRecord(planResponse?.hardware_feasibility) ?? asRecord(currentPlanSummary?.hardware_feasibility);
  const currentRecommendations = Array.isArray(planResponse?.recommendations)
    ? planResponse.recommendations
    : (Array.isArray(currentPlanSummary?.recommendations) ? (currentPlanSummary.recommendations as string[]) : []);
  const preparedClassDistribution = asRecord(prepareResponse?.class_distribution);
  const effectiveTrainingDistribution = useMemo(
    () =>
      deriveEffectiveTrainingDistribution(preparedClassDistribution, {
        balanceTrainingOnly: parameterOverrides.balanceTrainingOnly,
      }),
    [parameterOverrides.balanceTrainingOnly, preparedClassDistribution],
  );
  const currentRunSummary = asRecord(reportResponse?.run_summary);
  const currentStageLabel = jobStatus?.current_stage ?? executeResponse?.current_stage ?? activeRequest ?? "Ready";
  const currentJobStatus = jobStatus?.job_status ?? executeResponse?.job_status ?? "idle";
  const currentRuntimeTracking =
    asRecord(jobStatus?.runtime_tracking) ?? asRecord(executeResponse?.runtime_tracking) ?? null;
  const currentVqcLimits = asRecord(license?.vqc_limits) ?? null;
  const currentAllowedWorkerProfiles = useMemo(() => {
    const allowed = asStringArray(license?.allowed_worker_profiles);
    return allowed.length ? allowed : ["small", "medium", "large"];
  }, [license?.allowed_worker_profiles]);
  const hasAnyReviewData = Boolean(
    inspectResponse ||
      prepareResponse ||
      planResponse ||
      baselinesResponse ||
      vqcResponse ||
      reportResponse ||
      jobStatus,
  );
  const currentBenchmarkMethodSpecs = useMemo(
    () => asRecord(baselinesResponse?.benchmark_method_specs),
    [baselinesResponse?.benchmark_method_specs],
  );
  const sortedBaselineMetricEntries = useMemo(
    () =>
      sortBenchmarkMethodEntries(
        Object.entries(asRecord(baselinesResponse?.baseline_metrics) ?? {}).filter(
          (entry): entry is [string, JsonRecord] => isRecord(entry[1]),
        ),
      ),
    [baselinesResponse?.baseline_metrics],
  );
  const reconnectCandidate = useMemo(() => {
    const jobs = jobListResponse?.jobs ?? [];
    return (
      jobs.find((job) => {
        const status = (job.job_status ?? "").toLowerCase();
        return (
          job.job_id &&
          job.job_id !== dismissedReconnectJobId &&
          job.job_id !== jobId &&
          (status === "queued" || status === "running")
        );
      }) ?? null
    );
  }, [dismissedReconnectJobId, jobId, jobListResponse?.jobs]);
  const currentDatasetSettings = asRecord(currentEffectiveSettings?.dataset);
  const currentStatusMessage = isCancelRequested
    ? "Cancellation requested. Waiting for the backend to stop the active run at the next safe checkpoint."
    : (jobStatus?.message ?? "Ready for the next step.");
  const currentElapsedRuntime = asFiniteNumber(currentRuntimeTracking?.elapsed_seconds);
  const currentRemainingRuntime = asFiniteNumber(currentRuntimeTracking?.estimated_remaining_seconds);
  const currentEstimatedTotalRuntime = asFiniteNumber(currentRuntimeTracking?.estimated_total_seconds);
  const maxLicenseIterations = asFiniteNumber(currentVqcLimits?.max_iterations);
  const maxLicenseRepeats = asFiniteNumber(currentVqcLimits?.max_repeats);
  const maxLicenseRuntimeMinutes = asFiniteNumber(currentVqcLimits?.max_runtime_minutes);
  const plannedTotalMinutes =
    asFiniteNumber(currentRuntimeTracking?.planned_total_minutes_nominal) ??
    asFiniteNumber(currentRuntimeEstimate?.estimated_total_minutes_nominal);
  const plannedRuntimeClass =
    (typeof currentRuntimeTracking?.planned_runtime_class === "string" ? currentRuntimeTracking?.planned_runtime_class : null) ??
    (typeof currentRuntimeEstimate?.overall_runtime_class === "string" ? currentRuntimeEstimate?.overall_runtime_class : null) ??
    (typeof currentRuntimeEstimate?.runtime_class === "string" ? currentRuntimeEstimate?.runtime_class : null);
  const selectedWorkerProfile =
    (typeof currentRuntimeTracking?.selected_worker_profile === "string" ? currentRuntimeTracking.selected_worker_profile : null) ??
    (typeof currentRuntimeEstimate?.selected_worker_profile === "string" ? currentRuntimeEstimate.selected_worker_profile : null) ??
    parameterOverrides.workerProfile;
  const recommendedWorkerProfile =
    (typeof currentRuntimeTracking?.recommended_worker_profile === "string" ? currentRuntimeTracking.recommended_worker_profile : null) ??
    (typeof currentRuntimeEstimate?.recommended_worker_profile === "string" ? currentRuntimeEstimate.recommended_worker_profile : null);
  const accessFeedback =
    license?.status === "active"
      ? `${license.display_name} access is active for QAOA and VQC.`
      : license?.status === "public"
        ? "Public demo access is active. Heavier VQC settings may be capped."
        : "Check access to load the VQC limits for this key.";
  const runtimeFeedback =
    isCancelRequested
      ? `Cancellation requested while ${formatLabel(currentJobStatus)}. The active stage will stop as soon as the backend reaches a safe cancellation checkpoint.`
      : currentJobStatus === "running" && currentElapsedRuntime !== null
      ? `Elapsed ${formatDurationSeconds(currentElapsedRuntime)}${currentRemainingRuntime !== null ? ` · est. remaining ${formatDurationSeconds(currentRemainingRuntime)}` : ""}${currentEstimatedTotalRuntime !== null ? ` · est. total ${formatDurationSeconds(currentEstimatedTotalRuntime)}` : ""}${asFiniteNumber(currentRuntimeTracking?.current_repeat) !== null && asFiniteNumber(currentRuntimeTracking?.repeats_requested) !== null ? ` · repeat ${formatValue(currentRuntimeTracking?.current_repeat)}/${formatValue(currentRuntimeTracking?.repeats_requested)}` : ""}${asFiniteNumber(currentRuntimeTracking?.current_iteration) !== null && asFiniteNumber(currentRuntimeTracking?.iterations_requested) !== null ? ` · iteration ${formatValue(currentRuntimeTracking?.current_iteration)}/${formatValue(currentRuntimeTracking?.iterations_requested)}` : ""}`
      : plannedTotalMinutes !== null
        ? `Planned nominal runtime ${plannedTotalMinutes.toFixed(plannedTotalMinutes < 10 ? 1 : 0)} min (${formatLabel(plannedRuntimeClass ?? "unknown")})${maxLicenseRuntimeMinutes !== null ? ` · access cap ${maxLicenseRuntimeMinutes} min` : ""}${recommendedWorkerProfile ? ` · recommended worker ${formatLabel(recommendedWorkerProfile)}` : ""}.`
        : "Load data and plan the run to get a backend runtime estimate.";
  const statusRowOneItems = [
    { label: "Backend health", value: healthResponse?.status },
    { label: "Access", value: license?.display_name ?? "Pending" },
    { label: "Current job", value: jobId || "Waiting for prepared data" },
    { label: "Current stage", value: currentStageLabel },
    { label: "Job status", value: currentJobStatus },
    { label: "Runtime class", value: plannedRuntimeClass },
  ];
  const statusRowTwoItems = [
    { label: "Worker profile", value: selectedWorkerProfile },
    { label: "Elapsed", value: currentElapsedRuntime !== null ? formatDurationSeconds(currentElapsedRuntime) : "-" },
    {
      label: "ETA",
      value:
        currentRemainingRuntime !== null
          ? formatDurationSeconds(currentRemainingRuntime)
          : plannedTotalMinutes !== null
            ? `${plannedTotalMinutes.toFixed(plannedTotalMinutes < 10 ? 1 : 0)} min nominal`
            : "-",
    },
    {
      label: "Total est.",
      value:
        currentEstimatedTotalRuntime !== null
          ? formatDurationSeconds(currentEstimatedTotalRuntime)
          : plannedTotalMinutes !== null
            ? `${plannedTotalMinutes.toFixed(plannedTotalMinutes < 10 ? 1 : 0)} min`
            : "-",
    },
    { label: "Cancel requested", value: isCancelRequested },
  ];
  const reportComparisonRows = Array.isArray(reportResponse?.model_comparison) ? reportResponse.model_comparison : [];
  const baselineComparisonRows = Array.isArray(baselinesResponse?.model_comparison) ? baselinesResponse.model_comparison : [];
  const currentClassificationMode =
    reportResponse?.run_summary && isRecord(reportResponse.run_summary) && typeof reportResponse.run_summary.classification_mode === "string"
      ? reportResponse.run_summary.classification_mode
      : vqcResponse?.classification_mode ?? baselinesResponse?.classification_mode ?? prepareResponse?.inferred_classification_mode ?? "binary";
  const fallbackFinalComparisonRows = useMemo(() => {
    const rows: MetricTableRow[] = [];
    if (isRecord(vqcResponse?.test_metrics)) {
      rows.push(buildComparisonRowFromMetrics("vqc", currentClassificationMode, asRecord(vqcResponse?.test_metrics)));
    }
    sortedBaselineMetricEntries.forEach(([methodName, bundle]) => {
      rows.push(buildComparisonRowFromMetrics(methodName, currentClassificationMode, asRecord(bundle.test)));
    });
    return rows;
  }, [currentClassificationMode, sortedBaselineMetricEntries, vqcResponse?.test_metrics]);
  const effectiveReportComparisonRows = reportComparisonRows.length >= fallbackFinalComparisonRows.length && reportComparisonRows.length > 0
    ? reportComparisonRows
    : fallbackFinalComparisonRows;
  const baselineGroups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        parity?: { methodName: string; bundle: JsonRecord };
        bestReference?: { methodName: string; bundle: JsonRecord };
      }
    >();
    sortedBaselineMetricEntries.forEach(([methodName, bundle]) => {
      const baseModel = typeof bundle.base_model === "string" ? bundle.base_model : methodName;
      const existing = grouped.get(baseModel) ?? {};
      if (String(bundle.mode ?? "").toLowerCase() === "best_reference") {
        existing.bestReference = { methodName, bundle };
      } else {
        existing.parity = { methodName, bundle };
      }
      grouped.set(baseModel, existing);
    });
    return Array.from(grouped.entries());
  }, [sortedBaselineMetricEntries]);

  useEffect(() => {
    if (!currentAllowedWorkerProfiles.length) {
      return;
    }
    if (currentAllowedWorkerProfiles.includes(parameterOverrides.workerProfile)) {
      return;
    }
    setParameterOverrides((previous) => ({
      ...previous,
      workerProfile: normalizeWorkerProfile(currentAllowedWorkerProfiles[0]),
    }));
  }, [currentAllowedWorkerProfiles, parameterOverrides.workerProfile]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(250,204,21,0.12),transparent_24%),linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))]" />
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="relative p-6">
            <div className="max-w-6xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Rapid Quantum Prototyping (RQP)</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-cyan-300 sm:text-4xl">
                VQC RQP Pro
              </h1>
              <p className="mt-4 max-w-6xl text-sm font-medium leading-7 text-slate-100 sm:text-[1.05rem]">
                Advanced variational quantum classification with workbook-driven configuration, async orchestration,
                mandatory classical baselines, live backend logs, runtime estimation, and consolidated local reporting.
              </p>
              <div className="mt-5 max-w-6xl rounded-2xl border border-slate-700/80 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
                Best used on a desktop or laptop screen. The quick interface is tuned for loading a workbook, loading data,
                adjusting the most important VQC parameters, and then letting the backend carry the rest of the run.
              </div>
            </div>
          </div>
        </section>

        <Card
          title="Status"
          subtitle="A tighter operator view of access, runtime, and the currently active async job."
          accent
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>{currentStatusMessage}</span>
                <span>{typeof jobStatus?.progress === "number" ? formatPercent(jobStatus.progress) : "-"}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, (jobStatus?.progress ?? executeResponse?.progress ?? 0) * 100))}%` }}
                />
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-slate-200">{runtimeFeedback}</p>
              <p className="text-slate-400">{accessFeedback}</p>
            </div>

            <div className="grid gap-3 xl:grid-cols-6">
              {statusRowOneItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                  <div className="mt-2 break-words text-sm text-slate-100">{formatValue(item.value)}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 xl:grid-cols-6">
              {statusRowTwoItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                  <div className="mt-2 break-words text-sm text-slate-100">{formatValue(item.value)}</div>
                </div>
              ))}
              <div className="flex min-h-[88px] flex-col items-stretch justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 xl:items-end">
                <button
                  type="button"
                  onClick={() => void checkBackend()}
                  disabled={activeRequest !== null}
                  className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Check backend
                </button>
                {activeRequest ? <span className="text-xs text-slate-400">{activeRequest}…</span> : null}
              </div>
            </div>
            {lastError ? (
              <div className="rounded-2xl border border-rose-900/70 bg-rose-950/40 p-4 text-sm text-rose-200">{lastError}</div>
            ) : null}
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <Card
              title="Access"
              subtitle="Use the same access-key workflow as QAOA. A blank key still lets you activate the public demo for local testing."
            >
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">QAOA / VQC access key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="Paste the same key you use for QAOA, or leave blank for demo"
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-600"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void checkLicense()}
                  disabled={activeRequest !== null}
                  className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Check license or demo
                </button>
                {license ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                    <DetailList
                      items={[
                        { label: "Access level", value: license.display_name },
                        { label: "Usage level", value: license.usage_level },
                        { label: "Valid for", value: license.valid_for },
                        { label: "Remaining runs", value: license.remaining_runs },
                        { label: "Organization", value: license.organization },
                        { label: "Worker profiles", value: license.allowed_worker_profiles },
                        { label: "Max qubits", value: license.vqc_limits?.max_qubits },
                        { label: "Max iterations", value: license.vqc_limits?.max_iterations },
                        { label: "Max repeats", value: license.vqc_limits?.max_repeats },
                        { label: "Max runtime (min)", value: license.vqc_limits?.max_runtime_minutes },
                      ]}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                    Check access first so the page knows whether you are running under a shared QAOA/VQC key or the public demo profile.
                  </div>
                )}
              </div>
            </Card>

            <Card
              title="Config Load"
              subtitle="Load a workbook once. The page inspects it automatically and uses it as the current configuration snapshot."
            >
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workbook</span>
                  <input
                    ref={workbookInputRef}
                    type="file"
                    accept=".xlsx,.xlsm,.xls"
                    onChange={handleWorkbookChange}
                    className="sr-only"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => workbookInputRef.current?.click()}
                      className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
                    >
                      Choose workbook
                    </button>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${
                        workbookFile
                          ? "border-emerald-800/70 bg-emerald-950/40 text-emerald-200"
                          : "border-slate-800 bg-slate-950/60 text-slate-400"
                      }`}
                    >
                      {workbookFile ? "File loaded" : "No file loaded"}
                    </span>
                  </div>
                </label>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                  {workbookFile ? (
                    <p>
                      Loaded <span className="font-medium text-slate-100">{workbookFile.name}</span>. Inspect runs automatically and downstream cards refresh from the current workbook snapshot.
                    </p>
                  ) : (
                    <p>Select the workbook you want this run to trust. Re-select it after editing on disk so the browser sends the updated bytes.</p>
                  )}
                </div>
              </div>
            </Card>

            <Card
              title="Data Load"
              subtitle="Load a dataset file or point at a dataset path. Preparation runs automatically and refreshes the runtime estimate."
            >
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dataset Upload</span>
                  <input
                    ref={datasetInputRef}
                    type="file"
                    accept=".csv,.parquet"
                    onChange={handleDatasetFileChange}
                    className="sr-only"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => datasetInputRef.current?.click()}
                      className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
                    >
                      Choose dataset
                    </button>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${
                        datasetLoadState === "loading"
                          ? "border-amber-800/70 bg-amber-950/40 text-amber-200"
                          : datasetLoadState === "loaded"
                            ? "border-emerald-800/70 bg-emerald-950/40 text-emerald-200"
                            : datasetLoadState === "error"
                              ? "border-rose-800/70 bg-rose-950/40 text-rose-200"
                              : "border-slate-800 bg-slate-950/60 text-slate-400"
                      }`}
                    >
                      {datasetLoadState === "loading"
                        ? "Loading in progress..."
                        : datasetLoadState === "loaded"
                          ? "File loaded"
                          : datasetLoadState === "error"
                            ? "Load failed"
                            : "No file loaded"}
                    </span>
                  </div>
                </label>

                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dataset Path</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={datasetPathInput}
                      onChange={(event) => setDatasetPathInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleDatasetPathSubmit();
                        }
                      }}
                      placeholder="Optional path the backend can resolve"
                      className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-600"
                    />
                    <button
                      type="button"
                      onClick={() => void handleDatasetPathSubmit()}
                      disabled={activeRequest !== null || !datasetPathInput.trim()}
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Use path
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                  {datasetLoadState === "loading" ? (
                    <p>
                      Uploading the dataset to cloud storage and preparing the run context. This can take a little while on larger files.
                    </p>
                  ) : datasetReferenceUri.trim() ? (
                    <p>
                      Dataset is staged in cloud storage at <span className="font-medium text-slate-100">{datasetReferenceUri}</span>. Preparation will use that object reference instead of pushing the raw file through the backend.
                    </p>
                  ) : datasetFile ? (
                    <p>
                      Loaded <span className="font-medium text-slate-100">{datasetFile.name}</span>. Preparation runs automatically and creates a new job context.
                    </p>
                  ) : datasetPathInput.trim() ? (
                    <p>Dataset path is ready. Press Enter or use the path button to prepare from that location.</p>
                  ) : (
                    <p>If you skip the upload, the backend can fall back to the workbook dataset reference or a manual path you enter here.</p>
                  )}
                </div>
              </div>
            </Card>

            {reconnectCandidate ? (
              <Card
                title="Reconnect Run"
                subtitle="The backend still has an active async job. Reconnect if you want to watch or manage it before starting something new."
              >
                <div className="space-y-4">
                  <DetailList
                    items={[
                      { label: "Job ID", value: reconnectCandidate.job_id },
                      { label: "Status", value: reconnectCandidate.job_status },
                      { label: "Current stage", value: reconnectCandidate.current_stage },
                      { label: "Updated", value: formatIsoTimestamp(reconnectCandidate.updated_at ?? reconnectCandidate.created_at) },
                    ]}
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => reconnectCandidate.job_id && void loadJob(reconnectCandidate.job_id)}
                      disabled={activeRequest !== null || !reconnectCandidate.job_id}
                      className="flex-1 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reconnect
                    </button>
                    <button
                      type="button"
                      onClick={() => reconnectCandidate.job_id && void cancelJob(reconnectCandidate.job_id)}
                      disabled={activeRequest !== null || !reconnectCandidate.job_id}
                      className="rounded-xl border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-200 transition hover:bg-amber-950/60 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Cancel run job
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissedReconnectJobId(reconnectCandidate.job_id ?? null)}
                      className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-500"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </Card>
            ) : null}

            <Card
              title="Execution Profile"
              subtitle="Choose the simulator backend and the cloud-side execution profile. Worker profile is validated against both your access tier and the current qubit/runtime plan."
            >
              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Worker profile</span>
                  <select
                    value={parameterOverrides.workerProfile}
                    onChange={(event) => updateOverride("workerProfile", event.target.value as WorkerProfileOption)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                  >
                    {currentAllowedWorkerProfiles.includes("small") ? <option value="small">Small</option> : null}
                    {currentAllowedWorkerProfiles.includes("medium") ? <option value="medium">Medium</option> : null}
                    {currentAllowedWorkerProfiles.includes("large") ? <option value="large">Large</option> : null}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Simulator backend</span>
                  <select
                    value={parameterOverrides.backend}
                    onChange={(event) => updateOverride("backend", event.target.value as SimulatorBackendOption)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                  >
                    <option value="pennylane_default_qubit">Standard simulator</option>
                    <option value="pennylane_lightning">Lightning simulator</option>
                  </select>
                </label>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                  <p>
                    Selected worker: <span className="text-slate-100">{formatLabel(parameterOverrides.workerProfile)}</span>
                    {recommendedWorkerProfile ? (
                      <>
                        {" "}· Recommended from plan: <span className="text-slate-100">{formatLabel(recommendedWorkerProfile)}</span>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-2">
                    Tensor-style simulation is still not wired in this version. Standard and Lightning are the real choices today.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              title="VQC Parameters"
              subtitle="These controls are now live planning and execution overrides. They stay close to the QAOA left-rail pattern: inspect the workbook, then tune locally."
            >
              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Feature map</span>
                  <select
                    value={parameterOverrides.featureMapType}
                    onChange={(event) => updateOverride("featureMapType", event.target.value as FeatureMapOption)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                  >
                    <option value="angle">Angle</option>
                    <option value="zz_like">ZZ-like</option>
                    <option value="iqp">IQP</option>
                    <option value="amplitude">Amplitude</option>
                    <option value="basis">Basis</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ansatz</span>
                  <select
                    value={parameterOverrides.ansatzType}
                    onChange={(event) => updateOverride("ansatzType", event.target.value as AnsatzOption)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                  >
                    <option value="hardware_efficient">Hardware efficient</option>
                    <option value="custom_rx_ry_cz">Custom RX-RY-CZ</option>
                    <option value="strongly_entangling">Strongly entangling</option>
                    <option value="real_amplitudes_like">Real amplitudes-like</option>
                    <option value="basic_entangler">Basic entangler</option>
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ansatz reps</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={parameterOverrides.ansatzReps}
                      onChange={(event) => updateOverride("ansatzReps", Number(event.target.value))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                    />
                  </label>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm text-slate-300">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Qubits</div>
                    <div className="mt-2 text-slate-100">{formatValue(parameterOverrides.nQubits)}</div>
                  </div>
                </div>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Feature-map repeats</span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={parameterOverrides.featureMapRepeats}
                    onChange={(event) => updateOverride("featureMapRepeats", Number(event.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                  />
                </label>
                <p className="text-xs leading-relaxed text-slate-500">
                  These overrides flow into planning and async execution. Qubits stay fixed to the prepared data and workbook so we do not accidentally desynchronize feature selection from the quick interface.
                </p>
                {currentVqcLimits ? (
                  <p className="text-xs leading-relaxed text-amber-200">
                    Access limits: up to {formatValue(currentVqcLimits.max_qubits)} qubits, {formatValue(currentVqcLimits.max_iterations)} iterations, {formatValue(currentVqcLimits.max_repeats)} repeats, and {formatValue(currentVqcLimits.max_runtime_minutes)} min nominal runtime.
                  </p>
                ) : null}
              </div>
            </Card>

            <Card
              title="Optimizer Parameters"
              subtitle="Lean, QAOA-style tuning controls for the parameters that most strongly affect runtime and convergence."
            >
              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Optimizer</span>
                  <select
                    value={parameterOverrides.optimizer}
                    onChange={(event) => updateOverride("optimizer", event.target.value as OptimizerOption)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                  >
                    <option value="adam">Adam</option>
                    <option value="cobyla">COBYLA</option>
                    <option value="spsa">SPSA</option>
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Iterations</span>
                    <input
                      type="number"
                      min={1}
                      max={maxLicenseIterations ?? 5000}
                      value={parameterOverrides.iterations}
                      onChange={(event) => updateOverride("iterations", Number(event.target.value))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Learning rate</span>
                    <input
                      type="number"
                      min={0.0001}
                      max={1}
                      step="0.0001"
                      value={parameterOverrides.learningRate}
                      onChange={(event) => updateOverride("learningRate", Number(event.target.value))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Repeats</span>
                    <input
                      type="number"
                      min={1}
                      max={maxLicenseRepeats ?? 20}
                      value={parameterOverrides.repeats}
                      onChange={(event) => updateOverride("repeats", Number(event.target.value))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Batch size</span>
                    <input
                      type="number"
                      min={1}
                      max={4096}
                      value={parameterOverrides.batchSize}
                      onChange={(event) => updateOverride("batchSize", Number(event.target.value))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={parameterOverrides.earlyStopping}
                      onChange={(event) => updateOverride("earlyStopping", event.target.checked)}
                      className="h-4 w-4"
                    />
                    Early stopping
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={parameterOverrides.balanceTrainingOnly}
                      onChange={(event) => updateOverride("balanceTrainingOnly", event.target.checked)}
                      className="h-4 w-4"
                    />
                    Balance train split only
                  </label>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  When enabled, the training split is undersampled to balance classes for model fitting only. Validation and test stay untouched so the benchmark remains honest.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Patience</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={parameterOverrides.patience}
                      onChange={(event) => updateOverride("patience", Number(event.target.value))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
                    />
                  </label>
                </div>
              </div>
            </Card>

            <Card
              title="Estimated Run Time"
              subtitle="Auto-refreshed after data preparation. This is the right place to sanity-check whether a heavier VQC run still fits an interactive workflow."
            >
              <div className="space-y-4">
                <InfoGrid
                  items={[
                    {
                      label: "Runtime class",
                      value: currentRuntimeEstimate?.overall_runtime_class ?? currentRuntimeEstimate?.runtime_class,
                    },
                    { label: "Nominal runtime", value: plannedTotalMinutes !== null ? `${plannedTotalMinutes.toFixed(plannedTotalMinutes < 10 ? 1 : 0)} min` : "-" },
                    { label: "Selected worker", value: currentRuntimeEstimate?.selected_worker_profile ?? parameterOverrides.workerProfile },
                    { label: "Recommended worker", value: currentRuntimeEstimate?.recommended_worker_profile },
                    { label: "Memory class", value: currentMemoryEstimate?.memory_class },
                    {
                      label: "Circuit evaluations",
                      value: currentVqcWorkload?.approximate_circuit_forward_passes,
                    },
                    { label: "Trainable parameters", value: currentCircuitEstimate?.estimated_trainable_parameters },
                    { label: "Baseline runtime", value: asRecord(planResponse?.baseline_workload_estimate)?.baseline_runtime_class },
                    { label: "Hardware mode", value: currentHardwareFeasibility?.recommended_hardware_mode },
                    { label: "Simulator backend", value: parameterOverrides.backend },
                  ]}
                />
                {currentRecommendations.length ? (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Recommendations</p>
                    <TagList values={currentRecommendations} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">The estimate appears after plan generation. For now, this page updates it automatically after prepare.</p>
                )}
              </div>
            </Card>

            <Card
              title="Execute Run"
              subtitle="Queue the remaining stages asynchronously. The backend will plan, run baselines, run VQC, and generate the report in the background."
            >
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => void executeRun()}
                  disabled={activeRequest !== null || isJobActive || (!workbookFile && !jobId.trim()) || !hasAccess}
                  className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Execute run
                </button>
                <button
                  type="button"
                  onClick={() => void cancelJob()}
                  disabled={activeRequest !== null || !isJobActive || !jobId.trim() || isCancelRequested}
                  className="w-full rounded-xl border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-950/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isCancelRequested ? "Cancel requested" : "Cancel run job"}
                </button>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                  <p>
                    Config load triggers inspect automatically. Data load triggers prepare and planning automatically. Execute run handles the async orchestration from there.
                  </p>
                  {!hasAccess ? (
                    <p className="mt-2 text-amber-200">Check license or demo first. We’re following the same access-first pattern as QAOA now.</p>
                  ) : null}
                </div>
              </div>
            </Card>

            <Card
              title="Review Files"
              subtitle="QAOA-style export and reload controls. Reload stays available before a run so you can reopen a saved VQC review snapshot at any time."
            >
              <div className="space-y-4">
                <input
                  ref={reviewJsonInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => void loadJsonDataFileFromInput(event)}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() =>
                    void downloadJobArtifact(
                      "result_report_pdf",
                      `${sanitizeDownloadStem((reportResponse?.job_id ?? jobId) || "vqc_report")}.pdf`,
                    )
                  }
                  disabled={activeRequest !== null || !reportResponse?.report_generated}
                  className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Download PDF Report
                </button>
                <button
                  type="button"
                  onClick={() => downloadJsonDataFile()}
                  disabled={!hasAnyReviewData}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Download JSON Data File
                </button>
                <button
                  type="button"
                  onClick={() => reviewJsonInputRef.current?.click()}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-500"
                >
                  Reload JSON Data File
                </button>
                <p className="text-xs leading-relaxed text-slate-500">
                  The JSON data file is self-contained for review. You can reload it later even if the original dataset object is no longer available in cloud storage.
                </p>
              </div>
            </Card>
          </aside>

          <section className="space-y-6">
            <div className="space-y-6">
              <Card
                title="Client Log"
                subtitle="Lean operator-side events from the browser workflow. This is the same kind of quick-read console rhythm the QAOA page uses."
              >
                <TextLogPanel
                  lines={clientLogLines}
                  emptyText="Client-side events will appear here as you check access, load files, queue runs, and reopen previous jobs."
                />
              </Card>

              <Card
                title="Backend Log"
                subtitle="Backend-stage events from async polling. This is the place to watch the actual VQC job move across plan, baselines, VQC, and report."
              >
                <TextLogPanel
                  lines={backendLogLines}
                  emptyText="Backend log entries appear after a job has been queued or reloaded from the backend."
                />
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card
                title="Configuration Summary"
                subtitle="The current dataset, task framing, and effective model settings flowing through the backend."
              >
                <div className="space-y-4">
                  <InfoGrid
                    items={[
                      { label: "Dataset file", value: prepareResponse?.dataset_file ?? currentDatasetSettings?.dataset_file },
                      { label: "Label column", value: prepareResponse?.label_column ?? currentDatasetSettings?.label_column },
                      {
                        label: "Classification mode",
                        value:
                          prepareResponse?.inferred_classification_mode ??
                          inspectResponse?.inferred_classification_mode ??
                          currentRunSummary?.classification_mode,
                      },
                      {
                        label: "Number of classes",
                        value:
                          currentRunSummary?.number_of_classes ??
                          vqcResponse?.number_of_classes ??
                          baselinesResponse?.number_of_classes,
                      },
                      { label: "Selected features", value: prepareResponse?.number_of_selected_features },
                      { label: "Quantum features", value: prepareResponse?.number_of_quantum_features },
                      { label: "Qubits", value: asRecord(currentEffectiveSettings?.model)?.n_qubits },
                      { label: "Feature map", value: asRecord(currentEffectiveSettings?.model)?.feature_map_type },
                      { label: "Ansatz", value: asRecord(currentEffectiveSettings?.model)?.ansatz_type },
                      { label: "Ansatz reps", value: asRecord(currentEffectiveSettings?.model)?.ansatz_reps },
                      { label: "Backend", value: asRecord(currentEffectiveSettings?.model)?.backend },
                      { label: "Worker profile", value: asRecord(currentEffectiveSettings?.execution)?.worker_profile },
                      { label: "Shots mode", value: asRecord(currentEffectiveSettings?.model)?.shots_mode },
                      {
                        label: "Mandatory baselines",
                        value: summarizeMandatoryBaselines(inspectResponse?.mandatory_baseline_status),
                      },
                      { label: "Iterations", value: asRecord(currentEffectiveSettings?.training)?.iterations },
                      { label: "Early stopping", value: asRecord(currentEffectiveSettings?.training)?.early_stopping },
                    ]}
                  />

                  <Card title="Mandatory Baseline Status">
                    <MandatoryBaselineStatusPanel status={asRecord(inspectResponse?.mandatory_baseline_status)} />
                  </Card>
                </div>
              </Card>

              <Card
                title="Warnings"
                subtitle="Warnings are deduplicated across workbook inspection, preparation, async execution, and reporting so the important caveats stay visible."
              >
                {currentWarnings.length ? (
                  <div className="space-y-3">
                    {currentWarnings.map((warning) => (
                      <div key={warning} className="rounded-xl border border-amber-900/70 bg-amber-950/30 p-3 text-sm text-amber-200">
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-900/70 bg-emerald-950/20 p-4 text-sm text-emerald-200">
                    No active warnings. This usually means the latest configuration, preparation, and async stages all agreed with each other.
                  </div>
                )}
              </Card>

              <Card
                title="Data Preparation Summary"
                subtitle="Prepared shapes, feature counts, class balance, and preprocessing choices from the current job context."
              >
                <div className="space-y-4">
                  <InfoGrid
                    items={[
                      { label: "Input rows", value: prepareResponse?.number_of_rows_input },
                      { label: "Input features", value: prepareResponse?.number_of_features_input },
                      { label: "Selected features", value: prepareResponse?.number_of_selected_features },
                      { label: "Quantum features", value: prepareResponse?.number_of_quantum_features },
                      { label: "Train rows", value: prepareResponse?.train_rows },
                      { label: "Validation rows", value: prepareResponse?.validation_rows },
                      { label: "Test rows", value: prepareResponse?.test_rows },
                      { label: "Prepared job ID", value: prepareResponse?.job_id ?? jobId },
                    ]}
                  />
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-200">Selected features</p>
                    <TagList values={prepareResponse?.selected_features ?? []} />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-200">Quantum feature names</p>
                    <TagList values={prepareResponse?.quantum_feature_names ?? []} />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-200">Prepared split distribution</p>
                    <ClassDistributionTable distribution={preparedClassDistribution} />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-200">Prepared split distribution plot</p>
                    <ClassDistributionBars distribution={preparedClassDistribution} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-200">Effective training distribution</p>
                      <span className="text-xs text-slate-500">
                        {parameterOverrides.balanceTrainingOnly
                          ? "Undersample-majority view for train only"
                          : "Mirrors prepared train split while balancing is off"}
                      </span>
                    </div>
                    <ClassDistributionTable distribution={effectiveTrainingDistribution} />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-200">Effective training distribution plot</p>
                    <ClassDistributionBars distribution={effectiveTrainingDistribution} />
                  </div>
                  <PreprocessingSummaryPanel summary={asRecord(prepareResponse?.preprocessing_summary)} />
                </div>
              </Card>

              <Card
                title="Run Plan"
                subtitle="Workload, runtime, memory, and circuit estimates automatically refreshed from the prepared dataset and current workbook settings."
              >
                <div className="space-y-4">
                  <InfoGrid
                    items={[
                      { label: "Runtime class", value: currentRuntimeEstimate?.overall_runtime_class ?? currentRuntimeEstimate?.runtime_class },
                      { label: "Memory class", value: currentMemoryEstimate?.memory_class },
                      { label: "Circuit forward passes", value: currentVqcWorkload?.approximate_circuit_forward_passes },
                      { label: "Gradient eval upper bound", value: currentVqcWorkload?.approximate_gradient_circuit_evaluations_upper_bound },
                      { label: "Trainable parameters", value: currentCircuitEstimate?.estimated_trainable_parameters },
                      { label: "Entangling layers", value: currentCircuitEstimate?.estimated_entangling_layers },
                      { label: "Two-qubit gate class", value: currentCircuitEstimate?.estimated_two_qubit_gate_class },
                      { label: "Hardware mode", value: currentHardwareFeasibility?.recommended_hardware_mode },
                    ]}
                  />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card title="Hardware Feasibility">
                      <DetailList
                        items={[
                          { label: "Training on hardware supported", value: currentHardwareFeasibility?.hardware_supported_for_training },
                          { label: "Replay supported", value: currentHardwareFeasibility?.hardware_supported_for_replay },
                          { label: "Recommended mode", value: currentHardwareFeasibility?.recommended_hardware_mode },
                          { label: "Warnings", value: currentHardwareFeasibility?.hardware_warnings },
                        ]}
                      />
                    </Card>
                    <Card title="Recommendations">
                      <TagList values={currentRecommendations} />
                    </Card>
                  </div>
                </div>
              </Card>

              <Card
                title="Baseline Results"
                subtitle="Mandatory classical baselines now arrive through the async pipeline and remain the reference frame for any VQC claim."
                className="xl:col-span-2"
              >
                <div className="space-y-5">
                  <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                    <div>
                      <p className="text-sm font-medium text-slate-100">Benchmark methods</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Each classical method is reported twice: once in strict parity mode against the VQC feature and row budget, and once as a stronger practical classical reference.
                      </p>
                    </div>
                    <BenchmarkMethodCatalogPanel specs={currentBenchmarkMethodSpecs} />
                  </div>

                  {baselineComparisonRows.length ? (
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-slate-200">Six-method classical comparison</p>
                      <GenericTable rows={baselineComparisonRows} />
                      <ComparisonBarChart
                        rows={baselineComparisonRows}
                        preferredMetricKeys={["f1_macro", "accuracy", "f1_weighted", "roc_auc_ovr", "roc_auc", "pr_auc"]}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Baseline comparison will appear after the async baseline stage completes.</p>
                  )}

                  {isRecord(asRecord(baselinesResponse?.runtime_summary)?.models) ? (
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-slate-200">Runtime comparison</p>
                      <GenericTable
                        rows={Object.entries(asRecord(asRecord(baselinesResponse?.runtime_summary)?.models) ?? {}).map(([modelName, rawValue]) => {
                          const runtime = asRecord(rawValue);
                          return {
                            method: formatLabel(modelName),
                            base_model: runtime?.base_model ? formatLabel(String(runtime.base_model)) : "-",
                            benchmark_mode: runtime?.mode ? benchmarkModeLabel(runtime.mode) : "-",
                            fit_seconds: asTableCellValue(runtime?.fit_seconds),
                            status: asTableCellValue(runtime?.status ?? "ok"),
                          };
                        })}
                      />
                    </div>
                  ) : null}

                  {baselineGroups.map(([baseModel, group]) => (
                    <div key={baseModel} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium text-slate-100">{formatLabel(baseModel)}</p>
                        <p className="text-xs text-slate-400">Test-set view, with strict parity on the left and best-reference on the right.</p>
                      </div>
                      <div className="grid gap-4 xl:grid-cols-2">
                        {[group.parity, group.bestReference].map((variant, index) => {
                          if (!variant) {
                            return (
                              <div key={`${baseModel}-${index}`} className="rounded-xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-500">
                                This benchmark variant has not been returned yet.
                              </div>
                            );
                          }
                          const spec = asRecord(currentBenchmarkMethodSpecs?.[variant.methodName]);
                          const testMetrics = asRecord(variant.bundle.test);
                          return (
                            <div key={variant.methodName} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-100">{benchmarkModeLabel(variant.bundle.mode)}</p>
                                <p className="text-xs text-slate-400">{formatValue(spec?.description ?? benchmarkModeDescription(variant.bundle.mode))}</p>
                              </div>
                              <DetailList
                                items={[
                                  { label: "Rows used", value: variant.bundle.train_rows_used },
                                  { label: "Feature count", value: variant.bundle.feature_count_used },
                                  { label: "Feature space", value: variant.bundle.feature_space },
                                  { label: "Scaling", value: variant.bundle.scaler_strategy },
                                  { label: "Class weighting", value: variant.bundle.class_weight_mode },
                                ]}
                              />
                              <MetricSummaryTable title="Test metrics" metrics={testMetrics} />
                              <ConfusionMatrixHeatmap title="Test confusion heatmap" matrix={testMetrics?.confusion_matrix} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card
                title="VQC Results"
                subtitle="Validation and test metrics, circuit summary, training trace summary, and the baseline comparison preview all come together here."
                className="xl:col-span-2"
              >
                <div className="space-y-5">
                  <div className="grid gap-4 2xl:grid-cols-2">
                    <MetricSummaryTable title="Validation metrics" metrics={asRecord(vqcResponse?.validation_metrics)} />
                    <MetricSummaryTable title="Test metrics" metrics={asRecord(vqcResponse?.test_metrics)} />
                    <ConfusionMatrixHeatmap title="Validation confusion heatmap" matrix={asRecord(vqcResponse?.validation_metrics)?.confusion_matrix} />
                    <ConfusionMatrixHeatmap title="Test confusion heatmap" matrix={asRecord(vqcResponse?.test_metrics)?.confusion_matrix} />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card title="Training History Summary">
                      <TrainingHistorySummaryPanel summary={asRecord(vqcResponse?.training_history_summary)} />
                    </Card>
                    <Card title="Circuit Summary">
                      <DetailList
                        items={[
                          { label: "Feature map", value: asRecord(vqcResponse?.circuit_summary)?.feature_map_type },
                          { label: "Feature repeats", value: asRecord(vqcResponse?.circuit_summary)?.feature_map_repeats },
                          { label: "Ansatz", value: asRecord(vqcResponse?.circuit_summary)?.ansatz_type },
                          { label: "Ansatz reps", value: asRecord(vqcResponse?.circuit_summary)?.ansatz_reps },
                          { label: "Qubits", value: asRecord(vqcResponse?.circuit_summary)?.n_qubits },
                          { label: "Backend", value: asRecord(vqcResponse?.circuit_summary)?.backend },
                          { label: "Shots mode", value: asRecord(vqcResponse?.circuit_summary)?.shots_mode },
                          { label: "Measurement", value: asRecord(vqcResponse?.circuit_summary)?.measurement },
                          { label: "Readout", value: asRecord(vqcResponse?.circuit_summary)?.readout_type },
                          {
                            label: "Quantum parameters",
                            value: asRecord(vqcResponse?.circuit_summary)?.quantum_parameter_count,
                          },
                          {
                            label: "Readout parameters",
                            value: asRecord(vqcResponse?.circuit_summary)?.readout_parameter_count,
                          },
                        ]}
                      />
                    </Card>
                  </div>

                  <Card title="Training Loss">
                    <TrainingLossChart history={Array.isArray(vqcResponse?.training_history) ? vqcResponse.training_history : []} />
                  </Card>

                  <Card title="Baseline Comparison Preview">
                    <BaselineComparisonPreviewPanel preview={asRecord(vqcResponse?.baseline_comparison_preview)} />
                  </Card>
                </div>
              </Card>

              <Card
                title="Final Report"
                subtitle="Reporting stays local for now. We surface the run summary and final seven-method comparison without flooding the page with internal storage paths."
                className="xl:col-span-2"
              >
                <div className="space-y-5">
                  <InfoGrid
                    items={[
                      { label: "Report generated", value: reportResponse?.report_generated },
                      { label: "Job ID", value: reportResponse?.job_id ?? jobId },
                      { label: "VQC complete", value: currentRunSummary?.vqc_complete },
                      { label: "Baselines complete", value: currentRunSummary?.mandatory_baselines_complete },
                    ]}
                  />
                  <RunSummaryPanel summary={currentRunSummary} />
                  {effectiveReportComparisonRows.length ? (
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-slate-200">Final seven-method comparison</p>
                      <GenericTable rows={effectiveReportComparisonRows} />
                      <ComparisonBarChart
                        rows={effectiveReportComparisonRows}
                        preferredMetricKeys={["f1_macro", "accuracy", "f1_weighted", "roc_auc_ovr", "roc_auc", "pr_auc"]}
                      />
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
