"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";

type LimitBlock = {
  max_qubits?: number;
  max_layers?: number;
  max_iterations?: number;
  max_restarts?: number;
  max_upload_mb?: number;
  max_estimated_runtime_sec?: number;
};

type EffectiveSettings = {
  response_level?: string | null;
  layers?: number | null;
  p?: number | null;
  iterations?: number | null;
  restarts?: number | null;
  warm_start?: boolean | null;
  qaoa_shots?: number | null;
  qaoa_shots_display?: string | number | null;
  shots_mode?: string | null;
  lambda_budget?: number | null;
  budget_lambda?: number | null;
  lambda_variance?: number | null;
  risk_lambda?: number | null;
  variance_lambda?: number | null;
  risk_free_rate?: number | null;
  restart_perturbation?: number | null;
  random_seed?: number | null;
};

type AdditionalTypeConstraint = Record<string, unknown> & {
  id?: string;
  name?: string;
  label?: string;
  size_column?: string;
  budget?: number;
  target?: number;
  raw_budget_target?: number;
  penalty?: number;
  penalty_weight?: number;
  active?: boolean;
  status?: string;
};

type AdditionalTypeAchievement = Record<string, unknown> & {
  id?: string;
  name?: string;
  label?: string;
  budget?: number;
  target?: number;
  raw_budget_target?: number;
  achieved?: number;
  achieved_raw_amount?: number;
  achieved_normalized?: number;
  achieved_normalized_amount?: number;
  deviation?: number;
  raw_deviation?: number;
  relative_deviation?: number;
  penalty?: number;
  penalty_contribution?: number;
};

type Diagnostics = Record<string, unknown> & {
  logs?: string[];
  effective_settings?: EffectiveSettings;
  runtime_inputs?: Record<string, unknown>;
  circuit?: Record<string, unknown>;

  raw_estimated_runtime_sec?: number;
  estimated_runtime_sec?: number;
  eta_seconds_low?: number;
  eta_seconds_high?: number;
  actual_runtime_sec?: number;
  runtime_ratio?: number;
  random_seed?: number | null;

  usage_level?: string;
  service?: string;
  n_qubits?: number;
  binary_variables?: number;
  qubo_shape?: number[];
  qubo_nonzero_entries?: number;
  classical_candidate_count?: number;
  assets_referenced_by_options?: number;
  budget_usd?: number;
  fixed_options?: number;
  variable_options?: number;

  workbook_warnings?: string[];
  workbook_warning_count?: number;

  classical_export_requested_rows?: number;
  classical_export_actual_rows?: number;
  classical_export_cap_applied?: boolean;
  classical_export_cap_reason?: string | null;

  qaoa_export_requested_rows?: number;
  qaoa_export_actual_rows?: number;
  qaoa_export_cap_applied?: boolean;
  qaoa_export_cap_reason?: string | null;

  qaoa_exact_state_space?: number;
  qaoa_exact_states_evaluated?: number;
  qaoa_exact_states_exported?: number;

  additional_type_constraints?: AdditionalTypeConstraint[];
  additional_type_constraints_count?: number;
  additional_type_budget_achievements?: AdditionalTypeAchievement[];
};

type LicenseStatus = {
  authenticated: boolean;
  key_id?: string;
  name?: string;
  email?: string;
  organization?: string;
  display_name?: string;
  usage_level?: string;
  status?: string;
  expires_at?: string;
  max_runs?: number;
  used_runs?: number;
  remaining_runs?: number;
  max_estimated_runtime_sec?: number;
  allowed_modes?: string[];
  allowed_response_levels?: string[];
  general_limits?: LimitBlock;
  qaoa_limited_limits?: LimitBlock;
  limits?: LimitBlock & {
    qaoa_limited?: LimitBlock;
  };
};

type CandidateRow = Record<string, unknown>;

type ReportingSummaryBlock = {
  available?: boolean;
  title?: string;
  status?: string;
  source?: string;
  future_source?: string;
  solver?: string | null;
  best_bitstring?: string | null;
  objective?: number | null;
  qubo_value?: number | null;
  selected_usd?: number | null;
  budget_gap?: number | null;
  abs_budget_gap?: number | null;
  portfolio_return?: number | null;
  portfolio_vol?: number | null;
  sharpe_like?: number | null;
  cash_weight?: number | null;
  probability?: number | null;
  return_term?: number | null;
  risk_term?: number | null;
  budget_term?: number | null;
  type_budget_term?: number | null;
  additional_type_budget_penalty?: number | null;
};

