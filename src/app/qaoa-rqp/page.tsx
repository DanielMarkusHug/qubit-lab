"use client";

import { useMemo, useState } from "react";
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

type TopCandidate = {
  bitstring?: string;
  qubo_value?: number;
  qubo_reconstructed?: number;
  selected_usd?: number;
  budget_gap?: number;
  portfolio_return?: number;
  portfolio_vol?: number;
  sharpe_like?: number;
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
  top_candidates?: TopCandidate[];
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

function formatUsd(value: unknown) {
  const number = getNumber(value);
  if (number === undefined) return "n/a";
  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
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
  return String(value);
}

function formatQuboShape(value: unknown) {
  if (Array.isArray(value)) return value.join(" × ");
  return formatText(value);
}

function MetricCard({
  label,
  value,
  subtle = false,
}: {
  label: string;
  value: string;
  subtle?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
      <div className="text-gray-400 text-sm">{label}</div>
      <div
        className={`text-2xl font-bold ${
          subtle ? "text-gray-300" : "text-cyan-200"
        }`}
      >
        {value}
      </div>
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
      <span className="text-gray-100 text-right">{value ?? "n/a"}</span>
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

export default function QaoaRqpPage() {
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [mode, setMode] = useState("classical_only");
  const [responseLevel, setResponseLevel] = useState("compact");

  const [layers, setLayers] = useState(1);
  const [iterations, setIterations] = useState(80);
  const [restarts, setRestarts] = useState(1);
  const [warmStart, setWarmStart] = useState(false);

  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const diagnostics = result?.diagnostics ?? {};
  const metrics = result?.portfolio_metrics ?? {};
  const components = result?.components ?? {};

  const canRun = useMemo(() => {
    return !!file && !loading;
  }, [file, loading]);

  function addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 80));
  }

  async function checkLicense() {
    setLoading(true);
    setResult(null);

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
    } catch (err) {
      addLog(`License check failed: ${err instanceof Error ? err.message : String(err)}`);
      setLicense(null);
    } finally {
      setLoading(false);
    }
  }

  async function runOptimization() {
    if (!file) {
      addLog("No Excel file selected.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      if (mode !== "classical_only") {
        addLog("QAOA execution is currently disabled in this cloud version.");
      }

      addLog("Uploading Excel file...");
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

      const res = await fetch(`${API_URL}/run-qaoa`, {
        method: "POST",
        headers: apiKey ? { "X-API-Key": apiKey } : {},
        body: formData,
      });

      const data = await res.json();
      setResult(data);

      if (!res.ok || data.status === "error") {
        addLog(`Run failed: ${data?.error?.message ?? res.statusText}`);
        return;
      }

      addLog(`Run completed. Best bitstring: ${data.best_bitstring ?? "n/a"}`);

      if (data.license) {
        setLicense(data.license);
      }
    } catch (err) {
      addLog(`Run failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  const workbookSummary = [
    ["Binary variables / qubits", result?.binary_variables ?? diagnostics.binary_variables],
    ["Variable options", diagnostics.variable_options ?? metrics.num_variable_options],
    ["Fixed options", diagnostics.fixed_options ?? metrics.num_fixed_options],
    ["Selected options", metrics.num_options],
    ["Distinct assets", metrics.num_distinct_assets],
    ["Budget USD", formatUsd(diagnostics.budget_usd)],
    ["QUBO shape", formatQuboShape(diagnostics.qubo_shape)],
    ["Classical candidates", diagnostics.classical_candidate_count],
  ];

  return (
    <AppLayout>
      <Header />

      <section className="max-w-screen-2xl mx-auto px-6 xl:px-10 pt-24 pb-16">
        <h1 className="text-4xl font-bold text-cyan-300 mb-3">QAOA RQP</h1>

        <p className="text-cyan-100 text-lg font-semibold mb-5">
          Excel-to-Quantum portfolio optimization prototype.
        </p>

        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-8 max-w-5xl">
          Rapid Quantum Prototype for portfolio optimization. Upload an Excel
          configuration, select the optimization settings, and run the backend
          service hosted on Cloud Run.
          <br />
          <br />
          The current cloud version runs the controlled classical path. QAOA
          modes remain disabled until the quantum execution path is re-enabled
          safely.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left control panel */}
          <div className="xl:col-span-3 space-y-6">
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

              <div className="grid grid-cols-3 gap-3 mb-4">
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

              <p className="mb-5 text-xs leading-relaxed text-gray-500">
                QAOA controls are prepared for the quantum execution path. The
                current cloud version runs the controlled classical path.
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

          {/* Main result area */}
          <div className="xl:col-span-9 space-y-6">
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard label="Objective" value={formatNumber(result.objective, 4)} />
                    <MetricCard label="Selected USD" value={formatUsd(result.selected_usd)} />
                    <MetricCard label="Budget gap" value={formatUsd(result.budget_gap)} />
                    <MetricCard
                      label="Return proxy"
                      value={formatNumber(metrics.portfolio_return, 3)}
                    />
                    <MetricCard
                      label="Volatility"
                      value={formatNumber(metrics.portfolio_vol, 3)}
                    />
                    <MetricCard
                      label="Sharpe-like"
                      value={formatNumber(metrics.sharpe_like, 3)}
                    />
                  </div>
                )}
              </Panel>

              <Panel title="Quantum Result Summary">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MetricCard label="Status" value="Disabled" subtle />
                  <MetricCard label="Best QUBO" value="n/a" subtle />
                  <MetricCard label="Sample source" value="n/a" subtle />
                  <MetricCard label="Selected USD" value="n/a" subtle />
                  <MetricCard label="Budget gap" value="n/a" subtle />
                  <MetricCard label="Sharpe-like" value="n/a" subtle />
                </div>

                <p className="mt-4 text-sm leading-relaxed text-gray-400">
                  Quantum execution is currently disabled in the cloud version.
                  This block is prepared to display the best QUBO result from
                  exported quantum samples once the QAOA execution path is
                  re-enabled.
                </p>
              </Panel>
            </div>

            <Panel title="Log" className="w-full">
              <div className="h-64 overflow-y-auto rounded-xl bg-black/40 border border-slate-800 p-4 font-mono text-sm text-gray-300">
                {logs.length === 0 ? (
                  <div className="text-gray-500">No log entries yet.</div>
                ) : (
                  logs.map((line, idx) => <div key={idx}>{line}</div>)
                )}
              </div>
            </Panel>

            {result && !result.error && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Panel title="Portfolio Metrics">
                  <InfoRow label="Cash weight" value={formatPercent(metrics.cash_weight, 3)} />
                  <InfoRow label="Fixed USD" value={formatUsd(metrics.fixed_usd)} />
                  <InfoRow
                    label="Variable selected USD"
                    value={formatUsd(metrics.variable_selected_usd)}
                  />
                  <InfoRow
                    label="Max position USD"
                    value={formatUsd(metrics.max_position_usd)}
                  />
                  <InfoRow
                    label="Portfolio return"
                    value={formatNumber(metrics.portfolio_return, 4)}
                  />
                  <InfoRow
                    label="Portfolio volatility"
                    value={formatNumber(metrics.portfolio_vol, 4)}
                  />
                  <InfoRow
                    label="Sharpe-like"
                    value={formatNumber(metrics.sharpe_like, 4)}
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
                    label="Budget-normalized Sharpe-like"
                    value={formatNumber(metrics.sharpe_like_budget_normalized, 4)}
                  />
                </Panel>

                <Panel title="Objective Breakdown">
                  {Object.keys(components).length === 0 ? (
                    <p className="text-gray-400 text-sm">
                      Objective components are available in standard/full
                      response levels.
                    </p>
                  ) : (
                    <>
                      <InfoRow
                        label="Return term"
                        value={formatNumber(components.return_term, 6)}
                      />
                      <InfoRow
                        label="Risk term"
                        value={formatNumber(components.risk_term, 6)}
                      />
                      <InfoRow
                        label="Budget term"
                        value={formatNumber(components.budget_term, 6)}
                      />
                      <InfoRow
                        label="QUBO reconstructed"
                        value={formatNumber(components.qubo_reconstructed, 6)}
                      />
                    </>
                  )}
                </Panel>
              </div>
            )}

            {result?.selected_blocks && result.selected_blocks.length > 0 && (
              <Panel title="Selected Blocks">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-gray-400 border-b border-slate-700">
                      <tr>
                        <th className="py-2 pr-4">Ticker</th>
                        <th className="py-2 pr-4">Company</th>
                        <th className="py-2 pr-4">Option</th>
                        <th className="py-2 pr-4">Cost</th>
                        <th className="py-2 pr-4">Shares</th>
                        <th className="py-2 pr-4">Decision ID</th>
                        <th className="py-2 pr-4">Bit Index</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.selected_blocks.map((block, idx) => (
                        <tr key={idx} className="border-b border-slate-800">
                          <td className="py-2 pr-4 text-cyan-200">
                            {String(block.Ticker ?? "")}
                          </td>
                          <td className="py-2 pr-4 text-gray-200">
                            {String(block.Company ?? "")}
                          </td>
                          <td className="py-2 pr-4 text-gray-300">
                            {String(block["Option Label"] ?? "")}
                          </td>
                          <td className="py-2 pr-4 text-gray-300">
                            {formatUsd(block["Approx Cost USD"])}
                          </td>
                          <td className="py-2 pr-4 text-gray-300">
                            {String(block.Shares ?? "")}
                          </td>
                          <td className="py-2 pr-4 text-gray-400">
                            {String(block.decision_id ?? "")}
                          </td>
                          <td className="py-2 pr-4 text-gray-400">
                            {String(block.variable_bit_index ?? "")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}

            {result && !result.error && (
              <Panel title="Top Candidates">
                {result.top_candidates && result.top_candidates.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-gray-400 border-b border-slate-700">
                        <tr>
                          <th className="py-2 pr-4">Rank</th>
                          <th className="py-2 pr-4">Bitstring</th>
                          <th className="py-2 pr-4">QUBO</th>
                          <th className="py-2 pr-4">Selected USD</th>
                          <th className="py-2 pr-4">Budget gap</th>
                          <th className="py-2 pr-4">Return</th>
                          <th className="py-2 pr-4">Volatility</th>
                          <th className="py-2 pr-4">Sharpe-like</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.top_candidates.map((candidate, idx) => (
                          <tr key={idx} className="border-b border-slate-800">
                            <td className="py-2 pr-4 text-gray-300">{idx + 1}</td>
                            <td className="py-2 pr-4 font-mono text-cyan-200">
                              {candidate.bitstring ?? "n/a"}
                            </td>
                            <td className="py-2 pr-4 text-gray-300">
                              {formatNumber(
                                candidate.qubo_value ?? candidate.qubo_reconstructed,
                                6
                              )}
                            </td>
                            <td className="py-2 pr-4 text-gray-300">
                              {formatUsd(candidate.selected_usd)}
                            </td>
                            <td className="py-2 pr-4 text-gray-300">
                              {formatUsd(candidate.budget_gap)}
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
                ) : (
                  <p className="text-gray-400 text-sm">
                    Use standard/full response level to display top candidates.
                  </p>
                )}
              </Panel>
            )}

            {result && !result.error && (
              <Panel title="Diagnostics">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8">
                  <div>
                    <InfoRow
                      label="Actual runtime"
                      value={`${formatNumber(diagnostics.actual_runtime_sec, 3)} sec`}
                    />
                    <InfoRow
                      label="Estimated runtime"
                      value={`${formatNumber(diagnostics.estimated_runtime_sec, 3)} sec`}
                    />
                    <InfoRow
                      label="Runtime ratio"
                      value={formatNumber(diagnostics.runtime_ratio, 2)}
                    />
                  </div>
                  <div>
                    <InfoRow
                      label="Usage level"
                      value={formatText(diagnostics.usage_level)}
                    />
                    <InfoRow
                      label="QUBO shape"
                      value={formatQuboShape(diagnostics.qubo_shape)}
                    />
                    <InfoRow
                      label="QUBO nonzero entries"
                      value={formatText(diagnostics.qubo_nonzero_entries)}
                    />
                  </div>
                  <div>
                    <InfoRow
                      label="Classical candidates"
                      value={formatText(diagnostics.classical_candidate_count)}
                    />
                    <InfoRow
                      label="Variable options"
                      value={formatText(diagnostics.variable_options)}
                    />
                    <InfoRow
                      label="Fixed options"
                      value={formatText(diagnostics.fixed_options)}
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