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

type RunResult = {
  status?: string;
  mode?: string;
  model_version?: string;
  solver?: string;
  best_bitstring?: string;
  binary_variables?: number;
  objective?: number;
  selected_usd?: number;
  budget_gap?: number;
  run_id?: string;
  license?: LicenseStatus;
  diagnostics?: Record<string, unknown>;
  portfolio_metrics?: {
    portfolio_return?: number;
    portfolio_vol?: number;
    sharpe_like?: number;
    num_options?: number;
    num_distinct_assets?: number;
    cash_weight?: number;
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

function formatNumber(value: unknown, digits = 3) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

function formatUsd(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function QaoaRqpPage() {
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [mode, setMode] = useState("classical_only");
  const [responseLevel, setResponseLevel] = useState("compact");

  const [layers, setLayers] = useState(3);
  const [iterations, setIterations] = useState(80);
  const [restarts, setRestarts] = useState(1);
  const [warmStart, setWarmStart] = useState(false);

  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const canRun = useMemo(() => {
    return !!file && !loading;
  }, [file, loading]);

  function addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
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
      addLog("Uploading Excel file and starting optimization...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      formData.append("response_level", responseLevel);

      // Keep these visible in the UI. Only send them if your backend accepts them.
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

  return (
    <AppLayout>
      <Header />

      <section className="max-w-6xl mx-auto px-6 pt-24 pb-16">
        <h1 className="text-4xl font-bold text-cyan-300 mb-6">
          QAOA RQP
        </h1>

        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-8">
          Rapid Quantum Prototype for portfolio optimization. Upload an Excel
          configuration, select the optimization settings, and run the backend
          service hosted on Cloud Run.
          <br />
          <br />
          The current cloud version runs the controlled classical path. QAOA
          modes remain disabled until the quantum execution path is re-enabled
          safely.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left control panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-cyan-900/60 bg-slate-950/70 p-5 shadow-lg">
              <h2 className="text-xl font-bold text-cyan-200 mb-4">
                Access
              </h2>

              <label className="block text-sm text-gray-300 mb-2">
                API key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your key"
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
            </div>

            <div className="rounded-2xl border border-cyan-900/60 bg-slate-950/70 p-5 shadow-lg">
              <h2 className="text-xl font-bold text-cyan-200 mb-4">
                Excel Input
              </h2>

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
            </div>

            <div className="rounded-2xl border border-cyan-900/60 bg-slate-950/70 p-5 shadow-lg">
              <h2 className="text-xl font-bold text-cyan-200 mb-4">
                Optimization Settings
              </h2>

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

              <label className="flex items-center gap-3 text-sm text-gray-300 mb-5">
                <input
                  type="checkbox"
                  checked={warmStart}
                  onChange={(e) => setWarmStart(e.target.checked)}
                  className="h-4 w-4"
                />
                Warm start
              </label>

              <button
                onClick={runOptimization}
                disabled={!canRun}
                className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-slate-950 font-semibold py-3"
              >
                {loading ? "Running..." : "Run Optimization"}
              </button>
            </div>
          </div>

          {/* Right result area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-cyan-900/60 bg-slate-950/70 p-5 shadow-lg">
              <h2 className="text-xl font-bold text-cyan-200 mb-4">
                Result Summary
              </h2>

              {!result && (
                <p className="text-gray-400">
                  Run an optimization to see the result summary here.
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
                  <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                    <div className="text-gray-400 text-sm">Objective</div>
                    <div className="text-2xl font-bold text-cyan-200">
                      {formatNumber(result.objective, 4)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                    <div className="text-gray-400 text-sm">Selected USD</div>
                    <div className="text-2xl font-bold text-cyan-200">
                      {formatUsd(result.selected_usd)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                    <div className="text-gray-400 text-sm">Budget gap</div>
                    <div className="text-2xl font-bold text-cyan-200">
                      {formatUsd(result.budget_gap)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                    <div className="text-gray-400 text-sm">Return proxy</div>
                    <div className="text-2xl font-bold text-cyan-200">
                      {formatNumber(result.portfolio_metrics?.portfolio_return, 3)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                    <div className="text-gray-400 text-sm">Volatility</div>
                    <div className="text-2xl font-bold text-cyan-200">
                      {formatNumber(result.portfolio_metrics?.portfolio_vol, 3)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                    <div className="text-gray-400 text-sm">Sharpe-like</div>
                    <div className="text-2xl font-bold text-cyan-200">
                      {formatNumber(result.portfolio_metrics?.sharpe_like, 3)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {result?.selected_blocks && result.selected_blocks.length > 0 && (
              <div className="rounded-2xl border border-cyan-900/60 bg-slate-950/70 p-5 shadow-lg">
                <h2 className="text-xl font-bold text-cyan-200 mb-4">
                  Selected Blocks
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-gray-400 border-b border-slate-700">
                      <tr>
                        <th className="py-2 pr-4">Ticker</th>
                        <th className="py-2 pr-4">Company</th>
                        <th className="py-2 pr-4">Option</th>
                        <th className="py-2 pr-4">Cost</th>
                        <th className="py-2 pr-4">Shares</th>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-cyan-900/60 bg-slate-950/70 p-5 shadow-lg">
              <h2 className="text-xl font-bold text-cyan-200 mb-4">
                Log
              </h2>

              <div className="h-48 overflow-y-auto rounded-xl bg-black/40 border border-slate-800 p-4 font-mono text-sm text-gray-300">
                {logs.length === 0 ? (
                  <div className="text-gray-500">No log entries yet.</div>
                ) : (
                  logs.map((line, idx) => <div key={idx}>{line}</div>)
                )}
              </div>
            </div>

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