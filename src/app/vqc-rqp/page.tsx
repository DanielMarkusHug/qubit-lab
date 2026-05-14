"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_VQC_API_BASE?.trim() ||
  process.env.NEXT_PUBLIC_QAOA_RQP_API_URL?.trim() ||
  "http://localhost:8000";

const ENDPOINTS = {
  health: "/health",
  inspectWorkbook: "/inspect-workbook",
  prepareData: "/prepare-data",
  planRun: "/plan-run",
  runBaselines: "/run-baselines",
  runVqc: "/run-vqc",
  generateReport: "/generate-report",
} as const;

type PipelineStepKey = "inspect" | "prepare" | "plan" | "baselines" | "vqc" | "report";
type PipelineStepStatus = "pending" | "done" | "error";
type ArtifactPathMap = Record<string, string>;
type JsonRecord = Record<string, unknown>;
type MetricTableRow = Record<string, string | number | boolean | null | undefined>;

interface HealthResponse {
  status: string;
  app?: string;
  version?: string;
}

interface BaseApiResponse {
  status?: string;
  warnings?: string[];
  errors?: string[];
  artifact_paths?: ArtifactPathMap;
  effective_settings?: JsonRecord;
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

const INITIAL_STEPS: Record<PipelineStepKey, PipelineStepStatus> = {
  inspect: "pending",
  prepare: "pending",
  plan: "pending",
  baselines: "pending",
  vqc: "pending",
  report: "pending",
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function asRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter(Boolean);
}

function formatPercent(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return formatValue(value);
  }
  return `${(value * 100).toFixed(0)}%`;
}

function parseShape(value: unknown): { rows: number | null; columns: number | null } {
  if (!Array.isArray(value) || value.length < 2) {
    return { rows: null, columns: null };
  }
  const rows = typeof value[0] === "number" ? value[0] : Number(value[0]);
  const columns = typeof value[1] === "number" ? value[1] : Number(value[1]);
  return {
    rows: Number.isFinite(rows) ? rows : null,
    columns: Number.isFinite(columns) ? columns : null,
  };
}

function orderedKeys(record: JsonRecord, preferred: string[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  preferred.forEach((key) => {
    if (key in record) {
      seen.add(key);
      keys.push(key);
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
  const excluded = new Set([
    "confusion_matrix",
    "class_distribution",
    "per_class_precision",
    "per_class_recall",
    "per_class_f1",
    "warnings",
  ]);

  return orderedKeys(metrics, preferred)
    .filter((key) => !excluded.has(key))
    .map((key) => ({ key, value: metrics[key] }));
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

async function parseResponseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return response.json();
}

function extractErrorMessage(payload: unknown): string {
  if (isRecord(payload)) {
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
    if (isRecord(payload.detail)) {
      const errors = toStringArray(payload.detail.errors);
      const warnings = toStringArray(payload.detail.warnings);
      if (errors.length) {
        return errors.join(" | ");
      }
      if (warnings.length) {
        return warnings.join(" | ");
      }
    }
    const errors = toStringArray(payload.errors);
    if (errors.length) {
      return errors.join(" | ");
    }
  }
  return "The request failed.";
}

async function getJson<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "GET",
  });
  const payload = await parseResponseJson(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }
  return payload as T;
}

async function postMultipart<T>(endpoint: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    body: formData,
  });
  const payload = await parseResponseJson(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }
  return payload as T;
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