type Reporting = {
  summary?: {
    classical_result_summary?: ReportingSummaryBlock;
    quantum_result_summary?: ReportingSummaryBlock;

    currency_code?: string;
    decision_variables?: number;
    decision_state_space?: string;
    fixed_asset_blocks?: number;
    variable_asset_blocks?: number;
    unique_tickers?: number;
    fixed_invested_usd?: number;
    variable_candidate_usd_universe?: number;
    top_n_exported?: number;

    classical_candidate_count?: number;
    qaoa_candidate_count?: number;
    qaoa_enabled?: boolean;
    qaoa_available?: boolean;
    qaoa_status?: string;
    qaoa_mode?: string;
    qaoa_p?: number;

    budget_lambda?: number;
    risk_lambda?: number;
    risk_free_rate?: number;

    best_overview_sharpe_like?: number;
    best_overview_invested_usd?: number;
    best_overview_abs_budget_gap?: number;
    best_overview_return_term?: number;
    best_overview_risk_term?: number;
    best_overview_budget_term?: number;
    best_overview_type_budget_term?: number;
    best_overview_cash_weight?: number;
    optimization_iterations?: number;
  };
  classical_candidates?: CandidateRow[];
  quantum_samples?: CandidateRow[];
  qaoa_best_qubo?: CandidateRow[];
  solver_comparison?: CandidateRow[];
  portfolio_contents?: CandidateRow[];
  optimization_history?: CandidateRow[];
  circuit?: Record<string, unknown>;
  charts?: {
    risk_return_sharpe?: string | null;
    risk_return_qubo?: string | null;
    qubo_breakdown?: string | null;
    qubo_breakdown_classical?: string | null;
    qubo_breakdown_quantum?: string | null;
    optimization_history?: string | null;
    circuit_overview?: string | null;
    solver_comparison?: string | null;
    [key: string]: string | null | undefined;
  };
};

