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
  const number = getNumber(value);
  if (number === undefined) return "n/a";

  return number.toLocaleString("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
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
  phase,
  iteration,
  maxIterations,
  elapsedSeconds,
  indeterminate,
}: {
  visible: boolean;
  progress?: number;
  message: string;
  etaText?: string;
  status?: string;
  phase?: string | null;
  iteration?: number | null;
  maxIterations?: number | null;
  elapsedSeconds?: number | null;
  indeterminate?: boolean;
}) {
  if (!visible) return null;

  const safeProgress =
    typeof progress === "number" && !Number.isNaN(progress)
      ? Math.max(0, Math.min(progress, 100))
      : undefined;

  return (
    <div className="mb-4 rounded-2xl border border-cyan-900/60 bg-slate-950/80 p-3 shadow-lg">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-cyan-100">{message}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
            {status && <span>Status: {status}</span>}
            {phase && <span>Phase: {phase}</span>}
            {iteration !== null &&
              iteration !== undefined &&
              maxIterations !== null &&
              maxIterations !== undefined && (
                <span>
                  Iteration: {iteration} / {maxIterations}
                </span>
              )}
            {elapsedSeconds !== null && elapsedSeconds !== undefined && (
              <span>Elapsed: {formatSeconds(elapsedSeconds)}</span>
            )}
            {etaText ? (
              <span>Backend live ETA: {etaText}</span>
            ) : (
              <span>Backend live ETA unavailable</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800">
        {indeterminate || safeProgress === undefined ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-400/70" />
        ) : (
          <div
            className="h-full rounded-full bg-cyan-400 transition-all duration-500"
            style={{ width: `${Math.max(3, safeProgress)}%` }}
          />
        )}
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Run submitted. You can keep this page open; reloading will not cancel the
        backend job.
      </div>
    </div>
  );
}

function ErrorBox({
  error,
  onReconnect,
}: {
  error?: RunResult["error"] | InspectResult["error"] | AsyncSubmitResponse["error"];
  onReconnect?: (jobId: string) => void;
}) {
  if (!error) return null;

  const activeRunId = error.details
    ? formatText((error.details as Record<string, unknown>).active_run_id, "")
    : "";

  return (
    <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-red-100">
      <div className="font-semibold text-sm">{error.code ?? "Error"}</div>
      <div className="text-xs mt-1">
        {error.message ?? "The backend rejected this request."}
      </div>

      {activeRunId && onReconnect && (
        <button
          onClick={() => onReconnect(activeRunId)}
          className="mt-3 rounded-lg border border-amber-700 bg-amber-950/60 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/70"
        >
          Reconnect to active run {activeRunId}
        </button>
      )}

      {error.details && Object.keys(error.details).length > 0 && (
        <div className="mt-3 rounded-lg border border-red-900/70 bg-black/20 p-2">
          <div className="text-xs font-semibold text-red-200 mb-1">Details</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            {Object.entries(error.details).map(([key, value]) => (
              <InfoRow key={key} label={key} value={formatText(value)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getBitIndexLabel(block: CandidateRow) {
  const role = String(block.decision_role ?? "").toLowerCase();
  if (role === "fixed") return "fixed";
  return formatText(block.variable_bit_index);
}

function hasQuantumResult(summary?: ReportingSummaryBlock) {
  return Boolean(summary?.available);
}

function quantumPlaceholderText(summary?: ReportingSummaryBlock) {
  return summary?.status ?? "Disabled / Not available";
}

function PortfolioContentsTable({
  rows,
  currencyCode,
}: {
  rows: CandidateRow[];
  currencyCode: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="text-gray-400 border-b border-slate-700">
          <tr>
            <th className="py-1.5 pr-3">Ticker</th>
            <th className="py-1.5 pr-3">Company</th>
            <th className="py-1.5 pr-3">Role</th>
            <th className="py-1.5 pr-3">Option</th>
            <th className="py-1.5 pr-3">Indicative Market Cost</th>
            <th className="py-1.5 pr-3">Shares</th>
            <th className="py-1.5 pr-3">Decision ID</th>
            <th className="py-1.5 pr-3">Bit Index</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((block, idx) => (
            <tr key={idx} className="border-b border-slate-800">
              <td className="py-1.5 pr-3 text-cyan-200">
                {formatText(block.Ticker)}
              </td>
              <td className="py-1.5 pr-3 text-gray-200">
                {formatText(block.Company)}
              </td>
              <td className="py-1.5 pr-3 text-gray-300">
                {formatText(block.decision_role)}
              </td>
              <td className="py-1.5 pr-3 text-gray-300">
                {formatText(block["Option Label"])}
              </td>
              <td className="py-1.5 pr-3 text-gray-300">
                {formatCurrency(getPortfolioCost(block), currencyCode)}
              </td>
              <td className="py-1.5 pr-3 text-gray-300">
                {formatText(block.Shares)}
              </td>
              <td className="py-1.5 pr-3 text-gray-400">
                {formatText(block.decision_id)}
              </td>
              <td className="py-1.5 pr-3 text-gray-400">
                {getBitIndexLabel(block)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidateTable({
  rows,
  currencyCode,
  showProbability = false,
}: {
  rows: CandidateRow[];
  currencyCode: string;
  showProbability?: boolean;
}) {
  const typeIds = getTypeIdsFromRows(rows);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="text-gray-400 border-b border-slate-700">
          <tr>
            <th className="py-1.5 pr-3">Rank</th>
            <th className="py-1.5 pr-3">Source</th>
            <th className="py-1.5 pr-3">Bitstring</th>
            {showProbability && <th className="py-1.5 pr-3">Probability</th>}
            <th className="py-1.5 pr-3">QUBO</th>
            <th className="py-1.5 pr-3">Selected amount</th>
            <th className="py-1.5 pr-3">Budget gap</th>
            {typeIds.map((typeId) => (
              <th key={`${typeId}_achieved_header`} className="py-1.5 pr-3">
                {typeId.replace("type_", "Type ").toUpperCase()} achieved
              </th>
            ))}
            {typeIds.map((typeId) => (
              <th key={`${typeId}_deviation_header`} className="py-1.5 pr-3">
                {typeId.replace("type_", "Type ").toUpperCase()} deviation
              </th>
            ))}
            <th className="py-1.5 pr-3">Return</th>
            <th className="py-1.5 pr-3">Volatility</th>
            <th className="py-1.5 pr-3">Sharpe ratio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((candidate, idx) => (
            <tr key={idx} className="border-b border-slate-800">
              <td className="py-1.5 pr-3 text-gray-300">
                {formatText(candidate.rank ?? idx + 1)}
              </td>
              <td className="py-1.5 pr-3 text-gray-400">
                {formatText(candidate.source ?? candidate.solver)}
              </td>
              <td className="py-1.5 pr-3 font-mono text-cyan-200">
                {formatText(candidate.bitstring)}
              </td>
              {showProbability && (
                <td className="py-1.5 pr-3 text-gray-300">
                  {formatProbability(candidate.probability)}
                </td>
              )}
              <td className="py-1.5 pr-3 text-gray-300">
                {formatNumber(candidate.qubo_value ?? candidate.qubo_reconstructed, 6)}
              </td>
              <td className="py-1.5 pr-3 text-gray-300">
                {formatCurrency(candidate.selected_usd, currencyCode)}
              </td>
              <td className="py-1.5 pr-3 text-gray-300">
                {formatCurrency(candidate.budget_gap, currencyCode)}
              </td>
              {typeIds.map((typeId) => (
                <td key={`${idx}_${typeId}_achieved`} className="py-1.5 pr-3 text-gray-300">
                  <div className="text-gray-500">{getTypeLabelFromRow(candidate, typeId)}</div>
                  <div>{formatCurrency(candidate[`${typeId}_achieved`], currencyCode)}</div>
                </td>
              ))}
              {typeIds.map((typeId) => (
                <td key={`${idx}_${typeId}_deviation`} className="py-1.5 pr-3 text-gray-300">
                  <div>{formatCurrency(candidate[`${typeId}_deviation`], currencyCode)}</div>
                  <div className="text-gray-500">
                    {formatPercent(candidate[`${typeId}_relative_deviation`], 3)}
                  </div>
                </td>
              ))}
              <td className="py-1.5 pr-3 text-gray-300">
                {formatNumber(candidate.portfolio_return, 4)}
              </td>
              <td className="py-1.5 pr-3 text-gray-300">
                {formatNumber(candidate.portfolio_vol, 4)}
              </td>
              <td className="py-1.5 pr-3 text-gray-300">
                {formatNumber(candidate.sharpe_like, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function QaoaRqpV9Page() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const inspectAbortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const reviewFileInputRef = useRef<HTMLInputElement | null>(null);
  const settingsTouchedRef = useRef(false);

  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [workbookFilename, setWorkbookFilename] = useState<string | null>(null);

  const [mode, setMode] = useState("classical_only");
  const [responseLevel, setResponseLevel] = useState("full");

  const [layers, setLayers] = useState(1);
  const [iterations, setIterations] = useState(80);
  const [restarts, setRestarts] = useState(1);
  const [warmStart, setWarmStart] = useState(false);
  const [budgetLambda, setBudgetLambda] = useState(50);
  const [riskLambda, setRiskLambda] = useState(6);
  const [riskFreeRate, setRiskFreeRate] = useState(0.04);
  const [qaoaShots, setQaoaShots] = useState(4096);
  const [restartPerturbation, setRestartPerturbation] = useState(0.05);
  const [randomSeed, setRandomSeed] = useState<number | "">("");
  const [settingsLoadedFromWorkbook, setSettingsLoadedFromWorkbook] = useState(false);

  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [inspectResult, setInspectResult] = useState<InspectResult | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const [logs, setLogs] = useState<string[]>([]);
  const [backendJobLogs, setBackendJobLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [progressMessage, setProgressMessage] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobError, setJobError] = useState<AsyncSubmitResponse["error"] | null>(null);
  const [reviewFileMessage, setReviewFileMessage] = useState<string | null>(null);
  const [reviewFileError, setReviewFileError] = useState<string | null>(null);

  const diagnostics = useMemo<Diagnostics>(() => result?.diagnostics ?? {}, [result]);
  const inspectDiagnostics = useMemo<Diagnostics>(
    () => getDiagnosticsFromInspect(inspectResult),
    [inspectResult]
  );

  const activeDiagnostics = useMemo<Diagnostics>(() => {
    return result?.diagnostics ?? getDiagnosticsFromInspect(inspectResult);
  }, [result, inspectResult]);

  const workbookWarnings = useMemo(() => {
    const inspectWarnings = getStringArray(inspectDiagnostics.workbook_warnings);
    if (inspectWarnings.length > 0) return inspectWarnings;
    return getStringArray(diagnostics.workbook_warnings);
  }, [inspectDiagnostics, diagnostics]);

  const metrics = result?.portfolio_metrics ?? {};
  const components = result?.components ?? {};
  const reporting = result?.reporting;
  const reportingSummary = reporting?.summary;
  const classicalSummary = reportingSummary?.classical_result_summary;
  const quantumSummary = reportingSummary?.quantum_result_summary;

  const inspectSummary = inspectResult?.workbook_summary;
  const inspectRuntimeEstimate = getRuntimeEstimateFromInspect(inspectResult);

  const currencyCode =
    reportingSummary?.currency_code ?? inspectSummary?.currency_code ?? "USD";

  const charts = reporting?.charts ?? {};
  const circuit =
    reporting?.circuit ??
    (diagnostics.circuit &&
    typeof diagnostics.circuit === "object" &&
    !Array.isArray(diagnostics.circuit)
      ? (diagnostics.circuit as Record<string, unknown>)
      : undefined);

  const classicalCandidates =
    reporting?.classical_candidates ?? result?.top_candidates ?? [];

  const portfolioContents = uniquePortfolioRows(
    reporting?.portfolio_contents ?? result?.selected_blocks ?? []
  );

  const quantumPortfolioContents = buildPortfolioFromBitstring(
    portfolioContents,
    quantumSummary?.best_bitstring
  );

  const solverComparison = reporting?.solver_comparison ?? [];
  const quantumSamples = reporting?.quantum_samples ?? [];
  const qaoaBestQubo = reporting?.qaoa_best_qubo ?? [];

  const backendOptimizationLogs =
    backendJobLogs.length > 0
      ? backendJobLogs
      : getStringArray(diagnostics.logs).length > 0
        ? getStringArray(diagnostics.logs)
        : getStringArray(inspectDiagnostics.logs);

  const shotsMode = getShotsMode(diagnostics, inspectDiagnostics);
  const qaoaShotsDisplay = getQaoaShotsDisplay(diagnostics, inspectDiagnostics);
  const isExactShotsMode = shotsMode === "exact" || qaoaShotsDisplay === "exact";
  const effectiveRandomSeed = getEffectiveRandomSeed(diagnostics, inspectDiagnostics);

  const typeConstraints = useMemo(
    () => getTypeConstraintsFromSources(diagnostics, inspectDiagnostics, inspectSummary),
    [diagnostics, inspectDiagnostics, inspectSummary]
  );

  const typeAchievements = useMemo(() => {
    const resultAchievements = getTypeAchievementsFromDiagnostics(diagnostics);
    if (resultAchievements.length > 0) return resultAchievements;
    return getTypeAchievementsFromDiagnostics(inspectDiagnostics);
  }, [diagnostics, inspectDiagnostics]);

  const additionalTypeConstraintCount =
    diagnostics.additional_type_constraints_count ??
    inspectDiagnostics.additional_type_constraints_count ??
    inspectSummary?.additional_type_constraints_count ??
    typeConstraints.length;

  const chartEntries = [
    ["Risk / Return / Sharpe ratio", charts.risk_return_sharpe],
    ["Risk / Return / QUBO", charts.risk_return_qubo],
    [
      "QUBO Breakdown - Classical",
      charts.qubo_breakdown_classical ?? charts.qubo_breakdown,
    ],
    ["QUBO Breakdown - Quantum by QUBO", charts.qubo_breakdown_quantum],
    ["Optimization History", charts.optimization_history],
    ["Circuit Overview", charts.circuit_overview],
    ["Solver Comparison", charts.solver_comparison],
  ].filter(([, src]) => typeof src === "string" && src.length > 0) as [
    string,
    string
  ][];

  const canRun = useMemo(() => {
    return !!file && !loading && !inspecting;
  }, [file, loading, inspecting]);

  const canSaveReview = useMemo(() => {
    return Boolean(result || inspectResult || jobStatus || backendJobLogs.length > 0);
  }, [result, inspectResult, jobStatus, backendJobLogs]);

  const knownQubits = useMemo(() => {
    return getNumber(
      reportingSummary?.decision_variables ??
        result?.binary_variables ??
        diagnostics.n_qubits ??
        diagnostics.binary_variables ??
        inspectSummary?.decision_variables ??
        inspectSummary?.n_qubits
    );
  }, [reportingSummary, result, diagnostics, inspectSummary]);

  const runtimeCap = useMemo(() => {
    if (mode === "qaoa_limited") {
      return (
        inspectRuntimeEstimate?.max_estimated_runtime_sec ??
        getQaoaLimitedLimits(license)?.max_estimated_runtime_sec
      );
    }

    return (
      inspectRuntimeEstimate?.max_estimated_runtime_sec ??
      getGeneralLimits(license)?.max_estimated_runtime_sec
    );
  }, [license, mode, inspectRuntimeEstimate]);

  const preRunEstimateSec = useMemo(() => {
    const backendEstimate =
      getNumber(inspectRuntimeEstimate?.estimated_runtime_sec) ??
      getNumber(inspectDiagnostics.estimated_runtime_sec);

    if (backendEstimate !== undefined) return backendEstimate;

    return estimateRuntimeSeconds({
      mode,
      qubits: knownQubits,
      layers,
      iterations,
      restarts,
      warmStart,
      runtimeCap,
    });
  }, [
    inspectRuntimeEstimate,
    inspectDiagnostics,
    mode,
    knownQubits,
    layers,
    iterations,
    restarts,
    warmStart,
    runtimeCap,
  ]);

  const rawEstimateSec =
    getNumber(inspectRuntimeEstimate?.raw_estimated_runtime_sec) ??
    getNumber(inspectDiagnostics.raw_estimated_runtime_sec);

  const calibratedEstimateSec =
    getNumber(inspectRuntimeEstimate?.estimated_runtime_sec) ??
    getNumber(inspectDiagnostics.estimated_runtime_sec) ??
    preRunEstimateSec;

  const estimateRangeText = formatEtaRange(
    getNumber(inspectRuntimeEstimate?.eta_seconds_low) ??
      getNumber(inspectDiagnostics.eta_seconds_low),
    getNumber(inspectRuntimeEstimate?.eta_seconds_high) ??
      getNumber(inspectDiagnostics.eta_seconds_high)
  );

  const jobProgress = jobStatus?.progress ?? null;
  const jobProgressPct =
    getNumber(jobProgress?.progress_pct) !== undefined
      ? getNumber(jobProgress?.progress_pct)
      : progress;

  const jobEtaText = formatEtaRange(
    getNumber(jobProgress?.eta_seconds_low),
    getNumber(jobProgress?.eta_seconds_high)
  );

  function markSettingsTouched() {
    settingsTouchedRef.current = true;
    setSettingsLoadedFromWorkbook(false);
  }

  function applyEffectiveSettingsFromInspection(data: InspectResult) {
    if (settingsTouchedRef.current) return;

    const effectiveSettings =
      data.diagnostics?.effective_settings ??
      getDiagnosticsFromInspect(data).effective_settings;

    if (!effectiveSettings) return;

    const nextLayers = getNumber(effectiveSettings.layers ?? effectiveSettings.p);
    const nextIterations = getNumber(effectiveSettings.iterations);
    const nextRestarts = getNumber(effectiveSettings.restarts);
    const nextWarmStart = getBoolean(effectiveSettings.warm_start);
    const nextBudgetLambda = getNumber(
      effectiveSettings.lambda_budget ?? effectiveSettings.budget_lambda
    );
    const nextRiskLambda = getNumber(
      effectiveSettings.lambda_variance ??
        effectiveSettings.risk_lambda ??
        effectiveSettings.variance_lambda
    );
    const nextRiskFreeRate = getNumber(effectiveSettings.risk_free_rate);
    const nextQaoaShots = getNumber(effectiveSettings.qaoa_shots);
    const nextRestartPerturbation = getNumber(effectiveSettings.restart_perturbation);
    const nextRandomSeed = getNumber(effectiveSettings.random_seed);

    let changed = false;

    if (nextLayers !== undefined) {
      setLayers(nextLayers);
      changed = true;
    }
    if (nextIterations !== undefined) {
      setIterations(nextIterations);
      changed = true;
    }
    if (nextRestarts !== undefined) {
      setRestarts(nextRestarts);
      changed = true;
    }
    if (nextWarmStart !== undefined) {
      setWarmStart(nextWarmStart);
      changed = true;
    }
    if (nextBudgetLambda !== undefined) {
      setBudgetLambda(nextBudgetLambda);
      changed = true;
    }
    if (nextRiskLambda !== undefined) {
      setRiskLambda(nextRiskLambda);
      changed = true;
    }
    if (nextRiskFreeRate !== undefined) {
      setRiskFreeRate(nextRiskFreeRate);
      changed = true;
    }
    if (nextQaoaShots !== undefined) {
      setQaoaShots(nextQaoaShots);
      changed = true;
    }
    if (nextRestartPerturbation !== undefined) {
      setRestartPerturbation(nextRestartPerturbation);
      changed = true;
    }
    if (nextRandomSeed !== undefined) {
      setRandomSeed(nextRandomSeed);
      changed = true;
    }

    setSettingsLoadedFromWorkbook(changed);
  }

  function addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const cleanMessage = message.replaceAll("Refresh with yfinance", "Refresh of Data");
    setLogs((prev) => [`[${timestamp}] ${cleanMessage}`, ...prev].slice(0, 80));
  }

  const clearPollInterval = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  function saveReviewFile() {
    setReviewFileError(null);
    setReviewFileMessage(null);

    const snapshot: SavedQaoaSnapshot = {
      schema: "qaoa-rqp-review-snapshot",
      schema_version: 1,
      saved_at: new Date().toISOString(),
      frontend: {
        page: "qaoa-rqp-v9",
        api_url: API_URL,
      },
      original_filename: workbookFilename ?? file?.name ?? inspectResult?.filename ?? null,
      ui_state: {
        mode,
        response_level: responseLevel,
        layers,
        iterations,
        restarts,
        warm_start: warmStart,
        budget_lambda: budgetLambda,
        risk_lambda: riskLambda,
        risk_free_rate: riskFreeRate,
        qaoa_shots: qaoaShots,
        restart_perturbation: restartPerturbation,
        random_seed: randomSeed,
      },
      license,
      inspect_result: inspectResult,
      result,
      job_status: jobStatus,
      active_job_id: activeJobId,
      backend_job_logs: backendJobLogs,
      client_logs: logs,
    };

    const filename = reviewFilename(snapshot.original_filename ?? null, mode);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setReviewFileMessage(`Saved ${filename}`);
    addLog(`Review file saved: ${filename}`);
  }

  async function loadReviewFileFromInput(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    setReviewFileError(null);
    setReviewFileMessage(null);

    try {
      const text = await selectedFile.text();
      const snapshot = JSON.parse(text) as SavedQaoaSnapshot;

      if (
        snapshot.schema !== "qaoa-rqp-review-snapshot" ||
        snapshot.schema_version !== 1
      ) {
        throw new Error("Unsupported review file format.");
      }

      clearPollInterval();

      setFile(null);
      setWorkbookFilename(snapshot.original_filename ?? selectedFile.name);
      setMode(snapshot.ui_state?.mode ?? "classical_only");
      setResponseLevel(snapshot.ui_state?.response_level ?? "full");
      setLayers(snapshot.ui_state?.layers ?? 1);
      setIterations(snapshot.ui_state?.iterations ?? 80);
      setRestarts(snapshot.ui_state?.restarts ?? 1);
      setWarmStart(snapshot.ui_state?.warm_start ?? false);
      setBudgetLambda(snapshot.ui_state?.budget_lambda ?? 50);
      setRiskLambda(snapshot.ui_state?.risk_lambda ?? 6);
      setRiskFreeRate(snapshot.ui_state?.risk_free_rate ?? 0.04);
      setQaoaShots(snapshot.ui_state?.qaoa_shots ?? 4096);
      setRestartPerturbation(snapshot.ui_state?.restart_perturbation ?? 0.05);
      setRandomSeed(snapshot.ui_state?.random_seed ?? "");

      setLicense(snapshot.license ?? null);
      setInspectResult(snapshot.inspect_result ?? null);
      setResult(snapshot.result ?? null);
      setJobStatus(snapshot.job_status ?? null);
      setActiveJobId(snapshot.active_job_id ?? snapshot.job_status?.job_id ?? null);
      setBackendJobLogs(snapshot.backend_job_logs ?? []);
      setLogs(snapshot.client_logs ?? []);
      setLoading(false);
      setProgress(undefined);
      setProgressMessage("");
      setJobError(null);
      settingsTouchedRef.current = true;
      setSettingsLoadedFromWorkbook(false);

      const msg = `Loaded review file: ${selectedFile.name}`;
      setReviewFileMessage(msg);
      addLog(msg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setReviewFileError(`Could not load review file: ${msg}`);
    } finally {
      event.target.value = "";
    }
  }

  async function fetchJobResult(jobId: string) {
    const res = await fetch(`${API_URL}/jobs/${jobId}/result`, {
      method: "GET",
      headers: apiKey ? { "X-API-Key": apiKey } : {},
    });

    const data = await res.json();

    if (!res.ok || data.status === "error") {
      setResult(data);
      addLog(`Result fetch failed: ${data?.error?.message ?? res.statusText}`);
      return;
    }

    setResult(data);
    setProgress(100);
    setProgressMessage("Run completed.");
    addLog(`Run completed. Best bitstring: ${data.best_bitstring ?? "n/a"}`);

    if (data.license) {
      setLicense(data.license);
    }

    try {
      window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    } catch {
      // Ignore localStorage failures.
    }
  }

  const pollJobStatus = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`${API_URL}/jobs/${jobId}/status`, {
          method: "GET",
          headers: apiKey ? { "X-API-Key": apiKey } : {},
        });

        const data: JobStatus = await res.json();
        setJobStatus(data);

        const tail = getStringArray(data.logs_tail);
        setBackendJobLogs(tail);

        if (data.latest_log) {
          setProgressMessage(data.latest_log);
        } else if (data.phase) {
          setProgressMessage(`Job ${data.status ?? "running"}: ${data.phase}`);
        } else {
          setProgressMessage(`Job ${data.status ?? "running"}`);
        }

        const pct = getNumber(data.progress?.progress_pct);
        if (pct !== undefined) {
          setProgress(pct);
        }

        if (data.license) {
          setLicense(data.license);
        }

        if (data.status === "completed") {
          clearPollInterval();
          setLoading(false);
          await fetchJobResult(jobId);
          return;
        }

        if (data.status === "failed" || data.status === "cancelled") {
          clearPollInterval();
          setLoading(false);
          setProgress(100);
          setProgressMessage(data.status === "failed" ? "Run failed." : "Run cancelled.");
          setResult({
            status: "error",
            error: {
              code: data.status,
              message: data.error?.message ?? `Job ${data.status}`,
              details: data.error?.details,
            },
          });
          try {
            window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
          } catch {
            // Ignore localStorage failures.
          }
        }
      } catch (err) {
        addLog(`Job status polling failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [apiKey, clearPollInterval]
  );

  function startPolling(jobId: string) {
    clearPollInterval();
    setActiveJobId(jobId);
    setLoading(true);
    setProgress(undefined);
    setProgressMessage("Job submitted. Waiting for backend status...");
    setJobError(null);

    try {
      window.localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, jobId);
    } catch {
      // Ignore localStorage failures.
    }

    void pollJobStatus(jobId);

    pollIntervalRef.current = window.setInterval(() => {
      void pollJobStatus(jobId);
    }, 4000);
  }

  function stopCurrentRequest() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    clearPollInterval();
    addLog("Stopped frontend tracking. Backend job is not cancelled.");
    setProgressMessage("Frontend tracking stopped.");
    setLoading(false);
  }

  async function cancelActiveJob() {
    if (!activeJobId) {
      stopCurrentRequest();
      return;
    }

    try {
      addLog(`Cancellation requested for job ${activeJobId}.`);
      await fetch(`${API_URL}/jobs/${activeJobId}/cancel`, {
        method: "POST",
        headers: apiKey ? { "X-API-Key": apiKey } : {},
      });
      await pollJobStatus(activeJobId);
    } catch (err) {
      addLog(`Cancel request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function inspectWorkbook() {
    if (!file) {
      setInspectResult(null);
      return;
    }

    if (inspectAbortControllerRef.current) {
      inspectAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    inspectAbortControllerRef.current = controller;
    setInspecting(true);

    try {
      addLog("Inspecting workbook...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      formData.append("response_level", responseLevel);

      if (settingsTouchedRef.current) {
        formData.append("layers", String(layers));
        formData.append("iterations", String(iterations));
        formData.append("restarts", String(restarts));
        formData.append("warm_start", String(warmStart));
        formData.append("lambda_budget", String(budgetLambda));
        formData.append("lambda_variance", String(riskLambda));
        formData.append("risk_free_rate", String(riskFreeRate));
        formData.append("qaoa_shots", String(qaoaShots));
        formData.append("restart_perturbation", String(restartPerturbation));
        if (randomSeed !== "") {
          formData.append("random_seed", String(randomSeed));
        }
      }

      const res = await fetch(`${API_URL}/inspect-workbook`, {
        method: "POST",
        headers: apiKey ? { "X-API-Key": apiKey } : {},
        body: formData,
        signal: controller.signal,
      });

      const data: InspectResult = await res.json();

      setInspectResult(data);
      applyEffectiveSettingsFromInspection(data);

      if (data.license) {
        setLicense(data.license);
      }

      if (!res.ok || data.status === "error") {
        addLog(`Workbook inspection failed: ${data?.error?.message ?? res.statusText}`);

        const estimate = getRuntimeEstimateFromInspect(data);
        const range = formatEtaRange(
          estimate?.eta_seconds_low ?? getDiagnosticsFromInspect(data).eta_seconds_low,
          estimate?.eta_seconds_high ?? getDiagnosticsFromInspect(data).eta_seconds_high
        );

        if (range !== "n/a" || estimate?.estimated_runtime_sec !== undefined) {
          addLog(
            `Backend estimate still available: ${
              range !== "n/a" ? range : formatSeconds(estimate?.estimated_runtime_sec)
            }.`
          );
        }

        const warnings = getStringArray(getDiagnosticsFromInspect(data).workbook_warnings);
        if (warnings.length > 0) {
          addLog(`Workbook warnings: ${warnings.length}`);
        }

        return;
      }

      const n =
        data?.workbook_summary?.decision_variables ??
        data?.workbook_summary?.n_qubits ??
        "n/a";

      const range = formatEtaRange(
        data?.runtime_estimate?.eta_seconds_low ?? data?.diagnostics?.eta_seconds_low,
        data?.runtime_estimate?.eta_seconds_high ?? data?.diagnostics?.eta_seconds_high
      );

      const eta = data?.runtime_estimate?.estimated_runtime_sec;

      addLog(
        `Workbook inspected. Decision variables: ${n}. Runtime estimate: ${
          range !== "n/a" ? range : eta !== undefined ? formatSeconds(eta) : "n/a"
        }.`
      );

      const typeCount =
        data?.diagnostics?.additional_type_constraints_count ??
        data?.workbook_summary?.additional_type_constraints_count ??
        0;

      if (typeCount > 0) {
        addLog(`Additional type-budget constraints detected: ${typeCount}`);
      }

      const warnings = getStringArray(data?.diagnostics?.workbook_warnings);
      if (warnings.length > 0) {
        addLog(`Workbook warnings: ${warnings.length}`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        addLog("Workbook inspection stopped.");
      } else {
        addLog(
          `Workbook inspection failed: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    } finally {
      inspectAbortControllerRef.current = null;
      setInspecting(false);
    }
  }

  useEffect(() => {
    if (!file) {
      setInspectResult((current) => current);
      return;
    }

    const timer = window.setTimeout(() => {
      void inspectWorkbook();
    }, 500);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    file,
    apiKey,
    mode,
    responseLevel,
    layers,
    iterations,
    restarts,
    warmStart,
    budgetLambda,
    riskLambda,
    riskFreeRate,
    qaoaShots,
    restartPerturbation,
    randomSeed,
  ]);

  useEffect(() => {
    try {
      const storedJobId = window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
      if (storedJobId) {
        setActiveJobId(storedJobId);
        addLog(`Found previous V9 job ${storedJobId}. You can reconnect if it is still active.`);
      }
    } catch {
      // Ignore localStorage failures.
    }

    return () => {
      clearPollInterval();
    };
  }, [clearPollInterval]);

  async function checkLicense() {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setResult(null);
    setProgress(10);
    setProgressMessage("Checking license status...");

    try {
      addLog("Checking license status...");

      const res = await fetch(`${API_URL}/license-status`, {
        method: "GET",
        headers: apiKey ? { "X-API-Key": apiKey } : {},
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        addLog(`License check failed: ${data?.error?.message ?? res.statusText}`);
        setLicense(null);
        return;
      }

      setLicense(data);
      addLog(
        `License active: ${data.display_name ?? data.usage_level ?? "Public Demo"}`
      );
      setProgress(100);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        addLog("License check stopped.");
      } else {
        addLog(`License check failed: ${err instanceof Error ? err.message : String(err)}`);
        setLicense(null);
      }
    } finally {
      abortControllerRef.current = null;
      window.setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setProgressMessage("");
      }, 400);
    }
  }

  async function runOptimization() {
    if (!file) {
      addLog("No Excel file selected.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    clearPollInterval();
    setLoading(true);
    setResult(null);
    setJobStatus(null);
    setJobError(null);
    setBackendJobLogs([]);
    setProgress(3);
    setProgressMessage("Uploading Excel file and submitting backend job...");

    try {
      addLog("Submitting optimization job to V9 backend...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      formData.append("response_level", responseLevel);
      formData.append("layers", String(layers));
      formData.append("iterations", String(iterations));
      formData.append("restarts", String(restarts));
      formData.append("warm_start", String(warmStart));
      formData.append("lambda_budget", String(budgetLambda));
      formData.append("lambda_variance", String(riskLambda));
      formData.append("risk_free_rate", String(riskFreeRate));
      formData.append("qaoa_shots", String(qaoaShots));
      formData.append("restart_perturbation", String(restartPerturbation));
      if (randomSeed !== "") {
        formData.append("random_seed", String(randomSeed));
      }

      const res = await fetch(`${API_URL}/run-qaoa-async`, {
        method: "POST",
        headers: apiKey ? { "X-API-Key": apiKey } : {},
        body: formData,
        signal: controller.signal,
      });

      const data: AsyncSubmitResponse = await res.json();

      if (data.license) {
        setLicense(data.license);
      }

      if (!res.ok || data.status === "error" || !data.job_id) {
        setJobError(data.error);
        setResult({
          status: "error",
          error: data.error,
        });
        addLog(`Run submission failed: ${data?.error?.message ?? res.statusText}`);
        setProgress(100);
        setLoading(false);
        return;
      }

      addLog(`Job submitted: ${data.job_id}`);
      addLog("You can keep this page open. Reloading will not cancel the backend job.");
      startPolling(data.job_id);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        addLog("Run submission stopped by user.");
        setProgressMessage("Run submission stopped.");
      } else {
        addLog(`Run submission failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      setLoading(false);
    } finally {
      abortControllerRef.current = null;
    }
  }

  const workbookSummary = [
    ["Workbook file", workbookFilename ?? file?.name ?? inspectResult?.filename],
    [
      "Backend service",
      diagnostics.service ?? inspectDiagnostics.service ?? "qaoa-rqp-api-v9",
    ],
    [
      "Model version",
      result?.model_version ?? inspectResult?.model_version ?? "9.0.0",
    ],
    [
      "Decision variables / qubits",
      reportingSummary?.decision_variables ??
        result?.binary_variables ??
        diagnostics.n_qubits ??
        diagnostics.binary_variables ??
        inspectSummary?.decision_variables ??
        inspectSummary?.n_qubits,
    ],
    [
      "Decision state space",
      reportingSummary?.decision_state_space ?? inspectSummary?.decision_state_space,
    ],
    [
      "Fixed asset blocks",
      reportingSummary?.fixed_asset_blocks ??
        diagnostics.fixed_options ??
        metrics.num_fixed_options ??
        inspectSummary?.fixed_asset_blocks,
    ],
    [
      "Variable asset blocks",
      reportingSummary?.variable_asset_blocks ??
        diagnostics.variable_options ??
        metrics.num_variable_options ??
        inspectSummary?.variable_asset_blocks,
    ],
    [
      "Unique tickers referenced",
      reportingSummary?.unique_tickers ??
        diagnostics.assets_referenced_by_options ??
        inspectSummary?.unique_tickers ??
        inspectSummary?.assets_referenced_by_options,
    ],
    [
      "Budget",
      formatCurrency(diagnostics.budget_usd ?? inspectSummary?.budget, currencyCode),
    ],
    [
      "Fixed invested amount",
      formatCurrency(
        reportingSummary?.fixed_invested_usd ??
          metrics.fixed_usd ??
          inspectSummary?.fixed_invested_amount,
        currencyCode
      ),
    ],
    [
      "Variable selectable universe",
      formatCurrency(
        reportingSummary?.variable_candidate_usd_universe ??
          inspectSummary?.variable_candidate_universe,
        currencyCode
      ),
    ],
    [
      "Additional type constraints",
      additionalTypeConstraintCount,
    ],
    [
      "QUBO shape",
      formatQuboShape(diagnostics.qubo_shape ?? inspectSummary?.qubo_shape),
    ],
    [
      "Classical candidates",
      reportingSummary?.classical_candidate_count ??
        diagnostics.classical_candidate_count,
    ],
    ["QAOA candidates", reportingSummary?.qaoa_candidate_count ?? 0],
    ["Top N exported", reportingSummary?.top_n_exported],
    ["Settings loaded", inspectSummary?.settings_count],
  ];

  return (
    <AppLayout>
      <Header />

      <section className="max-w-[2200px] mx-auto px-3 sm:px-4 xl:px-6 2xl:px-8 pt-20 pb-10">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">
          Rapid Quantum Prototyping (RQP) Lab
        </p>

        <h1 className="text-3xl font-bold text-cyan-300 mb-2">
          QAOA RQP Pro V9
        </h1>

        <p className="text-cyan-100 text-base font-semibold mb-3">
          Excel-to-Quantum portfolio optimization with optional exact type-budget constraints.
        </p>

        <div className="max-w-7xl mb-5 space-y-3">
          <p className="text-gray-200 text-base font-semibold leading-relaxed">
            This hidden V9 test page uses the separate V9 backend. It supports the
            existing QAOA RQP workflow plus up to five optional exact type budgets,
            for example Bond, Equity, Alternatives, Region, or Rating buckets.
          </p>

          <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-100">
            V9 test route. Not yet linked from the public site navigation. The current
            public QAOA RQP page remains on V8.
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-gray-300">
            Best used on a desktop or laptop screen. Use browser zoom to fit the workspace
            comfortably. Mobile screens are supported only for basic review.
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href={USER_GUIDE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-cyan-800 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-500 hover:bg-slate-900 active:bg-slate-800"
            >
              View Quick PDF User Guide
            </a>

            <a
              href={DEMO_EXCEL_7_URL}
              download="QuantumPortfolioOptimizer_demo_7.xlsx"
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 active:bg-amber-600"
            >
              Download Excel Workbook for 7 Qubits
            </a>

            <a
              href={DEMO_EXCEL_16_URL}
              download="QuantumPortfolioOptimizer_demo_16.xlsx"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 active:bg-cyan-600"
            >
              Workbook 16 Qubits
            </a>

            <a
              href={DEMO_EXCEL_24_URL}
              download="QuantumPortfolioOptimizer_demo_24.xlsx"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 active:bg-cyan-600"
            >
              Workbook 24 Qubits
            </a>

            <a
              href={REVIEW_FILE_24_URL}
              download="qaoa-rqp-review_QuantumPortfolioOptimizer_demo_24_qaoa_limited_20260504-065225.json"
              className="rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-gray-400 active:bg-gray-600"
            >
              Review File 24 Qubits
            </a>
          </div>
        </div>

        {activeJobId && !loading && !result && (
          <div className="mb-4 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-100">
            <div className="font-semibold text-amber-200">Previous V9 job found</div>
            <div className="mt-1">
              Job ID: <span className="font-mono">{activeJobId}</span>
            </div>
            <button
              onClick={() => startPolling(activeJobId)}
              className="mt-2 rounded-lg border border-amber-700 bg-amber-950/60 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/70"
            >
              Reconnect to job
            </button>
          </div>
        )}

        <ProgressBar
          visible={loading}
          progress={jobProgressPct}
          message={progressMessage}
          etaText={jobEtaText === "n/a" ? undefined : jobEtaText}
          status={jobStatus?.status}
          phase={jobStatus?.phase}
          iteration={jobProgress?.iteration}
          maxIterations={jobProgress?.max_iterations}
          elapsedSeconds={jobProgress?.elapsed_seconds}
          indeterminate={jobProgressPct === undefined}
        />

        <div className="grid grid-cols-1 2xl:grid-cols-12 gap-4">
          <div className="2xl:col-span-3 space-y-4">
            <Panel title="Access">
              <label className="block text-xs text-gray-300 mb-1.5">
                License key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your license key"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-cyan-400"
              />

              <button
                onClick={checkLicense}
                disabled={loading}
                className="mt-3 w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-slate-950 font-semibold py-2 text-sm"
              >
                Check License or Public Demo
              </button>

              {license && (
                <div className="mt-3 rounded-xl bg-slate-900/80 border border-slate-700 p-3 text-xs text-gray-200">
                  <div className="space-y-1">
                    <InfoRow label="Key ID" value={formatText(license.key_id)} />
                    <InfoRow
                      label="Level"
                      value={formatText(license.display_name ?? license.usage_level)}
                    />
                    <InfoRow label="Status" value={formatText(license.status)} />
                    <InfoRow label="Name" value={formatText(license.name)} />
                    <InfoRow
                      label="Organization"
                      value={formatText(license.organization)}
                    />
                    <InfoRow label="Expires" value={formatText(license.expires_at)} />
                    <InfoRow label="Max runs" value={formatText(license.max_runs)} />
                    <InfoRow label="Used runs" value={formatText(license.used_runs)} />
                    <InfoRow
                      label="Remaining runs"
                      value={formatText(license.remaining_runs)}
                    />
                    <InfoRow
                      label="Max runtime"
                      value={formatSeconds(
                        license.max_estimated_runtime_sec ??
                          getGeneralLimits(license)?.max_estimated_runtime_sec
                      )}
                    />
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-2">
                    <div className="text-xs font-semibold text-cyan-100 mb-1">
                      General limits
                    </div>
                    <div className="text-xs leading-relaxed text-gray-300 break-words">
                      {formatLimitBlock(getGeneralLimits(license))}
                    </div>
                  </div>

                  <div className="mt-2 rounded-xl border border-amber-900/60 bg-amber-950/20 p-2">
                    <div className="text-xs font-semibold text-amber-200 mb-1">
                      QAOA limited limits
                    </div>
                    <div className="text-xs leading-relaxed text-amber-100/80 break-words">
                      {formatLimitBlock(getQaoaLimitedLimits(license))}
                    </div>
                  </div>

                  <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950/60 p-2">
                    <div className="text-xs font-semibold text-cyan-100 mb-1">
                      Allowed modes
                    </div>
                    <div className="text-xs leading-relaxed text-gray-300 break-words">
                      {formatText(license.allowed_modes)}
                    </div>
                  </div>

                  <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950/60 p-2">
                    <div className="text-xs font-semibold text-cyan-100 mb-1">
                      Response levels
                    </div>
                    <div className="text-xs leading-relaxed text-gray-300 break-words">
                      {formatText(license.allowed_response_levels)}
                    </div>
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Excel Input">
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0] ?? null;
                  setFile(selectedFile);
                  setWorkbookFilename(selectedFile?.name ?? null);
                  setResult(null);
                  setInspectResult(null);
                  setJobStatus(null);
                  setJobError(null);
                  settingsTouchedRef.current = false;
                  setSettingsLoadedFromWorkbook(false);
                }}
                className="w-full text-xs text-gray-200 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:font-semibold file:text-slate-950 hover:file:bg-cyan-400"
              />

              {workbookFilename && (
                <p className="mt-2 text-xs text-gray-400">
                  Workbook: <span className="text-gray-200">{workbookFilename}</span>
                </p>
              )}

              {workbookFilename && !file && result && (
                <p className="mt-1 text-xs text-amber-200">
                  Review file loaded. The original workbook is not attached for rerun.
                </p>
              )}

              <div className="mt-3 rounded-xl bg-slate-900/80 border border-slate-700 p-3">
                <h3 className="text-xs font-semibold text-cyan-100 mb-2">
                  Workbook Summary
                </h3>

                {inspecting && (
                  <p className="text-xs text-amber-200 mb-2">
                    Inspecting workbook and recalculating runtime estimate...
                  </p>
                )}

                {!result && !inspectResult && !inspecting && (
                  <p className="text-xs text-gray-500 mb-2">
                    Workbook metrics are available after file inspection.
                  </p>
                )}

                {inspectResult?.error && (
                  <div className="mb-2">
                    <ErrorBox error={inspectResult.error} />
                  </div>
                )}

                <WorkbookWarnings warnings={workbookWarnings} />

                <div>
                  {workbookSummary.map(([label, value]) => (
                    <InfoRow
                      key={String(label)}
                      label={String(label)}
                      value={
                        value === undefined || value === "n/a"
                          ? "available after inspection"
                          : String(value)
                      }
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  Fixed blocks are included in every portfolio. Only variable
                  blocks become QUBO decision variables / qubits.
                </p>
              </div>
            </Panel>

            <Panel title="Additional Type Budgets" tone="amber">
              <p className="mb-3 text-xs leading-relaxed text-amber-100/80">
                V9 supports up to five exact type budgets. In Excel, use
                Additional Type Constraints plus Type A-E Size, Name, Budget,
                and Budget Penalty fields.
              </p>

              <TypeConstraintsPanel
                constraints={typeConstraints}
                achievements={typeAchievements}
                currencyCode={currencyCode}
              />
            </Panel>

            <Panel title="Optimization Settings">
              <label className="block text-xs text-gray-300 mb-1.5">Mode</label>
              <select
                value={mode}
                onChange={(e) => {
                  markSettingsTouched();
                  setMode(e.target.value);
                }}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-gray-100 mb-3"
              >
                <option value="classical_only">classical_only</option>
                <option value="qaoa_limited">qaoa_limited</option>
                <option value="qaoa_full">qaoa_full disabled</option>
              </select>

              {mode === "qaoa_limited" && (
                <div className="mb-3 rounded-xl border border-amber-700 bg-amber-950/30 p-2 text-xs text-amber-100">
                  QAOA limited mode runs as an asynchronous backend job. Availability
                  and limits depend on the active key or public demo limits.
                </div>
              )}

              {mode === "qaoa_full" && (
                <div className="mb-3 rounded-xl border border-yellow-700 bg-yellow-950/30 p-2 text-xs text-yellow-100">
                  QAOA full mode is still disabled by the backend. Use qaoa_limited
                  for current cloud runs.
                </div>
              )}

              <label className="block text-xs text-gray-300 mb-1.5">
                Response level
              </label>
              <select
                value={responseLevel}
                onChange={(e) => {
                  markSettingsTouched();
                  setResponseLevel(e.target.value);
                }}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-gray-100 mb-3"
              >
                <option value="compact">compact</option>
                <option value="standard">standard</option>
                <option value="full">full</option>
              </select>

              {settingsLoadedFromWorkbook && (
                <div className="mb-3 rounded-xl border border-cyan-800 bg-cyan-950/20 p-2 text-xs text-cyan-100">
                  Settings loaded from workbook. You can override them before running.
                </div>
              )}

              <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs">
                <div className="text-xs font-semibold text-cyan-100 mb-2">
                  Initial pre-run runtime estimate
                </div>

                <button
                  onClick={inspectWorkbook}
                  disabled={!file || inspecting || loading}
                  className="mb-3 w-full rounded-lg border border-cyan-800 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-slate-900 disabled:text-gray-500 disabled:border-slate-800"
                >
                  {inspecting ? "Recalculating..." : "Recalculate estimate"}
                </button>

                <InfoRow
                  label="Initial expected range"
                  value={
                    estimateRangeText !== "n/a"
                      ? estimateRangeText
                      : calibratedEstimateSec === undefined
                        ? "disabled"
                        : `~${formatSeconds(calibratedEstimateSec)}`
                  }
                />
                <InfoRow
                  label="Initial calibrated estimate"
                  value={
                    calibratedEstimateSec === undefined
                      ? "n/a"
                      : formatSeconds(calibratedEstimateSec)
                  }
                />
                <InfoRow
                  label="Raw backend estimate"
                  value={rawEstimateSec === undefined ? "n/a" : formatSeconds(rawEstimateSec)}
                />
                <InfoRow
                  label="Estimate basis"
                  value={
                    inspectRuntimeEstimate?.basis
                      ? `${inspectRuntimeEstimate.basis.n_qubits ?? knownQubits ?? "n/a"} qubits, ${
                          inspectRuntimeEstimate.basis.layers ?? layers
                        } layers, ${
                          inspectRuntimeEstimate.basis.iterations ?? iterations
                        } iterations, ${
                          inspectRuntimeEstimate.basis.restarts ?? restarts
                        } restarts, warm_start=${String(
                          inspectRuntimeEstimate.basis.warm_start ?? warmStart
                        )}`
                      : knownQubits !== undefined
                        ? `${knownQubits} qubits, ${layers} layers, ${iterations} iterations, ${restarts} restarts`
                        : "waiting for workbook inspection"
                  }
                />
                <InfoRow
                  label="Random seed"
                  value={formatText(effectiveRandomSeed ?? randomSeed, "auto")}
                />
                <InfoRow label="Runtime cap" value={formatSeconds(runtimeCap)} />
                <InfoRow
                  label="Within backend limit"
                  value={
                    inspectRuntimeEstimate?.within_limit === undefined
                      ? "n/a"
                      : inspectRuntimeEstimate.within_limit
                        ? "yes"
                        : "no"
                  }
                />
                <InfoRow
                  label="Limit source"
                  value={formatText(inspectRuntimeEstimate?.limit_source)}
                />
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  This is the initial estimate from workbook inspection before execution.
                  The backend live ETA during a job may differ once real execution speed is known.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-xs text-gray-300 mb-1.5">
                    Layers
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={layers}
                    onChange={(e) => {
                      markSettingsTouched();
                      setLayers(Number(e.target.value));
                    }}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white accent-white [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1.5">
                    Iterations
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={iterations}
                    onChange={(e) => {
                      markSettingsTouched();
                      setIterations(Number(e.target.value));
                    }}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white accent-white [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1.5">
                    Restarts
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={restarts}
                    onChange={(e) => {
                      markSettingsTouched();
                      setRestarts(Number(e.target.value));
                    }}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white accent-white [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1.5">
                    QAOA shots
                  </label>
                  {isExactShotsMode ? (
                    <input
                      value="exact"
                      disabled
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-gray-300"
                    />
                  ) : (
                    <input
                      type="number"
                      min={0}
                      value={qaoaShots}
                      onChange={(e) => {
                        markSettingsTouched();
                        setQaoaShots(Number(e.target.value));
                      }}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white accent-white [color-scheme:dark]"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1.5">
                    Budget lambda
                  </label>
                  <input
                    type="number"
                    value={budgetLambda}
                    onChange={(e) => {
                      markSettingsTouched();
                      setBudgetLambda(Number(e.target.value));
                    }}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white accent-white [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1.5">
                    Risk lambda
                  </label>
                  <input
                    type="number"
                    value={riskLambda}
                    onChange={(e) => {
                      markSettingsTouched();
                      setRiskLambda(Number(e.target.value));
                    }}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white accent-white [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1.5">
                    Risk-free rate
                  </label>
                  <input
                    type="number"
                    step={0.001}
                    value={riskFreeRate}
                    onChange={(e) => {
                      markSettingsTouched();
                      setRiskFreeRate(Number(e.target.value));
                    }}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white accent-white [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1.5">
                    Restart perturbation
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    value={restartPerturbation}
                    onChange={(e) => {
                      markSettingsTouched();
                      setRestartPerturbation(Number(e.target.value));
                    }}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white accent-white [color-scheme:dark]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-300 mb-1.5">
                    Random seed
                  </label>
                  <input
                    type="number"
                    step={1}
                    value={randomSeed}
                    placeholder="auto / workbook"
                    onChange={(e) => {
                      markSettingsTouched();
                      const value = e.target.value;
                      setRandomSeed(value === "" ? "" : Number(value));
                    }}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white accent-white [color-scheme:dark]"
                  />
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    Optional. Use the same seed to make comparable runs more reproducible
                    under the same code and environment.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-3 text-xs text-gray-300 mb-3">
                <input
                  type="checkbox"
                  checked={warmStart}
                  onChange={(e) => {
                    markSettingsTouched();
                    setWarmStart(e.target.checked);
                  }}
                  className="h-4 w-4"
                />
                Warm start
              </label>

              <p className="mb-2 text-xs leading-relaxed text-gray-500">
                Runs are submitted as backend jobs. The page polls the backend for
                progress, logs, ETA and result availability.
              </p>
              <p className="mb-4 text-xs leading-relaxed text-gray-500">
                QAOA shots are used only when sampling mode is active. In exact
                mode the setting is shown as exact and is not editable.
              </p>

              <button
                onClick={runOptimization}
                disabled={!canRun}
                className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-slate-950 font-semibold py-2.5 text-sm"
              >
                {loading ? "Running..." : "Run Optimization on V9"}
              </button>

              {activeJobId && loading && (
                <button
                  onClick={cancelActiveJob}
                  className="mt-2 w-full rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-900/70"
                >
                  Request backend cancellation
                </button>
              )}
            </Panel>

            <Panel title="Review File">
              <p className="mb-3 text-xs leading-relaxed text-gray-400">
                Save the current V9 result, charts, logs, settings, and workbook filename
                as a local JSON review file. Loading a review file restores the view
                without rerunning the backend.
              </p>

              <button
                onClick={saveReviewFile}
                disabled={!canSaveReview}
                className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-slate-950 font-semibold py-2 text-sm"
              >
                Save Review File
              </button>

              <button
                onClick={() => reviewFileInputRef.current?.click()}
                className="mt-2 w-full rounded-lg border border-cyan-800 bg-slate-950/80 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-slate-900"
              >
                Load Review File
              </button>

              <input
                ref={reviewFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={loadReviewFileFromInput}
                className="hidden"
              />

              {reviewFileMessage && (
                <div className="mt-3 rounded-lg border border-cyan-900/60 bg-cyan-950/20 p-2 text-xs text-cyan-100">
                  {reviewFileMessage}
                </div>
              )}

              {reviewFileError && (
                <div className="mt-3 rounded-lg border border-red-800 bg-red-950/40 p-2 text-xs text-red-100">
                  {reviewFileError}
                </div>
              )}
            </Panel>
          </div>

          <div className="2xl:col-span-9 space-y-4">
            {jobError && (
              <ErrorBox error={jobError} onReconnect={(jobId) => startPolling(jobId)} />
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Panel title="Classical Result Summary">
                {!result && (
                  <p className="text-gray-400 text-sm">
                    Run an optimization to see the classical result summary here.
                  </p>
                )}

                {result?.error && (
                  <ErrorBox error={result.error} onReconnect={(jobId) => startPolling(jobId)} />
                )}

                {result && !result.error && (
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                    <MetricCard
                      label="QUBO value"
                      value={formatNumber(
                        classicalSummary?.qubo_value ?? result.qubo_value,
                        6
                      )}
                    />
                    <MetricCard
                      label="Selected amount"
                      value={formatCurrency(
                        classicalSummary?.selected_usd ?? result.selected_usd,
                        currencyCode
                      )}
                    />
                    <MetricCard
                      label="Budget gap"
                      value={formatCurrency(
                        classicalSummary?.budget_gap ?? result.budget_gap,
                        currencyCode
                      )}
                    />
                    <MetricCard
                      label="Return proxy"
                      value={formatNumber(
                        classicalSummary?.portfolio_return ?? metrics.portfolio_return,
                        3
                      )}
                    />
                    <MetricCard
                      label="Volatility"
                      value={formatNumber(
                        classicalSummary?.portfolio_vol ?? metrics.portfolio_vol,
                        3
                      )}
                    />
                    <MetricCard
                      label="Sharpe ratio"
                      value={formatNumber(
                        classicalSummary?.sharpe_like ?? metrics.sharpe_like,
                        3
                      )}
                    />
                    <MetricCard
                      label="Bitstring"
                      value={formatText(
                        classicalSummary?.best_bitstring ?? result.best_bitstring
                      )}
                      kind="text"
                    />
                    <MetricCard
                      label="Source"
                      value={formatText(classicalSummary?.source ?? result.solver)}
                      kind="text"
                    />
                    <MetricCard
                      label="Objective"
                      value={formatNumber(
                        classicalSummary?.objective ?? result.objective,
                        4
                      )}
                    />
                  </div>
                )}
              </Panel>

              <Panel title="Quantum Result Summary" tone="amber">
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                  <MetricCard
                    label="QUBO value"
                    value={formatNumber(quantumSummary?.qubo_value, 6)}
                    subtle={!quantumSummary?.available}
                  />
                  <MetricCard
                    label="Selected amount"
                    value={formatCurrency(quantumSummary?.selected_usd, currencyCode)}
                    subtle={!quantumSummary?.available}
                  />
                  <MetricCard
                    label="Budget gap"
                    value={formatCurrency(quantumSummary?.budget_gap, currencyCode)}
                    subtle={!quantumSummary?.available}
                  />
                  <MetricCard
                    label="Return proxy"
                    value={formatNumber(quantumSummary?.portfolio_return, 3)}
                    subtle={!quantumSummary?.available}
                  />
                  <MetricCard
                    label="Volatility"
                    value={formatNumber(quantumSummary?.portfolio_vol, 3)}
                    subtle={!quantumSummary?.available}
                  />
                  <MetricCard
                    label="Sharpe ratio"
                    value={formatNumber(quantumSummary?.sharpe_like, 3)}
                    subtle={!quantumSummary?.available}
                  />
                  <MetricCard
                    label="Bitstring"
                    value={formatText(quantumSummary?.best_bitstring)}
                    subtle={!quantumSummary?.available}
                    kind="text"
                  />
                  <MetricCard
                    label="Source"
                    value={formatText(quantumSummary?.source)}
                    subtle={!quantumSummary?.available}
                    kind="text"
                  />
                  <MetricCard
                    label="Probability"
                    value={formatProbability(quantumSummary?.probability)}
                    subtle={!quantumSummary?.available}
                  />
                </div>

                <p className="mt-3 text-xs leading-relaxed text-gray-400">
                  {quantumSummary?.future_source
                    ? `Future source: ${quantumSummary.future_source}.`
                    : "This block displays the best QUBO result from exported quantum samples when qaoa_limited is run successfully."}
                </p>
              </Panel>
            </div>

            <Panel title="Client Log" className="w-full">
              <div className="h-56 overflow-y-auto rounded-xl bg-black/40 border border-slate-800 p-3 font-mono text-xs text-gray-300">
                {logs.length === 0 ? (
                  <div className="text-gray-500">No log entries yet.</div>
                ) : (
                  logs.map((line, idx) => <div key={idx}>{line}</div>)
                )}
              </div>
            </Panel>

            <Panel title="Backend Optimization Log" className="w-full">
              <p className="mb-2 text-xs text-gray-500">
                Backend logs are streamed through job-status polling. Any ETA inside
                these log lines is the optimizer-internal ETA, while the status bar
                shows the backend live ETA.
              </p>

              <ExportDiagnosticsSummary diagnostics={activeDiagnostics} />

              <div className="h-56 overflow-y-auto rounded-xl bg-black/40 border border-slate-800 p-3 font-mono text-xs text-gray-300">
                {backendOptimizationLogs.length === 0 ? (
                  <div className="text-gray-500">
                    Backend optimization logs are available after workbook inspection
                    or while a backend job is running.
                  </div>
                ) : (
                  backendOptimizationLogs.map((line, idx) => (
                    <div key={idx}>
                      <span className="text-gray-500">{idx + 1}.</span> {line}
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="V9 Type-Budget Diagnostics" tone="amber">
              <TypeConstraintsPanel
                constraints={typeConstraints}
                achievements={typeAchievements}
                currencyCode={currencyCode}
              />
            </Panel>

            {result && !result.error && chartEntries.length > 0 && (
              <Panel title="Offline-Style Charts">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {chartEntries.map(([title, src]) => (
                    <ChartImage key={title} title={title} src={src} />
                  ))}
                </div>
              </Panel>
            )}

            {result && !result.error && circuit !== undefined && (
              <Panel title="Circuit Overview" tone="amber">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6">
                  <div>
                    <InfoRow
                      label="Available"
                      value={formatText(getCircuitValue(circuit, "available"))}
                    />
                    <InfoRow
                      label="Qubits"
                      value={formatText(getCircuitValue(circuit, "n_qubits"))}
                    />
                    <InfoRow
                      label="Layers"
                      value={formatText(getCircuitValue(circuit, "layers"))}
                    />
                    <InfoRow
                      label="Mixer type"
                      value={formatText(getCircuitValue(circuit, "mixer_type"))}
                    />
                    <InfoRow
                      label="Shots mode"
                      value={formatText(getCircuitValue(circuit, "shots_mode"))}
                    />
                    <InfoRow
                      label="QAOA shots"
                      value={
                        formatText(getCircuitValue(circuit, "shots_mode")) === "exact"
                          ? "exact"
                          : formatText(getCircuitValue(circuit, "qaoa_shots"))
                      }
                    />
                  </div>

                  <div>
                    <InfoRow
                      label="Cost terms"
                      value={formatText(getCircuitValue(circuit, "cost_terms"))}
                    />
                    <InfoRow
                      label="QUBO nonzero entries"
                      value={formatText(getCircuitValue(circuit, "qubo_nonzero_entries"))}
                    />
                    <InfoRow
                      label="1Q cost terms"
                      value={formatText(getCircuitValue(circuit, "one_qubit_cost_terms"))}
                    />
                    <InfoRow
                      label="2Q cost terms"
                      value={formatText(getCircuitValue(circuit, "two_qubit_cost_terms"))}
                    />
                    <InfoRow
                      label="1Q gates"
                      value={formatText(getCircuitValue(circuit, "one_qubit_gates"))}
                    />
                    <InfoRow
                      label="2Q gates"
                      value={formatText(getCircuitValue(circuit, "two_qubit_gates"))}
                    />
                  </div>

                  <div>
                    <InfoRow
                      label="Total gates"
                      value={formatText(getCircuitValue(circuit, "total_gates"))}
                    />
                    <InfoRow
                      label="Sequential 2Q depth"
                      value={formatText(getCircuitValue(circuit, "sequential_2q_depth"))}
                    />
                    <InfoRow
                      label="Estimated circuit depth"
                      value={formatText(getCircuitValue(circuit, "estimated_circuit_depth"))}
                    />
                    <InfoRow
                      label="Estimated counts"
                      value={formatText(getCircuitValue(circuit, "counts_are_estimated"))}
                    />
                  </div>
                </div>

                {formatText(getCircuitValue(circuit, "reason"), "") !== "" && (
                  <p className="mt-3 text-xs text-gray-400">
                    {formatText(getCircuitValue(circuit, "reason"))}
                  </p>
                )}
              </Panel>
            )}

            {result && !result.error && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Panel title="Classical Portfolio Metrics">
                  <InfoRow
                    label="Cash weight"
                    value={formatPercent(
                      classicalSummary?.cash_weight ?? metrics.cash_weight,
                      3
                    )}
                  />
                  <InfoRow
                    label="Fixed amount"
                    value={formatCurrency(metrics.fixed_usd, currencyCode)}
                  />
                  <InfoRow
                    label="Variable selected amount"
                    value={formatCurrency(metrics.variable_selected_usd, currencyCode)}
                  />
                  <InfoRow
                    label="Max position amount"
                    value={formatCurrency(metrics.max_position_usd, currencyCode)}
                  />
                  <InfoRow
                    label="Portfolio return"
                    value={formatNumber(
                      classicalSummary?.portfolio_return ?? metrics.portfolio_return,
                      4
                    )}
                  />
                  <InfoRow
                    label="Portfolio volatility"
                    value={formatNumber(
                      classicalSummary?.portfolio_vol ?? metrics.portfolio_vol,
                      4
                    )}
                  />
                  <InfoRow
                    label="Sharpe ratio"
                    value={formatNumber(
                      classicalSummary?.sharpe_like ?? metrics.sharpe_like,
                      4
                    )}
                  />
                  <InfoRow
                    label="Budget-normalized return"
                    value={formatNumber(metrics.portfolio_return_budget_normalized, 4)}
                  />
                  <InfoRow
                    label="Budget-normalized volatility"
                    value={formatNumber(metrics.portfolio_vol_budget_normalized, 4)}
                  />
                  <InfoRow
                    label="Budget-normalized Sharpe ratio"
                    value={formatNumber(metrics.sharpe_like_budget_normalized, 4)}
                  />
                </Panel>

                <Panel title="Quantum Portfolio Metrics" tone="amber">
                  {hasQuantumResult(quantumSummary) ? (
                    <>
                      <InfoRow
                        label="Cash weight"
                        value={formatPercent(quantumSummary?.cash_weight, 3)}
                      />
                      <InfoRow
                        label="Selected amount"
                        value={formatCurrency(quantumSummary?.selected_usd, currencyCode)}
                      />
                      <InfoRow
                        label="Budget gap"
                        value={formatCurrency(quantumSummary?.budget_gap, currencyCode)}
                      />
                      <InfoRow
                        label="Portfolio return"
                        value={formatNumber(quantumSummary?.portfolio_return, 4)}
                      />
                      <InfoRow
                        label="Portfolio volatility"
                        value={formatNumber(quantumSummary?.portfolio_vol, 4)}
                      />
                      <InfoRow
                        label="Sharpe ratio"
                        value={formatNumber(quantumSummary?.sharpe_like, 4)}
                      />
                      <InfoRow
                        label="Probability"
                        value={formatProbability(quantumSummary?.probability)}
                      />
                    </>
                  ) : (
                    <QuantumPlaceholder title={quantumPlaceholderText(quantumSummary)}>
                      Quantum portfolio metrics will be populated from the best
                      QUBO candidate within the exported QAOA sample set once
                      qaoa_limited runs successfully.
                    </QuantumPlaceholder>
                  )}
                </Panel>

                <Panel title="Classical Objective / QUBO Breakdown">
                  <InfoRow
                    label="Return term"
                    value={formatNumber(
                      classicalSummary?.return_term ?? components.return_term,
                      6
                    )}
                  />
                  <InfoRow
                    label="Risk term"
                    value={formatNumber(
                      classicalSummary?.risk_term ?? components.risk_term,
                      6
                    )}
                  />
                  <InfoRow
                    label="Budget term"
                    value={formatNumber(
                      classicalSummary?.budget_term ?? components.budget_term,
                      6
                    )}
                  />
                  <InfoRow
                    label="Type-budget term"
                    value={formatNumber(
                      classicalSummary?.type_budget_term ??
                        classicalSummary?.additional_type_budget_penalty ??
                        components.type_budget_term ??
                        components.additional_type_budget_penalty,
                      6
                    )}
                  />
                  <InfoRow
                    label="QUBO reconstructed"
                    value={formatNumber(components.qubo_reconstructed, 6)}
                  />
                  <InfoRow
                    label="Budget lambda"
                    value={formatNumber(reportingSummary?.budget_lambda, 3)}
                  />
                  <InfoRow
                    label="Risk lambda"
                    value={formatNumber(reportingSummary?.risk_lambda, 3)}
                  />
                  <InfoRow
                    label="Risk-free rate"
                    value={formatPercent(reportingSummary?.risk_free_rate, 2)}
                  />
                </Panel>

                <Panel title="Quantum Objective / QUBO Breakdown" tone="amber">
                  {hasQuantumResult(quantumSummary) ? (
                    <>
                      <InfoRow
                        label="Return term"
                        value={formatNumber(quantumSummary?.return_term, 6)}
                      />
                      <InfoRow
                        label="Risk term"
                        value={formatNumber(quantumSummary?.risk_term, 6)}
                      />
                      <InfoRow
                        label="Budget term"
                        value={formatNumber(quantumSummary?.budget_term, 6)}
                      />
                      <InfoRow
                        label="Type-budget term"
                        value={formatNumber(
                          quantumSummary?.type_budget_term ??
                            quantumSummary?.additional_type_budget_penalty,
                          6
                        )}
                      />
                      <InfoRow
                        label="QUBO value"
                        value={formatNumber(quantumSummary?.qubo_value, 6)}
                      />
                      <InfoRow
                        label="Probability"
                        value={formatProbability(quantumSummary?.probability)}
                      />
                    </>
                  ) : (
                    <QuantumPlaceholder title={quantumPlaceholderText(quantumSummary)}>
                      Quantum QUBO terms will be populated from QAOA_Samples and
                      QAOA_Best_QUBO once qaoa_limited runs successfully.
                    </QuantumPlaceholder>
                  )}
                </Panel>
              </div>
            )}

            {portfolioContents.length > 0 && (
              <Panel title="Classical Portfolio Contents">
                <PortfolioContentsTable
                  rows={portfolioContents}
                  currencyCode={currencyCode}
                />
              </Panel>
            )}

            {result && !result.error && (
              <Panel title="Quantum Portfolio Contents" tone="amber">
                {quantumPortfolioContents.length > 0 ? (
                  <PortfolioContentsTable
                    rows={quantumPortfolioContents}
                    currencyCode={currencyCode}
                  />
                ) : (
                  <QuantumPlaceholder title="No quantum portfolio contents">
                    No quantum portfolio contents are available for the selected
                    quantum candidate. This usually means no quantum bitstring was
                    returned or the frontend could not map the bitstring back to
                    portfolio rows.
                  </QuantumPlaceholder>
                )}
              </Panel>
            )}

            {result && !result.error && (
              <Panel title="Top Classical Candidates">
                {classicalCandidates.length > 0 ? (
                  <CandidateTable rows={classicalCandidates} currencyCode={currencyCode} />
                ) : (
                  <p className="text-gray-400 text-xs">
                    Use standard/full response level to display classical
                    candidates.
                  </p>
                )}
              </Panel>
            )}

            {result && !result.error && (
              <Panel title="Top Quantum Candidates" tone="amber">
                {qaoaBestQubo.length > 0 || quantumSamples.length > 0 ? (
                  <CandidateTable
                    rows={qaoaBestQubo.length > 0 ? qaoaBestQubo : quantumSamples}
                    currencyCode={currencyCode}
                    showProbability
                  />
                ) : (
                  <QuantumPlaceholder title="No QAOA samples available">
                    No QAOA samples are available in the current response. This
                    section will show the best QUBO candidates from exported
                    QAOA samples once qaoa_limited completes successfully.
                  </QuantumPlaceholder>
                )}
              </Panel>
            )}

            {solverComparison.length > 0 && (
              <Panel title="Solver Comparison">
                <CandidateTable rows={solverComparison} currencyCode={currencyCode} />
              </Panel>
            )}

            {result && !result.error && (
              <Panel title="Diagnostics">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-6">
                  <div>
                    <InfoRow
                      label="Actual runtime"
                      value={`${formatNumber(diagnostics.actual_runtime_sec, 3)} sec`}
                    />
                    <InfoRow
                      label="Raw estimate"
                      value={`${formatNumber(
                        diagnostics.raw_estimated_runtime_sec,
                        3
                      )} sec`}
                    />
                    <InfoRow
                      label="Calibrated estimate"
                      value={`${formatNumber(
                        diagnostics.estimated_runtime_sec,
                        3
                      )} sec`}
                    />
                    <InfoRow
                      label="ETA range"
                      value={formatEtaRange(
                        diagnostics.eta_seconds_low,
                        diagnostics.eta_seconds_high
                      )}
                    />
                    <InfoRow
                      label="Runtime ratio"
                      value={formatNumber(diagnostics.runtime_ratio, 2)}
                    />
                  </div>
                  <div>
                    <InfoRow
                      label="Runtime inputs"
                      value={formatRuntimeInputs(diagnostics.runtime_inputs)}
                    />
                    <InfoRow
                      label="Effective random seed"
                      value={formatText(getEffectiveRandomSeed(diagnostics), "auto")}
                    />
                    <InfoRow
                      label="Usage level"
                      value={formatText(diagnostics.usage_level)}
                    />
                    <InfoRow
                      label="Backend service"
                      value={formatText(diagnostics.service)}
                    />
                    <InfoRow
                      label="Model version"
                      value={formatText(result.model_version)}
                    />
                    <InfoRow
                      label="Workbook warnings"
                      value={formatText(diagnostics.workbook_warning_count ?? 0)}
                    />
                  </div>
                  <div>
                    <InfoRow
                      label="QUBO shape"
                      value={formatQuboShape(diagnostics.qubo_shape)}
                    />
                    <InfoRow
                      label="QUBO nonzero entries"
                      value={formatText(diagnostics.qubo_nonzero_entries)}
                    />
                    <InfoRow
                      label="Additional type constraints"
                      value={formatText(additionalTypeConstraintCount)}
                    />
                    <InfoRow
                      label="Classical candidates"
                      value={formatText(
                        reportingSummary?.classical_candidate_count ??
                          diagnostics.classical_candidate_count
                      )}
                    />
                  </div>
                  <div>
                    <InfoRow
                      label="QAOA candidates"
                      value={formatText(reportingSummary?.qaoa_candidate_count ?? 0)}
                    />
                    <InfoRow
                      label="QAOA p"
                      value={formatText(reportingSummary?.qaoa_p)}
                    />
                    <InfoRow label="Shots mode" value={formatText(shotsMode)} />
                    <InfoRow
                      label="QAOA shots"
                      value={qaoaShotsDisplay || formatText(qaoaShots)}
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs">
                  <div className="text-gray-400 mb-1">QAOA status</div>
                  <div className="text-gray-100 break-words">
                    {formatText(reportingSummary?.qaoa_status)}
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs">
                  <div className="text-cyan-100 font-semibold mb-2">
                    Export diagnostics
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6">
                    <div>
                      <InfoRow
                        label="Classical requested"
                        value={formatText(diagnostics.classical_export_requested_rows)}
                      />
                      <InfoRow
                        label="Classical actual"
                        value={formatText(diagnostics.classical_export_actual_rows)}
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
                        label="QAOA requested"
                        value={formatText(diagnostics.qaoa_export_requested_rows)}
                      />
                      <InfoRow
                        label="QAOA actual"
                        value={formatText(diagnostics.qaoa_export_actual_rows)}
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
                    <div>
                      <InfoRow
                        label="QAOA state space"
                        value={formatText(diagnostics.qaoa_exact_state_space)}
                      />
                      <InfoRow
                        label="States evaluated"
                        value={formatText(diagnostics.qaoa_exact_states_evaluated)}
                      />
                      <InfoRow
                        label="States exported"
                        value={formatText(diagnostics.qaoa_exact_states_exported)}
                      />
                    </div>
                  </div>
                </div>
              </Panel>
            )}

            {jobStatus && (
              <details className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <summary className="cursor-pointer text-cyan-200 font-semibold text-sm">
                  Raw Job Status
                </summary>
                <pre className="mt-3 overflow-x-auto text-xs text-gray-300 bg-black/40 rounded-xl p-3">
                  {JSON.stringify(jobStatus, null, 2)}
                </pre>
              </details>
            )}

            {result && (
              <details className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <summary className="cursor-pointer text-cyan-200 font-semibold text-sm">
                  Raw JSON
                </summary>
                <pre className="mt-3 overflow-x-auto text-xs text-gray-300 bg-black/40 rounded-xl p-3">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </section>
    </AppLayout>
  );
}