function StepPill({ label, status }: { label: string; status: PipelineStepStatus }) {
  const styles =
    status === "done"
      ? "border-emerald-800/70 bg-emerald-950/60 text-emerald-300"
      : status === "error"
        ? "border-rose-800/70 bg-rose-950/60 text-rose-300"
        : "border-slate-700 bg-slate-900 text-slate-300";

  return (
    <div className={`rounded-xl border px-3 py-2 ${styles}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</div>
      <div className="mt-1 text-sm">{formatLabel(status)}</div>
    </div>
  );
}

function InfoGrid({ items }: { items: Array<{ label: string; value: unknown }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
          <div className="mt-2 break-words text-sm text-slate-100">{formatValue(item.value)}</div>
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

function KeyValueBlock({ title, value }: { title: string; value: unknown }) {
  if (!isRecord(value)) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
        <div className="mt-2 text-sm text-slate-100">{formatValue(value)}</div>
      </div>
    );
  }

  const entries = Object.entries(value);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
      <div className="mt-3 space-y-2">
        {entries.length ? (
          entries.map(([key, entryValue]) => (
            <div key={key} className="flex items-start justify-between gap-4 text-sm">
              <span className="text-slate-400">{formatLabel(key)}</span>
              <span className="max-w-[60%] text-right text-slate-100">{formatValue(entryValue)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No values available.</p>
        )}
      </div>
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
        <tbody className="divide-y divide-slate-800 bg-slate-900/50">
          {rows.map((row, index) => (
            <tr key={`${index}-${String(row.model ?? row.name ?? "row")}`}>
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

function ArtifactList({ artifactPaths }: { artifactPaths: ArtifactPathMap | undefined }) {
  if (!artifactPaths || !Object.keys(artifactPaths).length) {
    return <p className="text-sm text-slate-500">No artifact paths available yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      {Object.entries(artifactPaths).map(([key, value]) => (
        <div
          key={key}
          className="grid gap-2 border-b border-slate-800 bg-slate-950/60 p-3 last:border-b-0 md:grid-cols-[170px_1fr]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{formatLabel(key)}</div>
          <div className="break-all font-mono text-xs text-cyan-200">{value}</div>
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

function MetricSummaryTable({ metrics }: { metrics: unknown }) {
  const record = asRecord(metrics);
  if (!record) {
    return <p className="text-sm text-slate-500">No metrics available yet.</p>;
  }

  const entries = metricEntries(record);
  if (!entries.length) {
    return <p className="text-sm text-slate-500">No summary metrics available.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-950/70">
          <tr>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Metric</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/50">
          {entries.map(({ key, value }) => (
            <tr key={key}>
              <td className="px-3 py-2 text-slate-300">{formatLabel(key)}</td>
              <td className="px-3 py-2 text-right text-slate-100">{formatValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfusionMatrixTable({ matrix, title }: { matrix: unknown; title: string }) {
  if (!Array.isArray(matrix) || !matrix.length || !Array.isArray(matrix[0])) {
    return null;
  }

  const matrixRows = matrix as unknown[][];
  const size = matrixRows.length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Actual \ Pred</th>
              {Array.from({ length: size }).map((_, index) => (
                <th key={index} className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {index}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {matrixRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="px-3 py-2 text-slate-300">{rowIndex}</td>
                {row.map((value, columnIndex) => (
                  <td key={columnIndex} className="px-3 py-2 text-right text-slate-100">
                    {formatValue(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClassDistributionTable({ distribution }: { distribution: unknown }) {
  const record = asRecord(distribution);
  if (!record) {
    return <p className="text-sm text-slate-500">No class distribution available yet.</p>;
  }

  const nestedKeys = ["total", "train", "validation", "test"].filter((key) => asRecord(record[key]));
  if (nestedKeys.length) {
    const rows: MetricTableRow[] = [];
    nestedKeys.forEach((split) => {
      const splitRecord = asRecord(record[split]);
      if (!splitRecord) {
        return;
      }
      Object.entries(splitRecord).forEach(([label, count]) => {
        rows.push({ split: formatLabel(split), class: label, count });
      });
    });
    return <GenericTable rows={rows} />;
  }

  const rows = Object.entries(record).map(([label, count]) => ({ class: label, count }));
  return <GenericTable rows={rows} />;
}

function PreprocessingSummaryPanel({ summary }: { summary: unknown }) {
  const record = asRecord(summary);
  if (!record) {
    return <p className="text-sm text-slate-500">No preprocessing summary available yet.</p>;
  }

  const featureResolution = asRecord(record.feature_resolution) ?? {};
  const sampling = asRecord(record.sampling) ?? {};
  const split = asRecord(record.split) ?? {};
  const balancing = asRecord(record.balancing) ?? {};
  const encoding = asRecord(record.encoding) ?? {};
  const featureSelection = asRecord(record.feature_selection) ?? {};
  const reduction = asRecord(record.quantum_feature_reduction) ?? {};
  const inputShape = parseShape(record.input_shape);
  const sampledShape = parseShape(record.sampled_shape);

  return (
    <div className="space-y-4">
      <InfoGrid
        items={[
          { label: "Dataset", value: record.dataset_name },
          { label: "Input rows", value: inputShape.rows },
          { label: "Input columns", value: inputShape.columns },
          { label: "Sampled rows", value: sampledShape.rows },
          { label: "Sampled columns", value: sampledShape.columns },
          { label: "Mode", value: record.classification_mode },
          { label: "Label classes", value: record.label_classes },
          { label: "Sampling applied", value: sampling.applied },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Features used</div>
          <div className="mt-3">
            <TagList values={asStringArray(featureResolution.feature_columns)} />
          </div>
          <div className="mt-4">
            <DetailList
              items={[
                { label: "Requested", value: asStringArray(featureResolution.requested_input_features) },
                { label: "Missing requested", value: asStringArray(featureResolution.missing_requested_features) },
                { label: "Excluded by role", value: asStringArray(featureResolution.excluded_by_role) },
                { label: "Inference fallback", value: featureResolution.used_inference },
              ]}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Split & sampling</div>
          <div className="mt-3">
            <DetailList
              items={[
                { label: "Sampling", value: sampling.applied ? `${sampling.strategy_requested ?? "applied"} (${sampling.rows_before} -> ${sampling.rows_after})` : "Not applied" },
                { label: "Split strategy", value: split.strategy_effective ?? split.strategy_requested },
                {
                  label: "Split sizes",
                  value:
                    split.train_size !== undefined || split.validation_size !== undefined || split.test_size !== undefined
                      ? `${formatPercent(split.train_size)} / ${formatPercent(split.validation_size)} / ${formatPercent(split.test_size)}`
                      : null,
                },
                { label: "Time column used", value: split.time_column_used },
                { label: "Fallback reason", value: split.fallback_reason },
              ]}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Encoding & balancing</div>
          <div className="mt-3">
            <DetailList
              items={[
                { label: "Numeric columns", value: asStringArray(encoding.numeric_columns) },
                { label: "Categorical columns", value: asStringArray(encoding.categorical_columns) },
                { label: "Numeric scaling", value: encoding.numeric_scaling },
                { label: "Categorical encoding", value: encoding.categorical_encoding },
                { label: "Missing numeric", value: encoding.missing_numeric },
                { label: "Missing categorical", value: encoding.missing_categorical },
                { label: "Balancing", value: balancing.applied ? balancing.strategy : `${balancing.strategy ?? "none"} (not applied)` },
              ]}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Feature reduction</div>
          <div className="mt-3">
            <DetailList
              items={[
                { label: "Feature selection", value: featureSelection.method },
                { label: "Selected feature count", value: featureSelection.selected_feature_count },
                { label: "Selected feature names", value: asStringArray(featureSelection.selected_feature_names) },
                { label: "Quantum reduction", value: reduction.method },
                { label: "Quantum target dim", value: reduction.target_dim },
                { label: "Quantum feature names", value: asStringArray(reduction.selected_feature_names) },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VqcClassifierPage() {
  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [datasetPath, setDatasetPath] = useState("");
  const [jobId, setJobId] = useState("");
  const [activeRequest, setActiveRequest] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState("Idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<Record<PipelineStepKey, PipelineStepStatus>>(INITIAL_STEPS);

  const [healthResponse, setHealthResponse] = useState<HealthResponse | null>(null);
  const [inspectResponse, setInspectResponse] = useState<InspectWorkbookResponse | null>(null);
  const [prepareResponse, setPrepareResponse] = useState<PrepareDataResponse | null>(null);
  const [planResponse, setPlanResponse] = useState<PlanRunResponse | null>(null);
  const [baselinesResponse, setBaselinesResponse] = useState<RunBaselinesResponse | null>(null);
  const [vqcResponse, setVqcResponse] = useState<RunVqcResponse | null>(null);
  const [reportResponse, setReportResponse] = useState<GenerateReportResponse | null>(null);

  const requestInFlight = activeRequest !== null;

  function resetPipelineFrom(step: PipelineStepKey) {
    if (step === "inspect") {
      setInspectResponse(null);
      setPrepareResponse(null);
      setPlanResponse(null);
      setBaselinesResponse(null);
      setVqcResponse(null);
      setReportResponse(null);
      setJobId("");
      setStepStatus(INITIAL_STEPS);
      return;
    }

    if (step === "prepare") {
      setPrepareResponse(null);
      setPlanResponse(null);
      setBaselinesResponse(null);
      setVqcResponse(null);
      setReportResponse(null);
      setStepStatus((previous) => ({
        ...previous,
        prepare: "pending",
        plan: "pending",
        baselines: "pending",
        vqc: "pending",
        report: "pending",
      }));
      return;
    }

    if (step === "plan") {
      setPlanResponse(null);
      setBaselinesResponse(null);
      setVqcResponse(null);
      setReportResponse(null);
      setStepStatus((previous) => ({
        ...previous,
        plan: "pending",
        baselines: "pending",
        vqc: "pending",
        report: "pending",
      }));
      return;
    }

    if (step === "baselines") {
      setBaselinesResponse(null);
      setVqcResponse(null);
      setReportResponse(null);
      setStepStatus((previous) => ({
        ...previous,
        baselines: "pending",
        vqc: "pending",
        report: "pending",
      }));
      return;
    }

    if (step === "vqc") {
      setVqcResponse(null);
      setReportResponse(null);
      setStepStatus((previous) => ({
        ...previous,
        vqc: "pending",
        report: "pending",
      }));
      return;
    }

    setReportResponse(null);
    setStepStatus((previous) => ({
      ...previous,
      report: "pending",
    }));
  }

  const effectiveSettings = useMemo<JsonRecord | undefined>(() => {
    const candidates = [
      reportResponse?.effective_settings,
      vqcResponse?.effective_settings,
      baselinesResponse?.effective_settings,
      planResponse?.effective_settings,
      prepareResponse?.effective_settings,
      inspectResponse?.effective_settings,
    ];

    return candidates.find((candidate) => isRecord(candidate)) as JsonRecord | undefined;
  }, [reportResponse, vqcResponse, baselinesResponse, planResponse, prepareResponse, inspectResponse]);

  const allWarnings = useMemo(
    () =>
      [
        inspectResponse,
        prepareResponse,
        planResponse,
        baselinesResponse,
        vqcResponse,
        reportResponse,
      ].reduce((collected, response) => mergeWarnings(collected, extractWarnings(response)), [] as string[]),
    [inspectResponse, prepareResponse, planResponse, baselinesResponse, vqcResponse, reportResponse],
  );

  async function runStep<T>(
    step: PipelineStepKey | null,
    label: string,
    action: () => Promise<T>,
    onSuccess?: (response: T) => void,
  ): Promise<void> {
    setActiveRequest(label);
    setCurrentStage(label);
    setLastError(null);

    try {
      const response = await action();
      if (step) {
        setStepStatus((previous) => ({ ...previous, [step]: "done" }));
      }
      onSuccess?.(response);
      setCurrentStage(`${label} complete`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The request failed.";
      if (step) {
        setStepStatus((previous) => ({ ...previous, [step]: "error" }));
      }
      setLastError(message);
      setCurrentStage(`${label} failed`);
    } finally {
      setActiveRequest(null);
    }
  }

  async function handleHealthCheck() {
    await runStep(null, "Check backend", () => getJson<HealthResponse>(ENDPOINTS.health), (response) => {
      setHealthResponse(response);
    });
  }

  async function handleInspectWorkbook() {
    if (!workbookFile) {
      setLastError("Please choose an Excel workbook before inspecting.");
      return;
    }

    resetPipelineFrom("inspect");
    const formData = new FormData();
    formData.append("file", workbookFile);

    await runStep("inspect", "Inspect workbook", () => postMultipart<InspectWorkbookResponse>(ENDPOINTS.inspectWorkbook, formData), (response) => {
      setInspectResponse(response);
    });
  }

  async function handlePrepareData() {
    if (!workbookFile) {
      setLastError("Please choose an Excel workbook before preparing data.");
      return;
    }

    resetPipelineFrom("prepare");
    const formData = new FormData();
    formData.append("workbook", workbookFile);
    if (datasetFile) {
      formData.append("dataset", datasetFile);
    }

    await runStep("prepare", "Prepare data", () => postMultipart<PrepareDataResponse>(ENDPOINTS.prepareData, formData), (response) => {
      setPrepareResponse(response);
      if (response.job_id) {
        setJobId(response.job_id);
      }
    });
  }

  async function handlePlanRun() {
    if (!workbookFile) {
      setLastError("Please choose an Excel workbook before planning the run.");
      return;
    }

    resetPipelineFrom("plan");
    const formData = new FormData();
    formData.append("workbook", workbookFile);
    if (jobId) {
      formData.append("job_id", jobId);
    }

    await runStep("plan", "Plan run", () => postMultipart<PlanRunResponse>(ENDPOINTS.planRun, formData), (response) => {
      setPlanResponse(response);
      if (response.job_id) {
        setJobId(response.job_id);
      }
    });
  }

  async function handleRunBaselines() {
    if (!jobId.trim()) {
      setLastError("Please prepare data first or paste an existing job ID before running baselines.");
      return;
    }

    resetPipelineFrom("baselines");
    const formData = new FormData();
    formData.append("job_id", jobId.trim());
    if (workbookFile) {
      formData.append("workbook", workbookFile);
    }

    await runStep("baselines", "Run baselines", () => postMultipart<RunBaselinesResponse>(ENDPOINTS.runBaselines, formData), (response) => {
      setBaselinesResponse(response);
    });
  }

  async function handleRunVqc() {
    if (!jobId.trim()) {
      setLastError("Please prepare data first or paste an existing job ID before running VQC.");
      return;
    }

    resetPipelineFrom("vqc");
    const formData = new FormData();
    formData.append("job_id", jobId.trim());
    if (workbookFile) {
      formData.append("workbook", workbookFile);
    }

    await runStep("vqc", "Run VQC", () => postMultipart<RunVqcResponse>(ENDPOINTS.runVqc, formData), (response) => {
      setVqcResponse(response);
    });
  }

  async function handleGenerateReport() {
    if (!jobId.trim()) {
      setLastError("Please prepare data first or paste an existing job ID before generating the report.");
      return;
    }

    resetPipelineFrom("report");
    const formData = new FormData();
    formData.append("job_id", jobId.trim());
    if (workbookFile) {
      formData.append("workbook", workbookFile);
    }

    await runStep("report", "Generate report", () => postMultipart<GenerateReportResponse>(ENDPOINTS.generateReport, formData), (response) => {
      setReportResponse(response);
    });
  }

  const configurationSummary = useMemo(() => {
    const dataset = isRecord(effectiveSettings?.dataset) ? effectiveSettings?.dataset : {};
    const model = isRecord(effectiveSettings?.model) ? effectiveSettings?.model : {};
    const baselines = isRecord(effectiveSettings?.baselines) ? effectiveSettings?.baselines : {};

    return [
      { label: "Dataset file", value: prepareResponse?.dataset_file ?? dataset.dataset_file },
      { label: "Label column", value: prepareResponse?.label_column ?? dataset.label_column },
      {
        label: "Task / mode",
        value:
          reportResponse?.run_summary && isRecord(reportResponse.run_summary)
            ? reportResponse.run_summary.classification_mode
            : prepareResponse?.inferred_classification_mode ?? inspectResponse?.inferred_classification_mode ?? dataset.task_type,
      },
      {
        label: "Number of classes",
        value:
          reportResponse?.run_summary && isRecord(reportResponse.run_summary)
            ? reportResponse.run_summary.number_of_classes
            : vqcResponse?.number_of_classes ?? baselinesResponse?.number_of_classes,
      },
      { label: "Selected features", value: prepareResponse?.number_of_selected_features },
      { label: "Quantum features", value: prepareResponse?.number_of_quantum_features ?? model.n_quantum_features },
      { label: "Qubits", value: model.n_qubits },
      { label: "Feature map", value: inspectResponse?.feature_map_type ?? model.feature_map_type },
      { label: "Ansatz", value: inspectResponse?.ansatz_type ?? model.ansatz_type },
      { label: "Ansatz reps", value: model.ansatz_reps },
      { label: "Backend", value: model.backend },
      { label: "Shots mode", value: model.shots_mode },
      {
        label: "Mandatory baselines",
        value:
          inspectResponse?.mandatory_baseline_status ??
          {
            logistic_regression: baselines.logistic_regression,
            random_forest: baselines.random_forest,
            gradient_boosting: baselines.gradient_boosting,
          },
      },
    ];
  }, [effectiveSettings, prepareResponse, inspectResponse, reportResponse, vqcResponse, baselinesResponse]);

  const highlightedArtifacts = useMemo(() => {
    const reportArtifacts = reportResponse?.artifact_paths ?? {};
    const keys = [
      "result_report",
      "run_summary",
      "final_model_comparison",
      "exported_pennylane_model",
      "exported_notebook",
      "results_readme",
    ];
    return Object.fromEntries(Object.entries(reportArtifacts).filter(([key]) => keys.includes(key)));
  }, [reportResponse]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">VQC RQP</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">VQC Classifier RQP</h1>
          <p className="mt-4 max-w-3xl text-base text-slate-300">
            Configure, prepare, benchmark, and report quantum classification workflows for labeled tabular datasets.
          </p>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">
            Excel-configured VQC experiments with mandatory classical baselines and downloadable reports.
          </p>
        </header>

        <div className="mb-8 grid gap-3 md:grid-cols-6">
          <StepPill label="Inspect" status={stepStatus.inspect} />
          <StepPill label="Prepare" status={stepStatus.prepare} />
          <StepPill label="Plan" status={stepStatus.plan} />
          <StepPill label="Baselines" status={stepStatus.baselines} />
          <StepPill label="VQC" status={stepStatus.vqc} />
          <StepPill label="Report" status={stepStatus.report} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <Card
            title="Status"
            subtitle="Keep an eye on the local backend, active run context, and the stage we are currently moving through."
            accent
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Backend health</div>
                <div className="mt-2 text-lg font-medium text-slate-100">
                  {healthResponse?.status === "ok" ? "Healthy" : "Unchecked"}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {healthResponse ? `${healthResponse.app ?? "Backend"} ${healthResponse.version ?? ""}`.trim() : "Use the check button to verify connectivity."}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current stage</div>
                <div className="mt-2 text-lg font-medium text-slate-100">{currentStage}</div>
                <div className="mt-1 text-sm text-slate-400">{requestInFlight ? "A request is in progress." : "Ready for the next step."}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">API base URL</label>
                <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 font-mono text-sm text-cyan-200">
                  {API_BASE}
                </div>
              </div>
              <button
                type="button"
                onClick={handleHealthCheck}
                disabled={requestInFlight}
                className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              >
                {activeRequest === "Check backend" ? "Checking..." : "Check backend"}
              </button>
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current job ID</label>
              <input
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                placeholder="Auto-filled after /prepare-data or paste an existing job ID"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-600"
              />
            </div>
          </Card>

          <Card
            title="Upload & Run"
            subtitle="Upload the workbook, optionally upload the dataset directly, and then drive the local pipeline step by step."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Excel workbook</label>
                <input
                  type="file"
                  accept=".xlsx,.xlsm,.xls"
                  onChange={(event) => setWorkbookFile(event.target.files?.[0] ?? null)}
                  className="mt-2 block w-full rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950 hover:file:bg-cyan-400"
                />
                <p className="mt-2 text-xs text-slate-500">{workbookFile ? workbookFile.name : "No workbook selected yet."}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dataset upload</label>
                <input
                  type="file"
                  accept=".csv,.parquet"
                  onChange={(event) => setDatasetFile(event.target.files?.[0] ?? null)}
                  className="mt-2 block w-full rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-100 hover:file:bg-slate-600"
                />
                <p className="mt-2 text-xs text-slate-500">{datasetFile ? datasetFile.name : "If omitted, the backend uses dataset_file from the workbook."}</p>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dataset path reference</label>
              <input
                value={datasetPath}
                onChange={(event) => setDatasetPath(event.target.value)}
                placeholder="Optional note, e.g. /path/to/Base.csv"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-600"
              />
              <p className="mt-2 text-xs text-slate-500">
                This field is a local reminder for now. When no dataset is uploaded, the backend still reads the dataset reference from the workbook.
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <button
                type="button"
                onClick={handleInspectWorkbook}
                disabled={requestInFlight}
                className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              >
                {activeRequest === "Inspect workbook" ? "Inspecting..." : "Inspect workbook"}
              </button>
              <button
                type="button"
                onClick={handlePrepareData}
                disabled={requestInFlight}
                className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              >
                {activeRequest === "Prepare data" ? "Preparing..." : "Prepare data"}
              </button>
              <button
                type="button"
                onClick={handlePlanRun}
                disabled={requestInFlight}
                className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-800/60 disabled:text-slate-500"
              >
                {activeRequest === "Plan run" ? "Planning..." : "Plan run"}
              </button>
              <button
                type="button"
                onClick={handleRunBaselines}
                disabled={requestInFlight}
                className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-800/60 disabled:text-slate-500"
              >
                {activeRequest === "Run baselines" ? "Running..." : "Run baselines"}
              </button>
              <button
                type="button"
                onClick={handleRunVqc}
                disabled={requestInFlight}
                className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-800/60 disabled:text-slate-500"
              >
                {activeRequest === "Run VQC" ? "Training..." : "Run VQC"}
              </button>
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={requestInFlight}
                className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-800/60 disabled:text-slate-500"
              >
                {activeRequest === "Generate report" ? "Generating..." : "Generate report"}
              </button>
            </div>

            {lastError ? (
              <div className="mt-5 rounded-xl border border-rose-900/70 bg-rose-950/50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">Last error</div>
                <div className="mt-2 text-sm text-rose-100">{lastError}</div>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card title="Configuration Summary" subtitle="Parsed and effective settings gathered from the workbook and later pipeline steps.">
            <InfoGrid items={configurationSummary} />

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Selected features</div>
                <div className="mt-3">
                  <TagList values={prepareResponse?.selected_features ?? []} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Quantum features</div>
                <div className="mt-3">
                  <TagList values={prepareResponse?.quantum_feature_names ?? []} />
                </div>
              </div>
            </div>
          </Card>

          <Card title="Warnings" subtitle="Warnings are merged across inspect, prepare, planning, baselines, VQC, and reporting so nothing gets lost.">
            {allWarnings.length ? (
              <div className="space-y-3">
                {allWarnings.map((warning, index) => (
                  <div key={`${warning}-${index}`} className="rounded-xl border border-amber-900/70 bg-amber-950/40 p-4">
                    <div className="text-sm text-amber-100">{warning}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
                No warnings yet. That usually means we have not run much of the pipeline yet, or the current configuration is clean.
              </div>
            )}
          </Card>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card title="Data Preparation Summary" subtitle="Prepared-data output from /prepare-data, including row counts, feature counts, class balance, and saved local artifacts.">
            <InfoGrid
              items={[
                { label: "Input rows", value: prepareResponse?.number_of_rows_input },
                { label: "Input features", value: prepareResponse?.number_of_features_input },
                { label: "Selected features", value: prepareResponse?.number_of_selected_features },
                { label: "Quantum features", value: prepareResponse?.number_of_quantum_features },
                { label: "Train rows", value: prepareResponse?.train_rows },
                { label: "Validation rows", value: prepareResponse?.validation_rows },
                { label: "Test rows", value: prepareResponse?.test_rows },
                { label: "Classification mode", value: prepareResponse?.inferred_classification_mode },
              ]}
            />

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Class distribution</div>
                <div className="mt-3">
                  <ClassDistributionTable distribution={prepareResponse?.class_distribution} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Preprocessing summary</div>
                <div className="mt-3">
                  <PreprocessingSummaryPanel summary={prepareResponse?.preprocessing_summary} />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Artifact paths</div>
              <ArtifactList artifactPaths={prepareResponse?.artifact_paths} />
            </div>
          </Card>

          <Card title="Run Plan" subtitle="Feasibility and workload estimates produced by /plan-run. These are especially useful before we commit to baseline or VQC execution.">
            <InfoGrid
              items={[
                { label: "Runtime class", value: planResponse?.runtime_estimate && isRecord(planResponse.runtime_estimate) ? planResponse.runtime_estimate.runtime_class : null },
                { label: "Memory class", value: planResponse?.memory_estimate && isRecord(planResponse.memory_estimate) ? planResponse.memory_estimate.memory_class : null },
                {
                  label: "Est. circuit evaluations",
                  value:
                    planResponse?.vqc_workload_estimate && isRecord(planResponse.vqc_workload_estimate)
                      ? planResponse.vqc_workload_estimate.approximate_circuit_forward_passes
                      : null,
                },
                {
                  label: "Trainable parameters",
                  value:
                    planResponse?.circuit_estimate && isRecord(planResponse.circuit_estimate)
                      ? planResponse.circuit_estimate.estimated_trainable_parameters
                      : null,
                },
                {
                  label: "Feature map",
                  value:
                    planResponse?.circuit_estimate && isRecord(planResponse.circuit_estimate)
                      ? planResponse.circuit_estimate.feature_map_type
                      : inspectResponse?.feature_map_type,
                },
                {
                  label: "Ansatz",
                  value:
                    planResponse?.circuit_estimate && isRecord(planResponse.circuit_estimate)
                      ? planResponse.circuit_estimate.ansatz_type
                      : inspectResponse?.ansatz_type,
                },
                {
                  label: "Qubits",
                  value:
                    planResponse?.circuit_estimate && isRecord(planResponse.circuit_estimate)
                      ? planResponse.circuit_estimate.n_qubits
                      : null,
                },
                {
                  label: "Baseline runtime",
                  value:
                    planResponse?.baseline_workload_estimate && isRecord(planResponse.baseline_workload_estimate)
                      ? planResponse.baseline_workload_estimate.baseline_runtime_class
                      : null,
                },
              ]}
            />

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <KeyValueBlock title="Hardware feasibility" value={planResponse?.hardware_feasibility} />
              <KeyValueBlock title="Circuit estimate" value={planResponse?.circuit_estimate} />
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Recommendations</div>
              {planResponse?.recommendations?.length ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {planResponse.recommendations.map((recommendation, index) => (
                    <li key={`${recommendation}-${index}`} className="rounded-lg bg-slate-900/70 px-3 py-2">
                      {recommendation}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No planning recommendations yet.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card title="Baseline Results" subtitle="Mandatory classical baselines. This card stays generic so it can handle both binary and multiclass metric sets without fuss.">
            {baselinesResponse?.baseline_metrics && isRecord(baselinesResponse.baseline_metrics) ? (
              <div className="space-y-4">
                {Object.entries(baselinesResponse.baseline_metrics).map(([modelName, metrics]) => {
                  const metricRecord = asRecord(metrics);
                  const validationRecord = asRecord(metricRecord?.validation);
                  const testRecord = asRecord(metricRecord?.test);

                  return (
                    <div key={modelName} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{formatLabel(modelName)}</div>
                      <div className="mt-3 grid gap-4 lg:grid-cols-2">
                        <div>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Validation</div>
                          <MetricSummaryTable metrics={validationRecord} />
                        </div>
                        <div>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Test</div>
                          <MetricSummaryTable metrics={testRecord} />
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <ConfusionMatrixTable matrix={validationRecord?.confusion_matrix} title="Validation confusion matrix" />
                        <ConfusionMatrixTable matrix={testRecord?.confusion_matrix} title="Test confusion matrix" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Run baselines to see logistic regression, random forest, and gradient boosting results here.</p>
            )}

            <div className="mt-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Model comparison</div>
              <GenericTable rows={baselinesResponse?.model_comparison ?? []} />
            </div>

            <div className="mt-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Artifact paths</div>
              <ArtifactList artifactPaths={baselinesResponse?.artifact_paths} />
            </div>
          </Card>

          <Card title="VQC Results" subtitle="Validation and test metrics from the PennyLane classifier, along with training summary, circuit summary, and any classical comparison preview already available.">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Validation metrics</div>
                <div className="mt-3">
                  <MetricSummaryTable metrics={vqcResponse?.validation_metrics} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Test metrics</div>
                <div className="mt-3">
                  <MetricSummaryTable metrics={vqcResponse?.test_metrics} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Training history summary</div>
                <div className="mt-3">
                  <DetailList
                    items={[
                      { label: "Iterations completed", value: asRecord(vqcResponse?.training_history_summary)?.iterations_completed },
                      { label: "Best iteration", value: asRecord(vqcResponse?.training_history_summary)?.best_iteration },
                      { label: "Best train loss", value: asRecord(vqcResponse?.training_history_summary)?.best_train_loss },
                      { label: "Best validation loss", value: asRecord(vqcResponse?.training_history_summary)?.best_validation_loss },
                      { label: "Best validation metric", value: asRecord(vqcResponse?.training_history_summary)?.best_validation_metric },
                      { label: "Primary metric", value: asRecord(vqcResponse?.vqc_metrics)?.primary_metric_name },
                      { label: "Primary metric (val)", value: asRecord(vqcResponse?.vqc_metrics)?.primary_metric_validation },
                      { label: "Primary metric (test)", value: asRecord(vqcResponse?.vqc_metrics)?.primary_metric_test },
                    ]}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Circuit summary</div>
                <div className="mt-3">
                  <DetailList
                    items={[
                      { label: "Feature map", value: asRecord(vqcResponse?.circuit_summary)?.feature_map_type },
                      { label: "Ansatz", value: asRecord(vqcResponse?.circuit_summary)?.ansatz_type },
                      { label: "Ansatz reps", value: asRecord(vqcResponse?.circuit_summary)?.ansatz_reps },
                      { label: "Qubits", value: asRecord(vqcResponse?.circuit_summary)?.n_qubits },
                      { label: "Backend", value: asRecord(vqcResponse?.circuit_summary)?.backend },
                      { label: "Device", value: asRecord(vqcResponse?.circuit_summary)?.device },
                      { label: "Shots mode", value: asRecord(vqcResponse?.circuit_summary)?.shots_mode },
                      { label: "Trainable parameters", value: asRecord(vqcResponse?.circuit_summary)?.trainable_parameters },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <ConfusionMatrixTable matrix={asRecord(vqcResponse?.validation_metrics)?.confusion_matrix} title="Validation confusion matrix" />
              <ConfusionMatrixTable matrix={asRecord(vqcResponse?.test_metrics)?.confusion_matrix} title="Test confusion matrix" />
            </div>

            {vqcResponse?.baseline_comparison_preview ? (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Baseline comparison preview</div>
                <div className="mt-3">
                  <KeyValueBlock title="Comparison" value={vqcResponse.baseline_comparison_preview} />
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-900/70 bg-amber-950/40 p-4 text-sm text-amber-100">
                Classical baselines have not been run for this job yet, or no comparison preview is available. Completed VQC reports still require the mandatory baselines.
              </div>
            )}

            <div className="mt-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Artifact paths</div>
              <ArtifactList artifactPaths={vqcResponse?.artifact_paths} />
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <Card
            title="Final Report"
            subtitle="Report generation stays local for now. We surface the key summary, the final model comparison, consolidated warnings, and the artifact paths you can inspect on disk."
            accent
          >
            <InfoGrid
              items={[
                { label: "Report generated", value: reportResponse?.report_generated },
                { label: "Job ID", value: reportResponse?.job_id ?? jobId },
                {
                  label: "VQC complete",
                  value: reportResponse?.run_summary && isRecord(reportResponse.run_summary) ? reportResponse.run_summary.vqc_complete : null,
                },
                {
                  label: "Baselines complete",
                  value:
                    reportResponse?.run_summary && isRecord(reportResponse.run_summary)
                      ? reportResponse.run_summary.mandatory_baselines_complete
                      : null,
                },
              ]}
            />

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <KeyValueBlock title="Run summary" value={reportResponse?.run_summary} />
              <KeyValueBlock title="Highlighted report artifacts" value={highlightedArtifacts} />
            </div>

            <div className="mt-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Final model comparison</div>
              <GenericTable rows={reportResponse?.model_comparison ?? []} />
            </div>

            <div className="mt-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">All artifact paths</div>
              <ArtifactList artifactPaths={reportResponse?.artifact_paths} />
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