type RunResult = {
  status?: string;
  mode?: string;
  model_version?: string;
  solver?: string;
  best_bitstring?: string;
  binary_variables?: number;
  objective?: number;
  qubo_value?: number;
  selected_usd?: number;
  budget_gap?: number;
  run_id?: string;
  license?: LicenseStatus;
  diagnostics?: Diagnostics;
  components?: Record<string, unknown>;
  best_candidate?: Record<string, unknown>;
  top_candidates?: CandidateRow[];
  reporting?: Reporting;
  portfolio_metrics?: {
    portfolio_return?: number;
    portfolio_vol?: number;
    sharpe_like?: number;
    num_options?: number;
    num_distinct_assets?: number;
    num_fixed_options?: number;
    num_variable_options?: number;
    cash_weight?: number;
    fixed_usd?: number;
    variable_selected_usd?: number;
    max_position_usd?: number;
    portfolio_return_budget_normalized?: number;
    portfolio_vol_budget_normalized?: number;
    sharpe_like_budget_normalized?: number;
  };
  selected_blocks?: Array<Record<string, unknown>>;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

type InspectWorkbookSummary = {
  decision_variables?: number;
  n_qubits?: number;
  decision_state_space?: string;
  fixed_asset_blocks?: number;
  variable_asset_blocks?: number;
  unique_tickers?: number;
  budget?: number;
  currency_code?: string;
  fixed_invested_amount?: number;
  variable_candidate_universe?: number;
  qubo_shape?: number[];
  assets_referenced_by_options?: number;
  settings_count?: number;
  additional_type_constraints?: AdditionalTypeConstraint[];
  additional_type_constraints_count?: number;
};

type RuntimeEstimate = {
  mode?: string;
  raw_estimated_runtime_sec?: number;
  estimated_runtime_sec?: number;
  eta_seconds_low?: number;
  eta_seconds_high?: number;
  max_estimated_runtime_sec?: number;
  within_limit?: boolean;
  limit_source?: string;
  basis?: {
    n_qubits?: number;
    layers?: number;
    iterations?: number;
    restarts?: number;
    warm_start?: boolean;
    random_seed?: number | null;
  };
};

type InspectResult = {
  status?: string;
  filename?: string;
  model_version?: string;
  license?: LicenseStatus;
  workbook_summary?: InspectWorkbookSummary;
  runtime_estimate?: RuntimeEstimate;
  diagnostics?: Diagnostics;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

type JobProgress = {
  progress_pct?: number | null;
  iteration?: number | null;
  max_iterations?: number | null;
  elapsed_seconds?: number | null;
  eta_seconds_low?: number | null;
  eta_seconds_high?: number | null;
};

type JobStatus = {
  job_id?: string;
  status?: "queued" | "running" | "completed" | "failed" | "cancelled" | string;
  phase?: string | null;
  progress?: JobProgress | null;
  latest_log?: string | null;
  logs_tail?: string[];
  created_at?: string | null;
  started_at?: string | null;
  heartbeat_at?: string | null;
  finished_at?: string | null;
  result_available?: boolean;
  result?: {
    available?: boolean;
    storage_path?: string | null;
    summary?: Record<string, unknown> | null;
  };
  error?: {
    code?: string;
    type?: string;
    message?: string;
    traceback_tail?: string;
    details?: Record<string, unknown>;
  } | null;
  license?: LicenseStatus;
};

type AsyncSubmitResponse = {
  ok?: boolean;
  status?: string;
  job_id?: string;
  status_url?: string;
  result_url?: string;
  license?: LicenseStatus;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

type SavedQaoaSnapshot = {
  schema: "qaoa-rqp-review-snapshot";
  schema_version: 1;
  saved_at: string;
  frontend: {
    page: "qaoa-rqp-v9";
    api_url: string;
  };
  original_filename?: string | null;
  ui_state: {
    mode: string;
    response_level: string;
    layers: number;
    iterations: number;
    restarts: number;
    warm_start: boolean;
    budget_lambda: number;
    risk_lambda: number;
    risk_free_rate: number;
    qaoa_shots: number;
    restart_perturbation: number;
    random_seed?: number | "";
  };
  license?: LicenseStatus | null;
  inspect_result?: InspectResult | null;
  result?: RunResult | null;
  job_status?: JobStatus | null;
  active_job_id?: string | null;
  backend_job_logs?: string[];
  client_logs?: string[];
};

type RawJsonDataDownload = {
  schema: "qaoa-rqp-v9-raw-json-data";
  schema_version: 1;
  downloaded_at: string;
  frontend: {
    page: "qaoa-rqp-v9";
    api_url: string;
  };
  original_filename?: string | null;
  inspect_result?: InspectResult | null;
  result?: RunResult | null;
  job_status?: JobStatus | null;
};

const API_URL =
  process.env.NEXT_PUBLIC_QAOA_RQP_V9_API_URL ??
  "https://qaoa-rqp-api-v9-fxkphe6o4a-oa.a.run.app";

const USER_GUIDE_URL = "/qaoa-rqp/QAOA_RQP_Quick_User_Guide.pdf";

const DEMO_EXCEL_7_URL = "/qaoa-rqp/QuantumPortfolioOptimizer_demo_7.xlsx";
const DEMO_EXCEL_16_URL = "/qaoa-rqp/QuantumPortfolioOptimizer_demo_16.xlsx";
const DEMO_EXCEL_24_URL = "/qaoa-rqp/QuantumPortfolioOptimizer_demo_24.xlsx";

const REVIEW_FILE_24_URL =
  "/qaoa-rqp/qaoa-rqp-review_QuantumPortfolioOptimizer_demo_24_qaoa_limited_20260504-065225.json";

const ACTIVE_JOB_STORAGE_KEY = "qaoa-rqp-v9-active-job-id";
const TYPE_IDS = ["type_a", "type_b", "type_c", "type_d", "type_e"];

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && !Number.isNaN(value) ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function formatNumber(value: unknown, digits = 3) {
  const number = getNumber(value);
  if (number === undefined) return "n/a";
  return number.toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

function formatProbability(value: unknown) {
  const number = getNumber(value);
  if (number === undefined) return "n/a";
  if (number === 0) return "0";
  if (Math.abs(number) < 0.000001) return number.toExponential(6);

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10,
  });
}

function formatCurrency(value: unknown, currencyCode = "USD") {
  void currencyCode;

  const number = getNumber(value);
  if (number === undefined) return "n/a";

  return number.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: unknown, digits = 2) {
  const number = getNumber(value);
  if (number === undefined) return "n/a";
  return `${(number * 100).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  })}%`;
}

function formatText(value: unknown, fallback = "n/a") {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatQuboShape(value: unknown) {
  if (Array.isArray(value)) return value.join(" × ");
  return formatText(value);
}

function formatRuntimeInputs(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "n/a";
  const record = value as Record<string, unknown>;
  const layers = record.layers ?? record.p;
  const iterations = record.iterations;
  const restarts = record.restarts;
  const randomSeed = record.random_seed;

  const parts = [
    layers !== undefined ? `layers=${layers}` : null,
    iterations !== undefined ? `iterations=${iterations}` : null,
    restarts !== undefined ? `restarts=${restarts}` : null,
    randomSeed !== undefined && randomSeed !== null ? `random_seed=${randomSeed}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "n/a";
}

function formatSeconds(value: unknown) {
  const number = getNumber(value);
  if (number === undefined) return "n/a";

  if (number < 60) return `${Math.round(number)} sec`;
  if (number < 3600) return `${Math.round(number / 60)} min`;

  const hours = number / 3600;
  return `${hours.toLocaleString("en-US", { maximumFractionDigits: 1 })} h`;
}

function formatEtaRange(low?: number | null, high?: number | null) {
  if (low === null || low === undefined) return "n/a";

  const safeLow = Math.max(0, low);
  const safeHigh =
    high === null || high === undefined ? safeLow * 1.4 : Math.max(safeLow, high);

  if (safeHigh < 60) return "less than 1 minute";

  const lowMin = Math.max(1, Math.round(safeLow / 60));
  const highMin = Math.max(lowMin, Math.round(safeHigh / 60));

  if (lowMin === highMin) return `approx. ${lowMin} min`;
  return `approx. ${lowMin}-${highMin} min`;
}

function formatLimitBlock(limits?: LimitBlock) {
  if (!limits) return "n/a";

  const parts = [
    limits.max_qubits !== undefined ? `${limits.max_qubits} qubits` : null,
    limits.max_layers !== undefined ? `${limits.max_layers} layers` : null,
    limits.max_iterations !== undefined
      ? `${limits.max_iterations} iterations`
      : null,
    limits.max_restarts !== undefined ? `${limits.max_restarts} restarts` : null,
    limits.max_upload_mb !== undefined ? `${limits.max_upload_mb} MB upload` : null,
    limits.max_estimated_runtime_sec !== undefined
      ? `${formatSeconds(limits.max_estimated_runtime_sec)} runtime`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "n/a";
}

function safeFileStem(name?: string | null) {
  const stem = (name ?? "no-workbook").replace(/\.[^/.]+$/, "");

  return (
    stem
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "no-workbook"
  );
}

function timestampForFilename() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    "-",
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join("");
}

function reviewFilename(workbookName: string | null, mode: string) {
  return `qaoa-rqp-v9-review_${safeFileStem(workbookName)}_${mode}_${timestampForFilename()}.json`;
}

function rawJsonFilename(workbookName: string | null) {
  return `qaoa-rqp-v9-raw-json_${safeFileStem(workbookName)}_${timestampForFilename()}.json`;
}

function getGeneralLimits(license?: LicenseStatus | null): LimitBlock | undefined {
  return license?.general_limits ?? license?.limits;
}

function getQaoaLimitedLimits(license?: LicenseStatus | null): LimitBlock | undefined {
  return license?.qaoa_limited_limits ?? license?.limits?.qaoa_limited;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) =>
    String(item).replaceAll("Refresh with yfinance", "Refresh of Data")
  );
}

function getCircuitValue(circuit: unknown, key: string) {
  if (!circuit || typeof circuit !== "object" || Array.isArray(circuit)) {
    return undefined;
  }

  return (circuit as Record<string, unknown>)[key];
}

function getRecordValue(record: unknown, key: string) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return undefined;
  }
  return (record as Record<string, unknown>)[key];
}

function getEffectiveSetting(diagnostics: Diagnostics | undefined, key: string) {
  return getRecordValue(diagnostics?.effective_settings, key);
}

function getEffectiveRandomSeed(...sources: Array<Diagnostics | undefined>) {
  for (const diagnostics of sources) {
    const direct = getNumber(diagnostics?.random_seed);
    if (direct !== undefined) return direct;

    const effective = getNumber(getEffectiveSetting(diagnostics, "random_seed"));
    if (effective !== undefined) return effective;

    const runtime = getRecordValue(diagnostics?.runtime_inputs, "random_seed");
    const runtimeNumber = getNumber(runtime);
    if (runtimeNumber !== undefined) return runtimeNumber;
  }

  return undefined;
}

function getShotsMode(...sources: Array<Diagnostics | undefined>) {
  for (const diagnostics of sources) {
    const effectiveShotsMode = formatText(
      getEffectiveSetting(diagnostics, "shots_mode"),
      ""
    );
    if (effectiveShotsMode) return effectiveShotsMode;

    const circuit = diagnostics?.circuit;
    const circuitShotsMode = formatText(getCircuitValue(circuit, "shots_mode"), "");
    if (circuitShotsMode) return circuitShotsMode;
  }

  return "";
}

function getQaoaShotsDisplay(...sources: Array<Diagnostics | undefined>) {
  for (const diagnostics of sources) {
    const display = getEffectiveSetting(diagnostics, "qaoa_shots_display");
    if (display !== undefined && display !== null && display !== "") {
      return String(display);
    }

    const shotsMode = getShotsMode(diagnostics);
    if (shotsMode === "exact") return "exact";

    const shots = getEffectiveSetting(diagnostics, "qaoa_shots");
    if (shots !== undefined && shots !== null) return String(shots);
  }

  return "";
}

function getRuntimeEstimateFromInspect(result?: InspectResult | null): RuntimeEstimate | undefined {
  if (!result) return undefined;
  if (result.runtime_estimate) return result.runtime_estimate;

  const details = result.error?.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }

  const estimate = (details as Record<string, unknown>).runtime_estimate;
  if (!estimate || typeof estimate !== "object" || Array.isArray(estimate)) {
    return undefined;
  }

  return estimate as RuntimeEstimate;
}

function getDiagnosticsFromInspect(result?: InspectResult | null): Diagnostics {
  if (!result) return {};
  if (result.diagnostics) return result.diagnostics;

  const details = result.error?.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return {};
  }

  const diagnostics = (details as Record<string, unknown>).diagnostics;
  if (!diagnostics || typeof diagnostics !== "object" || Array.isArray(diagnostics)) {
    return {};
  }

  return diagnostics as Diagnostics;
}

function getPortfolioCost(row: CandidateRow) {
  return row["Indicative Market Cost USD"] ?? row["Approx Cost USD"];
}

function uniquePortfolioRows(rows: CandidateRow[]) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const key = [
      row.decision_id,
      row.Ticker,
      row.Company,
      row.decision_role,
      row["Option Label"],
      getPortfolioCost(row),
      row.Shares,
      row.variable_bit_index,
    ]
      .map((value) => formatText(value, ""))
      .join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeBitstring(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function getVariableBitIndex(row: CandidateRow) {
  const direct = getNumber(row.variable_bit_index);
  if (direct !== undefined) return direct;

  const textValue = row.variable_bit_index;
  if (typeof textValue === "string") {
    const parsed = Number(textValue);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return undefined;
}

function buildPortfolioFromBitstring(rows: CandidateRow[], bitstringValue?: string | null) {
  const bitstring = normalizeBitstring(bitstringValue);
  if (!bitstring) return [];

  return uniquePortfolioRows(rows).filter((row) => {
    const role = String(row.decision_role ?? "").toLowerCase();

    if (role === "fixed") return true;

    const bitIndex = getVariableBitIndex(row);
    if (bitIndex === undefined) return false;

    return bitstring[bitIndex] === "1";
  });
}

function estimateRuntimeSeconds({
  mode,
  qubits,
  layers,
  iterations,
  restarts,
  warmStart,
  runtimeCap,
}: {
  mode: string;
  qubits?: number;
  layers: number;
  iterations: number;
  restarts: number;
  warmStart: boolean;
  runtimeCap?: number;
}) {
  if (mode === "classical_only") {
    const base = qubits !== undefined ? Math.max(2, qubits * 0.25) : 5;
    return Math.min(base, runtimeCap ?? 60);
  }

  if (mode === "qaoa_full") return undefined;

  const q = qubits ?? 10;
  const qubitFactor = Math.pow(2, Math.max(q - 7, 0) / 2.2);
  const layerFactor = Math.max(layers, 1);
  const iterationFactor = Math.max(iterations, 1) / 30;
  const restartFactor = Math.max(restarts, 1);
  const warmStartFactor = warmStart ? 1.15 : 1.0;

  const estimate =
    8 * qubitFactor * layerFactor * iterationFactor * restartFactor * warmStartFactor;

  if (runtimeCap !== undefined) return Math.min(Math.max(estimate, 3), runtimeCap);
  return Math.max(estimate, 3);
}

function metricValueClass(kind: "number" | "text", subtle: boolean) {
  if (kind === "text") {
    return `text-sm font-semibold leading-snug break-words ${
      subtle ? "text-gray-300" : "text-cyan-100"
    }`;
  }

  return `text-xl font-bold leading-tight break-words ${
    subtle ? "text-gray-300" : "text-cyan-200"
  }`;
}

function getTypeConstraintLabel(constraint: AdditionalTypeConstraint) {
  return (
    formatText(constraint.label, "") ||
    formatText(constraint.name, "") ||
    formatText(constraint.id, "Type")
  );
}

function getTypeConstraintBudget(constraint: AdditionalTypeConstraint) {
  return (
    constraint.raw_budget_target ??
    constraint.budget ??
    constraint.target ??
    getNumber(constraint["budget_target"])
  );
}

function getTypeConstraintPenalty(constraint: AdditionalTypeConstraint) {
  return (
    constraint.penalty_weight ??
    constraint.penalty ??
    getNumber(constraint["lambda"]) ??
    getNumber(constraint["budget_penalty"])
  );
}

function getAchievementLabel(achievement: AdditionalTypeAchievement) {
  return (
    formatText(achievement.label, "") ||
    formatText(achievement.name, "") ||
    formatText(achievement.id, "Type")
  );
}

function getAchievementBudget(achievement: AdditionalTypeAchievement) {
  return (
    achievement.raw_budget_target ??
    achievement.budget ??
    achievement.target ??
    getNumber(achievement["budget_target"]) ??
    getNumber(achievement["raw_budget"]) ??
    getNumber(achievement["target_budget"])
  );
}

function getAchievementNormalized(achievement: AdditionalTypeAchievement) {
  return (
    achievement.achieved_normalized_amount ??
    achievement.achieved_normalized ??
    getNumber(achievement["normalized_achieved"]) ??
    getNumber(achievement["normalized_amount"]) ??
    getNumber(achievement["achieved_normalized_value"])
  );
}

function getAchievementDeviation(achievement: AdditionalTypeAchievement) {
  const direct =
    achievement.raw_deviation ??
    achievement.deviation ??
    getNumber(achievement["budget_deviation"]) ??
    getNumber(achievement["raw_budget_deviation"]);

  if (direct !== undefined) return direct;

  const budget = getAchievementBudget(achievement);
  const normalized = getAchievementNormalized(achievement);

  if (budget !== undefined && normalized !== undefined) {
    return budget * normalized - budget;
  }

  return undefined;
}

function getAchievementRelativeDeviation(achievement: AdditionalTypeAchievement) {
  const direct =
    achievement.relative_deviation ??
    getNumber(achievement["relative_budget_deviation"]) ??
    getNumber(achievement["relative_deviation_pct"]);

  if (direct !== undefined) return direct;

  const normalized = getAchievementNormalized(achievement);
  if (normalized !== undefined) return normalized - 1;

  const budget = getAchievementBudget(achievement);
  const deviation = getAchievementDeviation(achievement);

  if (budget !== undefined && budget !== 0 && deviation !== undefined) {
    return deviation / budget;
  }

  return undefined;
}

function getAchievementAchieved(achievement: AdditionalTypeAchievement) {
  const direct =
    achievement.achieved_raw_amount ??
    achievement.achieved ??
    getNumber(achievement["raw_achieved"]) ??
    getNumber(achievement["amount"]) ??
    getNumber(achievement["raw_amount"]) ??
    getNumber(achievement["achieved_amount"]) ??
    getNumber(achievement["achieved_budget"]) ??
    getNumber(achievement["achieved_value"]);

  if (direct !== undefined) return direct;

  const budget = getAchievementBudget(achievement);
  const normalized = getAchievementNormalized(achievement);

  if (budget !== undefined && normalized !== undefined) {
    return budget * normalized;
  }

  const deviation = getAchievementDeviation(achievement);

  if (budget !== undefined && deviation !== undefined) {
    return budget + deviation;
  }

  return undefined;
}

function getConstraintForAchievement(
  achievement: AdditionalTypeAchievement,
  constraints: AdditionalTypeConstraint[]
) {
  const achievementId = formatText(achievement.id, "");

  if (achievementId) {
    const byId = constraints.find(
      (constraint) => formatText(constraint.id, "") === achievementId
    );
    if (byId) return byId;
  }

  const achievementLabel = getAchievementLabel(achievement);

  return constraints.find(
    (constraint) => getTypeConstraintLabel(constraint) === achievementLabel
  );
}

function getAchievementPenalty(
  achievement: AdditionalTypeAchievement,
  constraints: AdditionalTypeConstraint[] = []
) {
  const direct =
    achievement.penalty_contribution ??
    achievement.penalty ??
    getNumber(achievement["type_budget_penalty"]) ??
    getNumber(achievement["penalty_value"]);

  if (direct !== undefined) return direct;

  const normalized = getAchievementNormalized(achievement);
  const matchingConstraint = getConstraintForAchievement(achievement, constraints);
  const penaltyWeight = matchingConstraint
    ? getTypeConstraintPenalty(matchingConstraint)
    : undefined;

  if (normalized !== undefined && penaltyWeight !== undefined) {
    return penaltyWeight * Math.pow(normalized - 1, 2);
  }

  return undefined;
}

function normalizeTypeConstraints(value: unknown): AdditionalTypeConstraint[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is AdditionalTypeConstraint =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
}

function normalizeTypeAchievements(value: unknown): AdditionalTypeAchievement[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is AdditionalTypeAchievement =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
}

function getTypeConstraintsFromSources(
  diagnostics: Diagnostics,
  inspectDiagnostics: Diagnostics,
  inspectSummary?: InspectWorkbookSummary
) {
  const fromResult = normalizeTypeConstraints(diagnostics.additional_type_constraints);
  if (fromResult.length > 0) return fromResult;

  const fromInspect = normalizeTypeConstraints(inspectDiagnostics.additional_type_constraints);
  if (fromInspect.length > 0) return fromInspect;

  return normalizeTypeConstraints(inspectSummary?.additional_type_constraints);
}

function getTypeAchievementsFromDiagnostics(diagnostics: Diagnostics) {
  return normalizeTypeAchievements(diagnostics.additional_type_budget_achievements);
}

function getTypeIdsFromRows(rows: CandidateRow[]) {
  const ids = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const match = key.match(/^(type_[a-e])_/);
      if (match) ids.add(match[1]);
    }
  }

  return TYPE_IDS.filter((id) => ids.has(id));
}

function getTypeLabelFromRow(row: CandidateRow, typeId: string) {
  return formatText(row[`${typeId}_name`] ?? row[`${typeId}_label`] ?? typeId);
}

function MetricCard({
  label,
  value,
  subtle = false,
  kind = "number",
}: {
  label: string;
  value: string;
  subtle?: boolean;
  kind?: "number" | "text";
}) {
  return (
    <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-3 min-w-0">
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className={metricValueClass(kind, subtle)}>{value}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-800 py-1.5 text-xs">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-100 text-right break-words max-w-[70%] min-w-0">
        {value ?? "n/a"}
      </span>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
  tone = "cyan",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  tone?: "cyan" | "amber";
}) {
  const titleClass = tone === "amber" ? "text-amber-300" : "text-cyan-200";
  const borderClass =
    tone === "amber" ? "border-amber-900/60" : "border-cyan-900/60";

  return (
    <div
      className={`rounded-2xl border ${borderClass} bg-slate-950/70 p-3 shadow-lg ${className}`}
    >
      <h2 className={`text-lg font-bold mb-3 ${titleClass}`}>{title}</h2>
      {children}
    </div>
  );
}

function QuantumPlaceholder({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-100/80">
      <div className="font-semibold text-amber-200 mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function ChartImage({ title, src }: { title: string; src: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
      <h3 className="text-xs font-semibold text-cyan-100 mb-2">{title}</h3>
      <img
        src={src}
        alt={title}
        className="w-full rounded-lg border border-slate-800 bg-white"
      />
    </div>
  );
}

function WorkbookWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-100">
      <div className="font-semibold text-amber-200 mb-1">Workbook warnings</div>
      <p className="mb-2 text-amber-100/80">
        These warnings do not block execution, but they may indicate an input
        configuration issue.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        {warnings.map((warning, idx) => (
          <li key={idx}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}

function TypeConstraintsPanel({
  constraints,
  achievements,
  currencyCode,
}: {
  constraints: AdditionalTypeConstraint[];
  achievements: AdditionalTypeAchievement[];
  currencyCode: string;
}) {
  if (constraints.length === 0 && achievements.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-gray-400">
        No additional type-budget constraints detected. V9 supports up to five
        optional exact type budgets: Type A through Type E.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {constraints.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-gray-400 border-b border-slate-700">
              <tr>
                <th className="py-1.5 pr-3">ID</th>
                <th className="py-1.5 pr-3">Name</th>
                <th className="py-1.5 pr-3">Size column</th>
                <th className="py-1.5 pr-3">Budget</th>
                <th className="py-1.5 pr-3">Penalty</th>
                <th className="py-1.5 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {constraints.map((constraint, idx) => (
                <tr key={`${constraint.id ?? idx}`} className="border-b border-slate-800">
                  <td className="py-1.5 pr-3 font-mono text-cyan-200">
                    {formatText(constraint.id)}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-200">
                    {getTypeConstraintLabel(constraint)}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-300">
                    {formatText(constraint.size_column)}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-300">
                    {formatCurrency(getTypeConstraintBudget(constraint), currencyCode)}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-300">
                    {formatNumber(getTypeConstraintPenalty(constraint), 4)}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-300">
                    {formatText(
                      constraint.status ??
                        (constraint.active === false ? "inactive" : "active")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {achievements.length > 0 && (
        <div className="overflow-x-auto">
          <div className="text-xs font-semibold text-cyan-100 mb-2">
            Type-budget achievements
          </div>
          <table className="w-full text-xs text-left">
            <thead className="text-gray-400 border-b border-slate-700">
              <tr>
                <th className="py-1.5 pr-3">Name</th>
                <th className="py-1.5 pr-3">Budget</th>
                <th className="py-1.5 pr-3">Achieved</th>
                <th className="py-1.5 pr-3">Normalized</th>
                <th className="py-1.5 pr-3">Deviation</th>
                <th className="py-1.5 pr-3">Relative deviation</th>
                <th className="py-1.5 pr-3">Penalty</th>
              </tr>
            </thead>
            <tbody>
              {achievements.map((achievement, idx) => {
                const budget = getAchievementBudget(achievement);
                const achieved = getAchievementAchieved(achievement);
                const normalized = getAchievementNormalized(achievement);
                const deviation = getAchievementDeviation(achievement);
                const relativeDeviation = getAchievementRelativeDeviation(achievement);
                const penalty = getAchievementPenalty(achievement, constraints);

                return (
                  <tr
                    key={`${achievement.id ?? idx}`}
                    className="border-b border-slate-800"
                  >
                    <td className="py-1.5 pr-3 text-gray-200">
                      {getAchievementLabel(achievement)}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-300">
                      {formatCurrency(budget, currencyCode)}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-300">
                      {formatCurrency(achieved, currencyCode)}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-300">
                      {formatNumber(normalized, 5)}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-300">
                      {formatCurrency(deviation, currencyCode)}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-300">
                      {formatPercent(relativeDeviation, 3)}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-300">
                      {formatNumber(penalty, 6)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExportDiagnosticsSummary({ diagnostics }: { diagnostics: Diagnostics }) {
  const hasAny =
    diagnostics.classical_export_requested_rows !== undefined ||
    diagnostics.classical_export_actual_rows !== undefined ||
    diagnostics.qaoa_export_requested_rows !== undefined ||
    diagnostics.qaoa_export_actual_rows !== undefined ||
    diagnostics.qaoa_exact_state_space !== undefined ||
    diagnostics.qaoa_exact_states_evaluated !== undefined ||
    diagnostics.qaoa_exact_states_exported !== undefined;

  if (!hasAny) return null;

  return (
    <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs">
      <div className="font-semibold text-cyan-100 mb-2">Export diagnostics</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <div>
          <InfoRow
            label="Classical export"
            value={`requested ${formatText(
              diagnostics.classical_export_requested_rows
            )}, exported ${formatText(diagnostics.classical_export_actual_rows)}`}
          />
          <InfoRow
            label="Classical cap applied"
            value={formatText(diagnostics.classical_export_cap_applied)}
          />
          <InfoRow
            label="Classical cap reason"
            value={formatText(diagnostics.classical_export_cap_reason)}
          />
        </div>

        <div>
          <InfoRow
            label="QAOA export"
            value={`requested ${formatText(
              diagnostics.qaoa_export_requested_rows
            )}, exported ${formatText(diagnostics.qaoa_export_actual_rows)}`}
          />
          <InfoRow
            label="QAOA cap applied"
            value={formatText(diagnostics.qaoa_export_cap_applied)}
          />
          <InfoRow
            label="QAOA cap reason"
            value={formatText(diagnostics.qaoa_export_cap_reason)}
          />
        </div>

        <div className="md:col-span-2">
          <InfoRow
            label="QAOA exact states"
            value={`state space ${formatText(
              diagnostics.qaoa_exact_state_space
            )}, evaluated ${formatText(
              diagnostics.qaoa_exact_states_evaluated
            )}, exported ${formatText(diagnostics.qaoa_exact_states_exported)}`}
          />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({
  visible,
  progress,
  message,
  etaText,
  status,
  ph