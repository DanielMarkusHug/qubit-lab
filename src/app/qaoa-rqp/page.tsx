"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
    best_overview_cash_weight?: number;
    optimization_iterations?: number;
  };
  classical_candidates?: CandidateRow[];
  quantum_samples?: CandidateRow[];
  qaoa_best_qubo?: CandidateRow[];
  solver_comparison?: CandidateRow[];
  portfolio_contents?: CandidateRow[];
  optimization_history?: CandidateRow[];
  charts?: {
    risk_return_sharpe?: string | null;
    risk_return_qubo?: string | null;
    qubo_breakdown?: string | null;
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
  diagnostics?: Record<string, unknown>;
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
};

type RuntimeEstimate = {
  mode?: string;
  estimated_runtime_sec?: number;
  max_estimated_runtime_sec?: number;
  within_limit?: boolean;
  limit_source?: string;
  basis?: {
    n_qubits?: number;
    layers?: number;
    iterations?: number;
    restarts?: number;
    warm_start?: boolean;
  };
};

type InspectResult = {
  status?: string;
  filename?: string;
  license?: LicenseStatus;
  workbook_summary?: InspectWorkbookSummary;
  runtime_estimate?: RuntimeEstimate;
  diagnostics?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

const API_URL =
  process.env.NEXT_PUBLIC_QAOA_RQP_API_URL ??
  "https://qaoa-rqp-api-186148318189.europe-west6.run.app";

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && !Number.isNaN(value) ? value : undefined;
}

