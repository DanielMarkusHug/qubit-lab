"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_VQC_API_BASE?.trim() ||
  process.env.NEXT_PUBLIC_QAOA_RQP_API_URL?.trim() ||
  "http://localhost:8000";

const ENDPOINTS = {
  health: "/health",
  licenseStatus: "/license-status",
  inspectWorkbook: "/inspect-workbook",
  prepareData: "/prepare-data",
  planRun: "/plan-run",
  executeRun: "/execute-run",
  jobs: "/jobs",
} as const;

type PipelineStepKey = "inspect" | "prepare" | "plan" | "baselines" | "vqc" | "report";
type PipelineStepStatus = "pending" | "running" | "done" | "error" | "cancelled";
type JobStatusValue = "idle" | "queued" | "running" | "completed" | "failed" | "cancelled";
type LogLevel = "info" | "success" | "warning" | "error";
type ArtifactPathMap = Record<string, string>;
type JsonRecord = Record<string, unknown>;
type TableCellValue = string | number | boolean | null | undefined;
type MetricTableRow = Record<string, TableCellValue>;
type OptimizerOption = "adam" | "cobyla" | "spsa";
type FeatureMapOption = "angle" | "zz_like" | "iqp" | "amplitude" | "basis";
type AnsatzOption = "hardware_efficient" | "custom_rx_ry_cz" | "strongly_entangling" | "real_amplitudes_like" | "basic_entangler";

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
  iterations: number;
  learningRate: number;
  repeats: number;
  batchSize: number;
  optimizer: OptimizerOption;
  earlyStopping: boolean;
  patience: number;
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

type JobListEntry = NonNullable<JobListResponse["jobs"]>[number];

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

