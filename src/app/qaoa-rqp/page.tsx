"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";

type LicenseStatus = {
  authenticated: boolean;
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
  allowed_modes?: string[];
  allowed_response_levels?: string[];
  limits?: {
    max_qubits?: number;
    max_layers?: number;
    max_iterations?: number;
    max_restarts?: number;
    max_upload_mb?: number;
    max_estimated_runtime_sec?: number;
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

  return [
    layers !== undefined ? `layers=${layers}` : null,
    iterations !== undefined ? `iterations=${iterations}` : null,
    restarts !== undefined ? `restarts=${restarts}` : null,
  ]
    .filter(Boolean)
    .join(", ");
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
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-100 text-right break-words">{value ?? "n/a"}</span>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-cyan-900/60 bg-slate-950/70 p-5 shadow-lg ${className}`}
    >
      <h2 className="text-xl font-bold text-cyan-200 mb-4">{title}</h2>
      {children}
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
}: {
  visible: boolean;
  progress: number;
  message: string;
  etaSeconds?: number;
}) {
  if (!visible) return null;

  return (
    <div className="mb-6 rounded-2xl border border-cyan-900/60 bg-slate-950/80 p-4 shadow-lg">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-semibold text-cyan-100">{message}</div>
        <div className="text-sm text-gray-400">
          {etaSeconds !== undefined && etaSeconds > 0
            ? `Estimated remaining: ~${Math.ceil(etaSeconds)} sec`
            : "Running..."}
        </div>
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
            <th className="py-2 pr-4">Sharpe ratio (proxy)</th>
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
  const currencyCode = reportingSummary?.currency_code ?? "USD";

  const charts = reporting?.charts ?? {};
  const classicalCandidates =
    reporting?.classical_candidates ?? result?.top_candidates ?? [];
  const portfolioContents =
    reporting?.portfolio_contents ?? result?.selected_blocks ?? [];
  const solverComparison = reporting?.solver_comparison ?? [];
  const quantumSamples = reporting?.quantum_samples ?? [];
  const qaoaBestQubo = reporting?.qaoa_best_qubo ?? [];
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
    return !!file && !loading;
  }, [file, loading]);

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

  function addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 80));
  }

  async function checkLicense() {
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
      addLog(`License check failed: ${err instanceof Error ? err.message : String(err)}`);
      setLicense(null);
    } finally {
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

    setLoading(true);
    setResult(null);
    setProgress(5);
    setProgressMessage("Uploading Excel file...");
    setRunStartedAt(Date.now());

    const previousEstimate = getNumber(diagnostics.estimated_runtime_sec);
    setEtaBasisSec(previousEstimate ?? null);

    try {
      if (mode !== "classical_only") {
        addLog("QAOA execution is currently disabled in this cloud version.");
      }

      addLog("Uploading Excel file...");
      setProgressMessage(
        mode === "classical_only"
          ? "Running classical optimization..."
          : "Submitting selected mode to backend..."
      );
      addLog(
        mode === "classical_only"
          ? "Running classical optimization..."
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

      addLog(`Run completed. Best bitstring: ${data.best_bitstring ?? "n/a"}`);
      setProgressMessage("Run completed.");
      setProgress(100);

      if (data.license) {
        setLicense(data.license);
      }
    } catch (err) {
      addLog(`Run failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
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
        diagnostics.binary_variables,
    ],
    ["Decision state space", reportingSummary?.decision_state_space],
    [
      "Fixed asset blocks",
      reportingSummary?.fixed_asset_blocks ??
        diagnostics.fixed_options ??
        metrics.num_fixed_options,
    ],
    [
      "Variable asset blocks",
      reportingSummary?.variable_asset_blocks ??
        diagnostics.variable_options ??
        metrics.num_variable_options,
    ],
    [
      "Unique tickers referenced",
      reportingSummary?.unique_tickers ?? diagnostics.assets_referenced_by_options,
    ],
    ["Budget", formatCurrency(diagnostics.budget_usd, currencyCode)],
    [
      "Fixed invested amount",
      formatCurrency(reportingSummary?.fixed_invested_usd ?? metrics.fixed_usd, currencyCode),
    ],
    [
      "Variable selectable universe",
      formatCurrency(reportingSummary?.variable_candidate_usd_universe, currencyCode),
    ],
    ["QUBO shape", formatQuboShape(diagnostics.qubo_shape)],
    [
      "Classical candidates",
      reportingSummary?.classical_candidate_count ??
        diagnostics.classical_candidate_count,
    ],
    ["QAOA candidates", reportingSummary?.qaoa_candidate_count ?? 0],
    ["Top N exported", reportingSummary?.top_n_exported],
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
          The current cloud version runs the controlled classical path. QAOA
          modes remain disabled until the quantum execution path is re-enabled
          safely.
        </p>

        <ProgressBar
          visible={loading}
          progress={progress}
          message={progressMessage}
          etaSeconds={estimatedRemainingSec}
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
                <div className="mt-4 rounded-xl bg-slate-900/80 border border-slate-700 p-4 text-sm text-gray-200 space-y-1">
                  <div>
                    <span className="text-gray-400">Level:</span>{" "}
                    {license.display_name ?? license.usage_level}
                  </div>
                  <div>
                    <span className="text-gray-400">Status:</span>{" "}
                    {license.status}
                  </div>
                  <div>
                    <span className="text-gray-400">Remaining runs:</span>{" "}
                    {license.remaining_runs ?? "n/a"}
                  </div>
                  <div>
                    <span className="text-gray-400">Max qubits:</span>{" "}
                    {license.limits?.max_qubits ?? "n/a"}
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Excel Input">
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
                {!result && (
                  <p className="text-xs text-gray-500 mb-2">
                    Detailed workbook metrics are available after a run.
                  </p>
                )}
                <div>
                  {workbookSummary.map(([label, value]) => (
                    <InfoRow
                      key={String(label)}
                      label={String(label)}
                      value={
                        value === undefined || value === "n/a"
                          ? "available after run"
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
                <option value="qaoa">qaoa</option>
              </select>

              {mode !== "classical_only" && (
                <div className="mb-4 rounded-xl border border-yellow-700 bg-yellow-950/30 p-3 text-sm text-yellow-100">
                  QAOA execution is currently disabled in this cloud version.
                  The backend will return a controlled message.
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
                QAOA controls are prepared for the quantum execution path. The
                current cloud version runs the controlled classical path.
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
                  <>
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
                          classicalSummary?.portfolio_return ??
                            metrics.portfolio_return,
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
                        label="Sharpe ratio (proxy)"
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
                  </>
                )}
              </Panel>

              <Panel title="Quantum Result Summary">
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
                    label="Sharpe ratio (proxy)"
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
                    : "This block is prepared to display the best QUBO result from exported quantum samples once the QAOA execution path is re-enabled."}
                </p>
              </Panel>
            </div>

            <Panel title="Log" className="w-full">
              <div className="h-72 overflow-y-auto rounded-xl bg-black/40 border border-slate-800 p-4 font-mono text-sm text-gray-300">
                {logs.length === 0 ? (
                  <div className="text-gray-500">No log entries yet.</div>
                ) : (
                  logs.map((line, idx) => <div key={idx}>{line}</div>)
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
                <Panel title="Portfolio Metrics">
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
                      classicalSummary?.portfolio_return ??
                        metrics.portfolio_return,
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
                    label="Sharpe ratio (proxy)"
                    value={formatNumber(
                      classicalSummary?.sharpe_like ?? metrics.sharpe_like,
                      4
                    )}
                  />
                  <InfoRow
                    label="Budget-normalized return"
                    value={formatNumber(
                      metrics.portfolio_return_budget_normalized,
                      4
                    )}
                  />
                  <InfoRow
                    label="Budget-normalized volatility"
                    value={formatNumber(metrics.portfolio_vol_budget_normalized, 4)}
                  />
                  <InfoRow
                    label="Budget-normalized Sharpe ratio (proxy)"
                    value={formatNumber(metrics.sharpe_like_budget_normalized, 4)}
                  />
                </Panel>

                <Panel title="Objective / QUBO Breakdown">
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
              </div>
            )}

            {portfolioContents.length > 0 && (
              <Panel title="Portfolio Contents">
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
              <Panel title="Top Quantum Candidates">
                {qaoaBestQubo.length > 0 || quantumSamples.length > 0 ? (
                  <CandidateTable
                    rows={qaoaBestQubo.length > 0 ? qaoaBestQubo : quantumSamples}
                    currencyCode={currencyCode}
                    showProbability
                  />
                ) : (
                  <p className="text-gray-400 text-sm">
                    No QAOA samples are available in the current cloud version.
                    This section will show the best QUBO candidates from exported
                    QAOA samples once quantum execution is enabled.
                  </p>
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
                      label="QAOA status"
                      value={formatText(reportingSummary?.qaoa_status)}
                    />
                    <InfoRow
                      label="QAOA p"
                      value={formatText(reportingSummary?.qaoa_p)}
                    />
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