function formatNumber(value: unknown, digits = 3) {
  const number = getNumber(value);
  if (number === undefined) return "n/a";
  return number.toLocaleString("en-US", {
    maximumFractionDigits: digits,
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

  const parts = [
    layers !== undefined ? `layers=${layers}` : null,
    iterations !== undefined ? `iterations=${iterations}` : null,
    restarts !== undefined ? `restarts=${restarts}` : null,
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

function getGeneralLimits(license?: LicenseStatus | null): LimitBlock | undefined {
  return license?.general_limits ?? license?.limits;
}

function getQaoaLimitedLimits(license?: LicenseStatus | null): LimitBlock | undefined {
  return license?.qaoa_limited_limits ?? license?.limits?.qaoa_limited;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
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
    return `text-base font-semibold leading-snug break-words ${
      subtle ? "text-gray-300" : "text-cyan-100"
    }`;
  }

  return `text-2xl font-bold leading-tight break-words ${
    subtle ? "text-gray-300" : "text-cyan-200"
  }`;
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
    <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4 min-w-0">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
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
    <div className="flex items-start justify-between gap-4 border-b border-slate-800 py-2 text-sm">
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
      className={`rounded-2xl border ${borderClass} bg-slate-950/70 p-5 shadow-lg ${className}`}
    >
      <h2 className={`text-xl font-bold mb-4 ${titleClass}`}>{title}</h2>
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
    <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-100/80">
      <div className="font-semibold text-amber-200 mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function ChartImage({ title, src }: { title: string; src: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
      <h3 className="text-sm font-semibold text-cyan-100 mb-3">{title}</h3>
      <img
        src={src}
        alt={title}
        className="w-full rounded-lg border border-slate-800 bg-white"
      />
    </div>
  );
}

function ProgressBar({
  visible,
  progress,
  message,
  etaSeconds,
  onStop,
}: {
  visible: boolean;
  progress: number;
  message: string;
  etaSeconds?: number;
  onStop?: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="mb-6 rounded-2xl border border-cyan-900/60 bg-slate-950/80 p-4 shadow-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-cyan-100">{message}</div>
          <div className="text-sm text-gray-400">
            {etaSeconds !== undefined && etaSeconds > 0
              ? `Estimated remaining: ~${Math.ceil(etaSeconds)} sec`
              : "Running..."}
          </div>
        </div>

        {onStop && (
          <button
            onClick={onStop}
            className="rounded-lg border border-red-800 bg-red-950/60 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-900/70"
          >
            Stop request
          </button>
        )}
      </div>

      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-400 transition-all duration-500"
          style={{ width: `${Math.max(5, Math.min(progress, 100))}%` }}
        />
      </div>
    </div>
  );
}

function getBitIndexLabel(block: CandidateRow) {
  const role = String(block.decision_role ?? "").toLowerCase();
  if (role === "fixed") return "fixed";
  return formatText(block.variable_bit_index);
}

function getRankLabel(block: CandidateRow) {
  const role = String(block.decision_role ?? "").toLowerCase();
  if (block.rank !== undefined && block.rank !== null) return formatText(block.rank);
  if (role === "fixed") return "fixed";
  return "";
}

function getSourceLabel(block: CandidateRow) {
  const role = String(block.decision_role ?? "").toLowerCase();
  if (block.source !== undefined && block.source !== null) return formatText(block.source);
  if (role === "fixed") return "fixed";
  return "";
}

function hasQuantumResult(summary?: ReportingSummaryBlock) {
  return Boolean(summary?.available);
}

function quantumPlaceholderText(summary?: ReportingSummaryBlock) {
  return summary?.status ?? "Disabled / Not available";
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-gray-400 border-b border-slate-700">
          <tr>
            <th className="py-2 pr-4">Rank</th>
            <th className="py-2 pr-4">Source</th>
            <th className="py-2 pr-4">Bitstring</th>
            {showProbability && <th className="py-2 pr-4">Probability</th>}
            <th className="py-2 pr-4">QUBO</th>
            <th className="py-2 pr-4">Selected amount</th>
            <th className="py-2 pr-4">Budget gap</th>
            <th className="py-2 pr-4">Return</th>
            <th className="py-2 pr-4">Volatility</th>
            <th className="py-2 pr-4">Sharpe ratio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((candidate, idx) => (
            <tr key={idx} className="border-b border-slate-800">
              <td className="py-2 pr-4 text-gray-300">
                {formatText(candidate.rank ?? idx + 1)}
              </td>
              <td className="py-2 pr-4 text-gray-400">
                {formatText(candidate.source ?? candidate.solver)}
              </td>
              <td className="py-2 pr-4 font-mono text-cyan-200">
                {formatText(candidate.bitstring)}
              </td>
              {showProbability && (
                <td className="py-2 pr-4 text-gray-300">
                  {formatNumber(candidate.probability, 6)}
                </td>
              )}
              <td className="py-2 pr-4 text-gray-300">
                {formatNumber(candidate.qubo_value ?? candidate.qubo_reconstructed, 6)}
              </td>
              <td className="py-2 pr-4 text-gray-300">
                {formatCurrency(candidate.selected_usd, currencyCode)}
              </td>
              <td className="py-2 pr-4 text-gray-300">
                {formatCurrency(candidate.budget_gap, currencyCode)}
              </td>
              <td className="py-2 pr-4 text-gray-300">
                {formatNumber(candidate.portfolio_return, 4)}
              </td>
              <td className="py-2 pr-4 text-gray-300">
                {formatNumber(candidate.portfolio_vol, 4)}
              </td>
              <td className="py-2 pr-4 text-gray-300">
                {formatNumber(candidate.sharpe_like, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function QaoaRqpPage() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const inspectAbortControllerRef = useRef<AbortController | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [mode, setMode] = useState("classical_only");
  const [responseLevel, setResponseLevel] = useState("compact");

  const [layers, setLayers] = useState(1);
  const [iterations, setIterations] = useState(80);
  const [restarts, setRestarts] = useState(1);
  const [warmStart, setWarmStart] = useState(false);
  const [budgetLambda, setBudgetLambda] = useState(50);
  const [riskLambda, setRiskLambda] = useState(6);
  const [riskFreeRate, setRiskFreeRate] = useState(0.04);
  const [qaoaShots, setQaoaShots] = useState(4096);
  const [restartPerturbation, setRestartPerturbation] = useState(0.05);

  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [inspectResult, setInspectResult] = useState<InspectResult | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [etaBasisSec, setEtaBasisSec] = useState<number | null>(null);

  const diagnostics = result?.diagnostics ?? {};
  const metrics = result?.portfolio_metrics ?? {};
  const components = result?.components ?? {};
  const reporting = result?.reporting;
  const reportingSummary = reporting?.summary;
  const classicalSummary = reportingSummary?.classical_result_summary;
  const quantumSummary = reportingSummary?.quantum_result_summary;

  const inspectSummary = inspectResult?.workbook_summary;
  const inspectRuntimeEstimate = inspectResult?.runtime_estimate;
  const inspectDiagnostics = inspectResult?.diagnostics ?? {};

  const currencyCode =
    reportingSummary?.currency_code ?? inspectSummary?.currency_code ?? "USD";

  const charts = reporting?.charts ?? {};
  const classicalCandidates =
    reporting?.classical_candidates ?? result?.top_candidates ?? [];
  const portfolioContents =
    reporting?.portfolio_contents ?? result?.selected_blocks ?? [];
  const solverComparison = reporting?.solver_comparison ?? [];
  const quantumSamples = reporting?.quantum_samples ?? [];
  const qaoaBestQubo = reporting?.qaoa_best_qubo ?? [];

  const backendOptimizationLogs =
    getStringArray(diagnostics.logs).length > 0
      ? getStringArray(diagnostics.logs)
      : getStringArray(inspectDiagnostics.logs);

  const chartEntries = [
    ["Risk / Return / Sharpe ratio", charts.risk_return_sharpe],
    ["Risk / Return / QUBO", charts.risk_return_qubo],
    ["QUBO Breakdown", charts.qubo_breakdown],
    ["Solver Comparison", charts.solver_comparison],
  ].filter(([, src]) => typeof src === "string" && src.length > 0) as [
    string,
    string
  ][];

  const canRun = useMemo(() => {
    return !!file && !loading && !inspecting;
  }, [file, loading, inspecting]);

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
    const backendEstimate = getNumber(inspectRuntimeEstimate?.estimated_runtime_sec);
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
    mode,
    knownQubits,
    layers,
    iterations,
    restarts,
    warmStart,
    runtimeCap,
  ]);

  const estimatedRemainingSec = useMemo(() => {
    if (!loading || runStartedAt === null || etaBasisSec === null) return undefined;
    const elapsed = (Date.now() - runStartedAt) / 1000;
    return Math.max(etaBasisSec - elapsed, 0);
  }, [loading, runStartedAt, etaBasisSec, progress]);

  useEffect(() => {
    if (!loading) return;

    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        if (prev < 25) return prev + 4;
        if (prev < 60) return prev + 2;
        return prev + 0.75;
      });
    }, 700);

    return () => window.clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!file) {
      setInspectResult(null);
      return;
    }

    const timer = window.setTimeout(() => {
      inspectWorkbook();
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
  ]);

  function addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 80));
  }

  function stopCurrentRequest() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog("Stop requested by user.");
      setProgressMessage("Stopping request...");
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
      formData.append("layers", String(layers));
      formData.append("iterations", String(iterations));
      formData.append("restarts", String(restarts));
      formData.append("warm_start", String(warmStart));
      formData.append("lambda_budget", String(budgetLambda));
      formData.append("lambda_variance", String(riskLambda));
      formData.append("risk_free_rate", String(riskFreeRate));
      formData.append("qaoa_shots", String(qaoaShots));
      formData.append("restart_perturbation", String(restartPerturbation));

      const res = await fetch(`${API_URL}/inspect-workbook`, {
        method: "POST",
        headers: apiKey ? { "X-API-Key": apiKey } : {},
        body: formData,
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok || data.status === "error") {
        setInspectResult(data);
        addLog(`Workbook inspection failed: ${data?.error?.message ?? res.statusText}`);
        return;
      }

      setInspectResult(data);

      if (data.license) {
        setLicense(data.license);
      }

      const n =
        data?.workbook_summary?.decision_variables ??
        data?.workbook_summary?.n_qubits ??
        "n/a";

      const eta = data?.runtime_estimate?.estimated_runtime_sec;

      addLog(
        `Workbook inspected. Decision variables: ${n}. Runtime estimate: ${
          eta !== undefined ? formatSeconds(eta) : "n/a"
        }.`
      );
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

  async function checkLicense() {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setResult(null);
    setProgress(10);
    setProgressMessage("Checking license status...");
    setRunStartedAt(Date.now());
    setEtaBasisSec(null);

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
        `License active: ${data.display_name ?? data.usage_level ?? "unknown level"}`
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
        setRunStartedAt(null);
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

    setLoading(true);
    setResult(null);
    setProgress(5);
    setProgressMessage("Uploading Excel file...");
    setRunStartedAt(Date.now());
    setEtaBasisSec(preRunEstimateSec ?? null);

    try {
      if (mode === "qaoa_limited") {
        addLog("Running QAOA limited mode...");
      }

      if (mode === "qaoa_full") {
        addLog("QAOA full mode is currently disabled. Use qaoa_limited.");
      }

      addLog("Uploading Excel file...");
      setProgressMessage(
        mode === "classical_only"
          ? "Running classical optimization..."
          : mode === "qaoa_limited"
            ? "Running QAOA limited mode..."
            : "Submitting selected mode to backend..."
      );
      addLog(
        mode === "classical_only"
          ? "Running classical optimization..."
          : mode === "qaoa_limited"
            ? "Running QAOA limited mode..."
            : "Submitting selected mode to backend..."
      );

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

      const res = await fetch(`${API_URL}/run-qaoa`, {
        method: "POST",
        headers: apiKey ? { "X-API-Key": apiKey } : {},
        body: formData,
        signal: controller.signal,
      });

      const data = await res.json();
      setResult(data);

      if (!res.ok || data.status === "error") {
        addLog(`Run failed: ${data?.error?.message ?? res.statusText}`);
        setProgress(100);
        return;
      }

      if (data?.diagnostics?.estimated_runtime_sec !== undefined) {
        addLog(
          `Estimated runtime: ${formatNumber(
            data.diagnostics.estimated_runtime_sec,
            3
          )} sec`
        );
      }

      if (data?.diagnostics?.actual_runtime_sec !== undefined) {
        addLog(
          `Actual runtime: ${formatNumber(
            data.diagnostics.actual_runtime_sec,
            3
          )} sec`
        );
      }

      addLog(`Run completed. Best bitstring: ${data.best_bitstring ?? "n/a"}`);
      setProgressMessage("Run completed.");
      setProgress(100);

      if (data.license) {
        setLicense(data.license);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        addLog("Run stopped by user.");
        setProgressMessage("Run stopped.");
      } else {
        addLog(`Run failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      abortControllerRef.current = null;
      window.setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setProgressMessage("");
        setRunStartedAt(null);
        setEtaBasisSec(null);
      }, 600);
    }
  }

  const workbookSummary = [
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

      <section className="max-w-[1920px] mx-auto px-4 sm:px-6 xl:px-10 2xl:px-14 pt-24 pb-16">
        <h1 className="text-4xl font-bold text-cyan-300 mb-3">QAOA RQP</h1>

        <p className="text-cyan-100 text-lg font-semibold mb-5">
          Excel-to-Quantum portfolio optimization prototype.
        </p>

        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-8 max-w-6xl">
          Rapid Quantum Prototype for portfolio optimization. Upload an Excel
          configuration, select the optimization settings, and run the backend
          service hosted on Cloud Run.
          <br />
          <br />
          The current cloud version supports the controlled classical path and a
          key-limited qaoa_limited mode. Full QAOA remains disabled until the
          future job-based execution path is implemented.
        </p>

        <ProgressBar
          visible={loading}
          progress={progress}
          message={progressMessage}
          etaSeconds={estimatedRemainingSec}
          onStop={stopCurrentRequest}
        />

        <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
          <div className="2xl:col-span-3 space-y-6">
            <Panel title="Access">
              <label className="block text-sm text-gray-300 mb-2">
                License key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your license key"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-gray-100 focus:outline-none focus:border-cyan-400"
              />

              <button
                onClick={checkLicense}
                disabled={loading}
                className="mt-4 w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-slate-950 font-semibold py-2"
              >
                Check License
              </button>

              {license && (
                <div className="mt-4 rounded-xl bg-slate-900/80 border border-slate-700 p-4 text-sm text-gray-200">
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

                  <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                    <div className="text-xs font-semibold text-cyan-100 mb-2">
                      General limits
                    </div>
                    <div className="text-xs leading-relaxed text-gray-300 break-words">
                      {formatLimitBlock(getGeneralLimits(license))}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-amber-900/60 bg-amber-950/20 p-3">
                    <div className="text-xs font-semibold text-amber-200 mb-2">
                      QAOA limited limits
                    </div>
                    <div className="text-xs leading-relaxed text-amber-100/80 break-words">
                      {formatLimitBlock(getQaoaLimitedLimits(license))}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                    <div className="text-xs font-semibold text-cyan-100 mb-2">
                      Allowed modes
                    </div>
                    <div className="text-xs leading-relaxed text-gray-300 break-words">
                      {formatText(license.allowed_modes)}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                    <div className="text-xs font-semibold text-cyan-100 mb-2">
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
                  setResult(null);
                  setInspectResult(null);
                }}
                className="w-full text-sm text-gray-200 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950 hover:file:bg-cyan-400"
              />

              {file && (
                <p className="mt-3 text-sm text-gray-400">
                  Selected: <span className="text-gray-200">{file.name}</span>
                </p>
              )}

              <div className="mt-4 rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-cyan-100 mb-2">
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
                  <p className="text-xs text-red-200 mb-2">
                    Inspection failed: {inspectResult.error.message ?? "unknown error"}
                  </p>
                )}

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
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  Fixed blocks are included in every portfolio. Only variable
                  blocks become QUBO decision variables / qubits.
                </p>
              </div>
            </Panel>

            <Panel title="Optimization Settings">
              <label className="block text-sm text-gray-300 mb-2">Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-gray-100 mb-4"
              >
                <option value="classical_only">classical_only</option>
                <option value="qaoa_limited">qaoa_limited</option>
                <option value="qaoa_full">qaoa_full disabled</option>
              </select>

              {mode === "qaoa_limited" && (
                <div className="mb-4 rounded-xl border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-100">
                  QAOA limited mode runs the controlled synchronous QAOA path.
                  The effective limits depend on the active license key.
                </div>
              )}

              {mode === "qaoa_full" && (
                <div className="mb-4 rounded-xl border border-yellow-700 bg-yellow-950/30 p-3 text-sm text-yellow-100">
                  QAOA full mode is reserved for the future job-based execution
                  path and is disabled for now. Use qaoa_limited for current
                  cloud runs.
                </div>
              )}

              <label className="block text-sm text-gray-300 mb-2">
                Response level
              </label>
              <select
                value={responseLevel}
                onChange={(e) => setResponseLevel(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-gray-100 mb-4"
              >
                <option value="compact">compact</option>
                <option value="standard">standard</option>
                <option value="full">full</option>
              </select>

              <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-sm">
                <div className="text-xs font-semibold text-cyan-100 mb-2">
                  Pre-run runtime estimate
                </div>

                <button
                  onClick={inspectWorkbook}
                  disabled={!file || inspecting || loading}
                  className="mb-3 w-full rounded-lg border border-cyan-800 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-slate-900 disabled:text-gray-500 disabled:border-slate-800"
                >
                  {inspecting ? "Recalculating..." : "Recalculate estimate"}
                </button>

                <InfoRow
                  label="Estimated runtime"
                  value={
                    preRunEstimateSec === undefined
                      ? "disabled / future job mode"
                      : `~${formatSeconds(preRunEstimateSec)}`
                  }
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
                  This estimate is provided by the backend after workbook inspection.
                  The backend remains the authority for runtime checks and execution.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Layers
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={layers}
                    onChange={(e) => setLayers(Number(e.target.value))}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Iterations
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={iterations}
                    onChange={(e) => setIterations(Number(e.target.value))}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Restarts
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={restarts}
                    onChange={(e) => setRestarts(Number(e.target.value))}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    QAOA shots
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={qaoaShots}
                    onChange={(e) => setQaoaShots(Number(e.target.value))}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Budget lambda
                  </label>
                  <input
                    type="number"
                    value={budgetLambda}
                    onChange={(e) => setBudgetLambda(Number(e.target.value))}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Risk lambda
                  </label>
                  <input
                    type="number"
                    value={riskLambda}
                    onChange={(e) => setRiskLambda(Number(e.target.value))}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Risk-free rate
                  </label>
                  <input
                    type="number"
                    step={0.001}
                    value={riskFreeRate}
                    onChange={(e) => setRiskFreeRate(Number(e.target.value))}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Restart perturbation
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    value={restartPerturbation}
                    onChange={(e) => setRestartPerturbation(Number(e.target.value))}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-gray-100"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm text-gray-300 mb-4">
                <input
                  type="checkbox"
                  checked={warmStart}
                  onChange={(e) => setWarmStart(e.target.checked)}
                  className="h-4 w-4"
                />
                Warm start
              </label>

              <p className="mb-2 text-xs leading-relaxed text-gray-500">
                QAOA limited mode is available for controlled key-based runs.
                Full QAOA remains disabled for now and will later use a
                job-based flow.
              </p>
              <p className="mb-5 text-xs leading-relaxed text-gray-500">
                QAOA shots are used only when sampling mode is active; exact
                mode ignores shots.
              </p>

              <button
                onClick={runOptimization}
                disabled={!canRun}
                className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-slate-950 font-semibold py-3"
              >
                {loading ? "Running..." : "Run Optimization"}
              </button>
            </Panel>
          </div>

          <div className="2xl:col-span-9 space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Panel title="Classical Result Summary">
                {!result && (
                  <p className="text-gray-400">
                    Run an optimization to see the classical result summary here.
                  </p>
                )}

                {result?.error && (
                  <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-100">
                    <div className="font-semibold">
                      {result.error.code ?? "Error"}
                    </div>
                    <div className="text-sm mt-1">
                      {result.error.message ?? "The backend returned an error."}
                    </div>
                  </div>
                )}

                {result && !result.error && (
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                    <MetricCard
                      label="Objective"
                      value={formatNumber(
                        classicalSummary?.objective ?? result.objective,
                        4
                      )}
                    />
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
                  </div>
                )}
              </Panel>

              <Panel title="Quantum Result Summary" tone="amber">
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  <MetricCard
                    label="Status"
                    value={formatText(
                      quantumSummary?.status ?? "Disabled / Not available"
                    )}
                    subtle={!quantumSummary?.available}
                    kind="text"
                  />
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
                    label="Probability"
                    value={formatNumber(quantumSummary?.probability, 6)}
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
                </div>

                <p className="mt-4 text-sm leading-relaxed text-gray-400">
                  {quantumSummary?.future_source
                    ? `Future source: ${quantumSummary.future_source}.`
                    : "This block displays the best QUBO result from exported quantum samples when qaoa_limited is run successfully."}
                </p>
              </Panel>
            </div>

            <Panel title="Client Log" className="w-full">
              <div className="h-72 overflow-y-auto rounded-xl bg-black/40 border border-slate-800 p-4 font-mono text-sm text-gray-300">
                {logs.length === 0 ? (
                  <div className="text-gray-500">No log entries yet.</div>
                ) : (
                  logs.map((line, idx) => <div key={idx}>{line}</div>)
                )}
              </div>
            </Panel>

            <Panel title="Backend Optimization Log" className="w-full">
              <div className="h-72 overflow-y-auto rounded-xl bg-black/40 border border-slate-800 p-4 font-mono text-sm text-gray-300">
                {backendOptimizationLogs.length === 0 ? (
                  <div className="text-gray-500">
                    Backend optimization logs are available after workbook inspection
                    or after a run.
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

            {result && !result.error && chartEntries.length > 0 && (
              <Panel title="Offline-Style Charts">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {chartEntries.map(([title, src]) => (
                    <ChartImage key={title} title={title} src={src} />
                  ))}
                </div>
              </Panel>
            )}

            {result && !result.error && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
                        value={formatNumber(quantumSummary?.probability, 6)}
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
                        label="QUBO value"
                        value={formatNumber(quantumSummary?.qubo_value, 6)}
                      />
                      <InfoRow
                        label="Probability"
                        value={formatNumber(quantumSummary?.probability, 6)}
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-gray-400 border-b border-slate-700">
                      <tr>
                        <th className="py-2 pr-4">Rank</th>
                        <th className="py-2 pr-4">Source</th>
                        <th className="py-2 pr-4">Ticker</th>
                        <th className="py-2 pr-4">Company</th>
                        <th className="py-2 pr-4">Role</th>
                        <th className="py-2 pr-4">Option</th>
                        <th className="py-2 pr-4">Cost</th>
                        <th className="py-2 pr-4">Shares</th>
                        <th className="py-2 pr-4">Decision ID</th>
                        <th className="py-2 pr-4">Bit Index</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioContents.map((block, idx) => (
                        <tr key={idx} className="border-b border-slate-800">
                          <td className="py-2 pr-4 text-gray-300">
                            {getRankLabel(block)}
                          </td>
                          <td className="py-2 pr-4 text-gray-400">
                            {getSourceLabel(block)}
                          </td>
                          <td className="py-2 pr-4 text-cyan-200">
                            {formatText(block.Ticker)}
                          </td>
                          <td className="py-2 pr-4 text-gray-200">
                            {formatText(block.Company)}
                          </td>
                          <td className="py-2 pr-4 text-gray-300">
                            {formatText(block.decision_role)}
                          </td>
                          <td className="py-2 pr-4 text-gray-300">
                            {formatText(block["Option Label"])}
                          </td>
                          <td className="py-2 pr-4 text-gray-300">
                            {formatCurrency(block["Approx Cost USD"], currencyCode)}
                          </td>
                          <td className="py-2 pr-4 text-gray-300">
                            {formatText(block.Shares)}
                          </td>
                          <td className="py-2 pr-4 text-gray-400">
                            {formatText(block.decision_id)}
                          </td>
                          <td className="py-2 pr-4 text-gray-400">
                            {getBitIndexLabel(block)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}

            {result && !result.error && (
              <Panel title="Quantum Portfolio Contents" tone="amber">
                {hasQuantumResult(quantumSummary) ? (
                  <p className="text-gray-400 text-sm">
                    Quantum portfolio contents will be displayed here once the
                    backend returns portfolio rows tagged for the selected
                    quantum best-QUBO candidate.
                  </p>
                ) : (
                  <QuantumPlaceholder title="No quantum portfolio contents">
                    No quantum portfolio contents are available in the current
                    response. This section will use the best QUBO candidate
                    within exported QAOA samples once the backend provides the
                    corresponding portfolio rows.
                  </QuantumPlaceholder>
                )}
              </Panel>
            )}

            {result && !result.error && (
              <Panel title="Top Classical Candidates">
                {classicalCandidates.length > 0 ? (
                  <CandidateTable rows={classicalCandidates} currencyCode={currencyCode} />
                ) : (
                  <p className="text-gray-400 text-sm">
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8">
                  <div>
                    <InfoRow
                      label="Actual runtime"
                      value={`${formatNumber(diagnostics.actual_runtime_sec, 3)} sec`}
                    />
                    <InfoRow
                      label="Estimated runtime"
                      value={`${formatNumber(
                        diagnostics.estimated_runtime_sec,
                        3
                      )} sec`}
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
                      label="Usage level"
                      value={formatText(diagnostics.usage_level)}
                    />
                    <InfoRow
                      label="Model version"
                      value={formatText(result.model_version)}
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
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm">
                  <div className="text-gray-400 mb-1">QAOA status</div>
                  <div className="text-gray-100 break-words">
                    {formatText(reportingSummary?.qaoa_status)}
                  </div>
                </div>
              </Panel>
            )}

            {result && (
              <details className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <summary className="cursor-pointer text-cyan-200 font-semibold">
                  Raw JSON
                </summary>
                <pre className="mt-4 overflow-x-auto text-xs text-gray-300 bg-black/40 rounded-xl p-4">
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