function defaultParameterOverrides(): ParameterOverridesState {
  return {
    featureMapType: "angle",
    featureMapRepeats: 1,
    ansatzType: "hardware_efficient",
    ansatzReps: 1,
    nQubits: 4,
    iterations: 50,
    learningRate: 0.01,
    repeats: 1,
    batchSize: 32,
    optimizer: "adam",
    earlyStopping: true,
    patience: 8,
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
    iterations: Number(training?.iterations ?? defaults.iterations),
    learningRate: Number(training?.learning_rate ?? defaults.learningRate),
    repeats: Number(training?.repeats ?? defaults.repeats),
    batchSize: Number(training?.batch_size ?? defaults.batchSize),
    optimizer: (typeof training?.optimizer === "string" ? training.optimizer : defaults.optimizer) as OptimizerOption,
    earlyStopping: Boolean(training?.early_stopping ?? defaults.earlyStopping),
    patience: Number(training?.patience ?? defaults.patience),
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
    },
    training: {
      optimizer: overrides.optimizer,
      iterations: overrides.iterations,
      learning_rate: overrides.learningRate,
      repeats: overrides.repeats,
      batch_size: overrides.batchSize,
      early_stopping: overrides.earlyStopping,
      patience: overrides.patience,
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
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={[
        "rounded-2xl border p-5 shadow-sm",
        accent ? "border-cyan-900/70 bg-slate-950/80" : "border-slate-800 bg-slate-900/70",
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

function StatusBadge({ value }: { value: string | undefined | null }) {
  const normalized = (value ?? "").toLowerCase();
  const classes =
    normalized === "completed" || normalized === "done" || normalized === "ok" || normalized === "active"
      ? "border-emerald-800/70 bg-emerald-950/50 text-emerald-300"
      : normalized === "public"
        ? "border-cyan-800/70 bg-cyan-950/50 text-cyan-300"
      : normalized === "running" || normalized === "queued"
        ? "border-cyan-800/70 bg-cyan-950/50 text-cyan-300"
        : normalized === "failed" || normalized === "error"
          ? "border-rose-800/70 bg-rose-950/50 text-rose-300"
          : normalized === "cancelled"
            ? "border-amber-800/70 bg-amber-950/50 text-amber-300"
            : "border-slate-700 bg-slate-900 text-slate-300";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {formatLabel(normalized || "idle")}
    </span>
  );
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

function ArtifactList({ artifacts }: { artifacts?: ArtifactPathMap }) {
  if (!artifacts || !Object.keys(artifacts).length) {
    return <p className="text-sm text-slate-500">No artifact paths available yet.</p>;
  }
  return (
    <div className="space-y-2">
      {Object.entries(artifacts).map(([name, path]) => (
        <div key={name} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{formatLabel(name)}</div>
          <div className="mt-2 break-all font-mono text-xs text-slate-200">{path}</div>
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

function ConfusionMatrixTable({ title, matrix }: { title: string; matrix: unknown }) {
  if (!Array.isArray(matrix) || !matrix.length) {
    return null;
  }
  const rows = matrix.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      return { actual: rowIndex };
    }
    const record: MetricTableRow = { actual: rowIndex };
    row.forEach((value, columnIndex) => {
      record[`pred_${columnIndex}`] = asTableCellValue(value);
    });
    return record;
  });
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <GenericTable rows={rows} />
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
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Main Warnings">
          <TagList values={toStringArray(summary.main_warnings)} />
        </Card>
        <Card title="Report Artifacts">
          <TagList values={toStringArray(summary.artifact_list)} />
        </Card>
      </div>
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
  const [datasetPathInput, setDatasetPathInput] = useState("");
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
    setStepStatus((previous) => ({
      inspect: previous.inspect,
      prepare: "pending",
      plan: "pending",
      baselines: "pending",
      vqc: "pending",
      report: "pending",
    }));
    setDismissedReconnectJobId(null);
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

      if (options?.chainPrepare && (datasetFile || datasetPathInput.trim())) {
        await prepareData({
          workbookOverride: file,
          datasetOverride: datasetFile,
          datasetPathOverride: datasetPathInput.trim(),
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
      if (parameterOverridesDirty) {
        formData.append("config_overrides", JSON.stringify(buildConfigOverridesPayload(parameterOverrides)));
      }
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
    const datasetToUse = options?.datasetOverride ?? datasetFile;
    const datasetPathToUse = (options?.datasetPathOverride ?? datasetPathInput).trim();

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
      setLastError(message);
      pushClientLog("error", `Data preparation failed: ${message}`, "prepare");
      return null;
    } finally {
      setActiveRequest(null);
    }
  }

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
      if (parameterOverridesDirty) {
        formData.append("config_overrides", JSON.stringify(buildConfigOverridesPayload(parameterOverrides)));
      }
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

  async function cancelJob() {
    if (!jobId.trim()) {
      return;
    }
    setActiveRequest("Requesting cancel");
    setLastError(null);
    try {
      await postEmpty(`${ENDPOINTS.jobs}/${encodeURIComponent(jobId.trim())}/cancel`, apiKey);
      pushClientLog("warning", `Cancellation requested for ${jobId.trim()}.`, "vqc");
      await refreshJobState(jobId.trim(), false);
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

  function handleWorkbookChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setWorkbookFile(file);
    resetForWorkbookChange();
    pushClientLog("info", `Selected workbook snapshot: ${file.name}.`, "inspect");
    event.target.value = "";
    void inspectWorkbook(file, { chainPrepare: Boolean(datasetFile || datasetPathInput.trim()) });
  }

  function handleDatasetFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setDatasetFile(file);
    setDatasetPathInput("");
    resetForDataChange();
    pushClientLog("info", `Selected dataset snapshot: ${file.name}.`, "prepare");
    event.target.value = "";
    void prepareData({ datasetOverride: file, datasetPathOverride: "" });
  }

  async function handleDatasetPathSubmit() {
    if (!datasetPathInput.trim()) {
      return;
    }
    setDatasetFile(null);
    resetForDataChange();
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
    if (!jobId || !workbookFile || stepStatus.prepare !== "done" || !parameterOverridesDirty) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void runPlan(jobId);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [jobId, parameterOverrides, parameterOverridesDirty, runPlan, stepStatus.prepare, workbookFile]);

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
        text: `${formatIsoTimestamp(entry.timestamp)} ${entry.stage ? `[${entry.stage}] ` : ""}${entry.message ?? "Backend event"}`,
      })),
    [jobLogResponse?.log_entries],
  );

  const backendWorkbookSnapshot = useMemo(() => {
    return (
      asRecord(jobStatus?.workbook_metadata) ??
      asRecord(reportResponse?.workbook_metadata) ??
      asRecord(vqcResponse?.workbook_metadata) ??
      asRecord(planResponse?.workbook_metadata) ??
      asRecord(prepareResponse?.workbook_metadata) ??
      asRecord(inspectResponse?.workbook_metadata) ??
      null
    );
  }, [
    inspectResponse?.workbook_metadata,
    jobStatus?.workbook_metadata,
    planResponse?.workbook_metadata,
    prepareResponse?.workbook_metadata,
    reportResponse?.workbook_metadata,
    vqcResponse?.workbook_metadata,
  ]);

  const currentRuntimeEstimate = asRecord(planResponse?.runtime_estimate);
  const currentMemoryEstimate = asRecord(planResponse?.memory_estimate);
  const currentCircuitEstimate = asRecord(planResponse?.circuit_estimate);
  const currentVqcWorkload = asRecord(planResponse?.vqc_workload_estimate);
  const currentHardwareFeasibility = asRecord(planResponse?.hardware_feasibility);
  const currentRecommendations = planResponse?.recommendations ?? [];
  const currentRunSummary = asRecord(reportResponse?.run_summary);
  const currentStageLabel = jobStatus?.current_stage ?? executeResponse?.current_stage ?? activeRequest ?? "Ready";
  const currentJobStatus = jobStatus?.job_status ?? executeResponse?.job_status ?? "idle";
  const currentRuntimeTracking =
    asRecord(jobStatus?.runtime_tracking) ?? asRecord(executeResponse?.runtime_tracking) ?? null;
  const currentVqcLimits = asRecord(license?.vqc_limits) ?? null;
  const prepareArtifacts = prepareResponse?.artifact_paths;
  const reportArtifacts = reportResponse?.artifact_paths;
  const backlogJobs = jobListResponse?.jobs ?? [];
  const reconnectCandidate = useMemo(() => {
    return (
      backlogJobs.find((job) => {
        const status = (job.job_status ?? "").toLowerCase();
        return (
          job.job_id &&
          job.job_id !== dismissedReconnectJobId &&
          job.job_id !== jobId &&
          (status === "queued" || status === "running")
        );
      }) ?? null
    );
  }, [backlogJobs, dismissedReconnectJobId, jobId]);
  const currentDatasetSettings = asRecord(currentEffectiveSettings?.dataset);
  const currentStatusMessage = jobStatus?.message ?? "Ready for the next step.";
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
  const accessFeedback =
    license?.status === "active"
      ? `${license.display_name} access is active for QAOA and VQC.`
      : license?.status === "public"
        ? "Public demo access is active. Heavier VQC settings may be capped."
        : "Check access to load the VQC limits for this key.";
  const runtimeFeedback =
    currentJobStatus === "running" && currentElapsedRuntime !== null
      ? `Elapsed ${formatDurationSeconds(currentElapsedRuntime)}${currentRemainingRuntime !== null ? ` · est. remaining ${formatDurationSeconds(currentRemainingRuntime)}` : ""}${currentEstimatedTotalRuntime !== null ? ` · est. total ${formatDurationSeconds(currentEstimatedTotalRuntime)}` : ""}`
      : plannedTotalMinutes !== null
        ? `Planned nominal runtime ${plannedTotalMinutes.toFixed(plannedTotalMinutes < 10 ? 1 : 0)} min (${formatLabel(plannedRuntimeClass ?? "unknown")})${maxLicenseRuntimeMinutes !== null ? ` · access cap ${maxLicenseRuntimeMinutes} min` : ""}.`
        : "Load data and plan the run to get a backend runtime estimate.";

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
          subtitle="A tighter operator view of health, access, runtime, and the currently active async job."
          accent
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={healthResponse?.status ?? "unchecked"} />
              <StatusBadge value={license?.status ?? "access pending"} />
              <StatusBadge value={currentJobStatus} />
              <StatusBadge value={currentStageLabel} />
              {plannedRuntimeClass ? <StatusBadge value={plannedRuntimeClass} /> : null}
            </div>

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

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Feedback</p>
              <p className="mt-2 text-sm text-slate-200">{runtimeFeedback}</p>
              <p className="mt-2 text-sm text-slate-400">{accessFeedback}</p>
            </div>

            <InfoGrid
              items={[
                { label: "Current job", value: jobId || "Waiting for prepared data" },
                { label: "Workbook", value: workbookFile?.name ?? backendWorkbookSnapshot?.filename ?? "No workbook selected" },
                { label: "Current stage", value: currentStageLabel },
                { label: "Job status", value: currentJobStatus },
                { label: "Config source", value: jobStatus?.config_source ?? reportResponse?.config_source ?? prepareResponse?.config_source ?? inspectResponse?.config_source ?? "-" },
                { label: "Runtime class", value: plannedRuntimeClass },
                { label: "Elapsed", value: currentElapsedRuntime !== null ? formatDurationSeconds(currentElapsedRuntime) : "-" },
                { label: "Remaining", value: currentRemainingRuntime !== null ? formatDurationSeconds(currentRemainingRuntime) : "-" },
              ]}
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void checkBackend()}
                disabled={activeRequest !== null}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Check backend
              </button>
              {activeRequest ? <span className="self-center text-sm text-slate-400">{activeRequest}…</span> : null}
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
                    type="file"
                    accept=".xlsx,.xlsm,.xls"
                    onChange={handleWorkbookChange}
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-950 hover:file:bg-cyan-400"
                  />
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
                    type="file"
                    accept=".csv,.parquet"
                    onChange={handleDatasetFileChange}
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-950 hover:file:bg-cyan-400"
                  />
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
                  {datasetFile ? (
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
                    { label: "Memory class", value: currentMemoryEstimate?.memory_class },
                    {
                      label: "Circuit evaluations",
                      value: currentVqcWorkload?.approximate_circuit_forward_passes,
                    },
                    { label: "Trainable parameters", value: currentCircuitEstimate?.estimated_trainable_parameters },
                    { label: "Baseline runtime", value: asRecord(planResponse?.baseline_workload_estimate)?.baseline_runtime_class },
                    { label: "Hardware mode", value: currentHardwareFeasibility?.recommended_hardware_mode },
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
                  disabled={activeRequest !== null || isJobActive || !workbookFile || !hasAccess}
                  className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Execute run
                </button>
                <button
                  type="button"
                  onClick={() => void cancelJob()}
                  disabled={activeRequest !== null || !isJobActive || !jobId.trim()}
                  className="w-full rounded-xl border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-950/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Cancel job
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
          </aside>

          <section className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
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

            <div className="grid gap-6 2xl:grid-cols-2">
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
                    <p className="text-sm font-medium text-slate-200">Class distribution</p>
                    <ClassDistributionTable distribution={asRecord(prepareResponse?.class_distribution)} />
                  </div>
                  <PreprocessingSummaryPanel summary={asRecord(prepareResponse?.preprocessing_summary)} />
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-200">Artifact paths</p>
                    <ArtifactList artifacts={prepareArtifacts} />
                  </div>
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
                  <ArtifactList artifacts={planResponse?.artifact_paths} />
                </div>
              </Card>

              <Card
                title="Baseline Results"
                subtitle="Mandatory classical baselines now arrive through the async pipeline and remain the reference frame for any VQC claim."
              >
                <div className="space-y-5">
                  {Array.isArray(baselinesResponse?.model_comparison) && baselinesResponse?.model_comparison.length ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-200">Model comparison</p>
                      <GenericTable rows={baselinesResponse.model_comparison} />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Baseline comparison will appear after the async baseline stage completes.</p>
                  )}

                  {Object.entries(asRecord(baselinesResponse?.baseline_metrics) ?? {}).map(([modelName, rawBundle]) => {
                    const bundle = asRecord(rawBundle);
                    const validationMetrics = asRecord(bundle?.validation);
                    const testMetrics = asRecord(bundle?.test);
                    return (
                      <div key={modelName} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <p className="text-sm font-medium text-slate-100">{formatLabel(modelName)}</p>
                        <div className="grid gap-4 xl:grid-cols-2">
                          <MetricSummaryTable title="Validation metrics" metrics={validationMetrics} />
                          <MetricSummaryTable title="Test metrics" metrics={testMetrics} />
                          <ConfusionMatrixTable title="Validation confusion matrix" matrix={validationMetrics?.confusion_matrix} />
                          <ConfusionMatrixTable title="Test confusion matrix" matrix={testMetrics?.confusion_matrix} />
                        </div>
                      </div>
                    );
                  })}

                  <ArtifactList artifacts={baselinesResponse?.artifact_paths} />
                </div>
              </Card>

              <Card
                title="VQC Results"
                subtitle="Validation and test metrics, circuit summary, training trace summary, and the baseline comparison preview all come together here."
              >
                <div className="space-y-5">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <MetricSummaryTable title="Validation metrics" metrics={asRecord(vqcResponse?.validation_metrics)} />
                    <MetricSummaryTable title="Test metrics" metrics={asRecord(vqcResponse?.test_metrics)} />
                    <ConfusionMatrixTable title="Validation confusion matrix" matrix={asRecord(vqcResponse?.validation_metrics)?.confusion_matrix} />
                    <ConfusionMatrixTable title="Test confusion matrix" matrix={asRecord(vqcResponse?.test_metrics)?.confusion_matrix} />
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

                  <Card title="Baseline Comparison Preview">
                    <BaselineComparisonPreviewPanel preview={asRecord(vqcResponse?.baseline_comparison_preview)} />
                  </Card>

                  <ArtifactList artifacts={vqcResponse?.artifact_paths} />
                </div>
              </Card>

              <Card
                title="Final Report"
                subtitle="Reporting stays local for now. We surface the run summary, final model comparison, and the artifact paths the backend generated."
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
                  {Array.isArray(reportResponse?.model_comparison) && reportResponse?.model_comparison.length ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-200">Final model comparison</p>
                      <GenericTable rows={reportResponse.model_comparison} />
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-200">Artifact paths</p>
                    <ArtifactList artifacts={reportArtifacts} />
                  </div>
                </div>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
