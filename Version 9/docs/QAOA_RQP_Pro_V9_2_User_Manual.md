# QAOA RQP Pro V9.2 — Client User Manual

**Rapid Quantum Prototyping for Portfolio Optimization**  
qubit-lab.ch | Client User Manual | Version 9.2.0

---

## Contents

1. [About qubit-lab.ch and RQP](#1-about-qubit-labch-and-rqp)
2. [What the Tool Does](#2-what-the-tool-does)
3. [Quick Start](#3-quick-start)
4. [Inputs and Workbook Format](#4-inputs-and-workbook-format)
5. [Optimization Settings](#5-optimization-settings)
6. [Methods Used](#6-methods-used)
7. [Execution and Live Progress](#7-execution-and-live-progress)
8. [Outputs and Interpretation](#8-outputs-and-interpretation)
9. [IBM Hardware Second Opinion](#9-ibm-hardware-second-opinion)
10. [Review Files and Code Exports](#10-review-files-and-code-exports)
11. [Access Levels and Limits](#11-access-levels-and-limits)
12. [Worker Profiles](#12-worker-profiles)
13. [Memory Telemetry](#13-memory-telemetry)
14. [Good Practice and Troubleshooting](#14-good-practice-and-troubleshooting)
15. [Appendix A — Settings Field Reference](#appendix-a--settings-field-reference)
16. [Appendix B — Glossary](#appendix-b--glossary)
17. [Disclaimer](#disclaimer)

---

## 1. About qubit-lab.ch and RQP

**qubit-lab.ch** bridges quantum computing concepts and real-world business and finance questions. Its practical mission is to make quantum methods transparent, understandable, and testable for finance professionals, technology stakeholders, quants, and technically curious practitioners — without hiding the mechanics inside a black box.

The **Rapid Quantum Prototyping (RQP)** tool embodies this mission. It takes a familiar Excel-based portfolio use case and exposes every step of the pipeline: workbook parsing, QUBO construction, classical baseline, QAOA simulation, live diagnostics, result interpretation, and portable circuit exports. Users can inspect, challenge, and reproduce all of it.

> **Straight talk, not black-box quantum.** The full chain is visible: workbook assumptions, QUBO math, solver settings, backend logs, portfolio metrics, candidate tables, charts, and executable circuit notebooks. Nothing is hidden.

---

## 2. What the Tool Does

QAOA RQP Pro V9.2 is a browser-based optimization cockpit for portfolio experiments. Users upload a structured Excel workbook, configure optimization settings, and submit a backend job that runs a classical heuristic baseline and — when selected — a QAOA simulation path. After the job finishes, the interface shows portfolio metrics, candidate tables, charts, diagnostics, and downloadable artifacts.

**Key capabilities:**

- Parses a portfolio workbook (fixed holdings, variable candidates, covariance, returns, costs, settings) into a binary optimization problem.
- Separates fixed positions (always in the portfolio, not a qubit) from variable decision blocks (each consumes one qubit).
- Constructs a QUBO/Ising representation incorporating return, variance/risk, total budget, and up to five exact subtype budget constraints.
- Runs a classical heuristic candidate search and, when selected, a QAOA simulation on PennyLane's `lightning.qubit` or `default.tensor` backend.
- Provides an optional second-opinion comparison via Qiskit simulation or IBM quantum hardware execution.
- Streams live backend logs, ETA, memory telemetry, and phase progress during job execution.
- Exports completed results as review JSON and executable Qiskit, PennyLane, and Cirq notebook files.

**End-to-end workflow:**

```
Excel Workbook  →  Inspect / Validate  →  Configure & Run
     ↓                                         ↓
QUBO Build  →  Classical Baseline  →  QAOA Simulation
     ↓                                         ↓
Results Dashboard  →  Review File / Code Exports
```

---

## 3. Quick Start

1. Open the RQP tool from **qubit-lab.ch** → Finance / RQP, or from a private V9.2 route if provided.
2. Paste a license key into the Access panel, or click **Check License or Public Demo** to proceed under public demo limits.
3. Download a demo workbook (7, 16, or 24 qubits) using the buttons at the top, or upload your own `.xlsx` file using **Datei auswählen**.
4. Review the **Workbook Summary** that appears — it confirms qubit count, QUBO shape, fixed/variable split, type constraints, and loaded settings.
5. In **Optimization Settings**, choose a mode, worker profile, response level, and QAOA parameters.
6. If using the IBM hardware second opinion, expand the IBM Quantum session panel, paste your IBM Quantum token, and review the pre-run hardware depth estimate.
7. Click **Run Optimization on V9.2** and monitor the **Backend Optimization Log**, memory telemetry, and live ETA.
8. When the job finishes, review the result cards, portfolio contents, candidate tables, charts, QUBO breakdown, and diagnostics.
9. Save a **Review File** or **Raw JSON** for audit and reproducibility. Use **Code Exports** to generate Qiskit, PennyLane, or Cirq notebooks.

> **Tip:** Always inspect the workbook before running. The inspect step validates structure, warns about budget issues, and shows a runtime estimate — helping you avoid wasting a run on a misconfigured workbook.

---

## 4. Inputs and Workbook Format

The primary input is an Excel workbook (`.xlsx`). Version 9 extends the Version 8 format with optional exact subtype budget constraints. Three sheets are required; additional sheets are recognized but optional.

### 4.1 Required Sheets

| Sheet | Purpose | Key fields |
|---|---|---|
| **Settings** | Global optimization and portfolio configuration. | `Budget`, `Lambda Budget`, `Lambda Variance`, `Risk Free Rate`, `QAOA P`, `QAOA Maxiter`, `QAOA Multistart Restarts`, `QAOA Shots`, `Warm Start`, `Restart Perturbation`, `Random Seed`, `Additional Type Constraints`, `Type A–E Name/Budget/Budget Penalty`. |
| **Assets** | One row per portfolio block (fixed or variable). | `Ticker`, `Company`, `Decision Role`, `Option`, `Indicative Market Cost USD`, `Expected Return Proxy`, `Annual Volatility`, and optional `Type A Size` … `Type E Size` columns. |
| **AnnualizedCovariance** | Annualized covariance matrix for all referenced tickers. | Square matrix; rows and columns must match ticker labels in the Assets sheet. |

### 4.2 Recognized Optional Sheets

`ReadMe`, `Returns`, `Covariance`, `PriceHistory`, `Sources`. These are parsed when present but are not required for a valid run.

### 4.3 Asset Rows

Each row in the Assets sheet is either a fixed holding or a variable decision block:

| `Decision Role` | Meaning | Qubit consumed? |
|---|---|---|
| `fixed` | Always included in the portfolio. Contributes cost, return, risk, budget usage, and type-budget exposure as a constant offset. | No |
| `variable` | Binary decision variable. The optimizer chooses whether to include it. | **Yes — one qubit per row.** |

**Cost column:** `Indicative Market Cost USD` is the primary cost column in V9. A legacy `Approx Cost USD` column is mapped for compatibility; when both are present, the indicative column takes priority.

**Return and volatility:** `Expected Return Proxy` and `Annual Volatility` must be numeric for any row that may be selected. Missing or non-numeric values in variable rows cause a validation error.

### 4.4 Workbook Validation Warnings

The inspect step runs a series of automatic checks and surfaces warnings if:

- Fixed holdings exceed the configured total budget before any variable block is added.
- The budget is smaller than fixed holdings plus the cheapest variable block.
- Fixed holdings plus the median variable block cost already exceed the budget.
- No variable decision blocks are found (optimizer has nothing to select).
- The selectable variable universe is too small to reach the configured budget.

Any warnings appear in the Workbook Summary and are logged in the backend log. They do not block a run but should be reviewed.

### 4.5 Optional Subtype Budget Constraints (V9 Addition)

V9.2 supports up to **five exact subtype budget targets** layered on top of the main total-budget constraint. These can represent any meaningful portfolio dimension: sector, region, asset class, sustainability bucket, liquidity tier, internal risk category, and so on.

**Settings sheet fields** (for each active type A through E):

| Field | Description |
|---|---|
| `Additional Type Constraints` | Integer 0–5. Missing or blank is treated as 0. |
| `Type X Name` | User-facing label shown in results (e.g., `Compute Infra`, `Enterprise Rails`). Does not affect optimization math — internal IDs `type_a` … `type_e` are stable. |
| `Type X Budget` | Target exposure for that subtype (positive number in the same currency as the main budget). |
| `Type X Budget Penalty` | Penalty weight (lambda) applied to deviations from the subtype target. Must be ≥ 0. |

**Assets sheet columns** (for each active type):

| Column | Description |
|---|---|
| `Type A Size` … `Type E Size` | Numeric exposure of this asset block to the subtype. Missing cells are treated as 0. Non-empty non-numeric values fail validation. Do not rename these columns to include user labels — the parser matches these exact strings. |

**Example from a 16-qubit run:**

| ID | Name | Budget | Penalty | Status |
|---|---|---|---|---|
| type_a | Compute Infra | 900,000 | 50 | active |
| type_b | Enterprise Rails | 1,400,000 | 50 | active |
| type_c | Consumer Platforms | 900,000 | 50 | active |

---

## 5. Optimization Settings

All settings can come from three sources, in priority order: (1) the UI form, (2) the workbook Settings sheet, (3) backend defaults. The diagnostics block at the end of a run shows which source was effective for each setting.

### 5.1 Mode

| Mode | Value | Description |
|---|---|---|
| **Classical Only** | `classical_only` | Runs the heuristic classical candidate search. No QAOA circuit is built or executed. Fast and useful for input validation. |
| **QAOA Lightning Sim** | `qaoa_lightning_sim` | PennyLane `lightning.qubit` — high-performance C++ statevector simulator. For up to 24 qubits, runs in exact-probability mode (full statevector, no sampling noise). Above 24 qubits, switches to sampling mode. |
| **QAOA Tensor Sim** | `qaoa_tensor_sim` | PennyLane `default.tensor` — tensor-network simulator. Always uses sampling mode. Suitable for larger qubit counts where full statevector is impractical. |

> **Choosing a mode:** Start with `classical_only` to validate the workbook. Switch to `qaoa_lightning_sim` for quantum prototyping up to ~24 qubits. Use `qaoa_tensor_sim` for larger problems.

### 5.2 Second Opinion / Comparison

| Option | Value | Description |
|---|---|---|
| Internal only | `internal_only` | No second opinion. Single QAOA result only. |
| Qiskit simulation | `qiskit_export` | Independently reconstructs the optimized QAOA circuit in Qiskit and re-evaluates it as a statevector simulation. Useful for cross-framework validation. Available at Tester level and above. |
| Qiskit on IBM Hardware | `ibm_external_run` | Transpiles and submits the circuit to a real IBM quantum device. Requires an IBM Quantum token for the session. Available at Tester level and above. See [Section 9](#9-ibm-hardware-second-opinion). |

### 5.3 Response Level

| Level | Description |
|---|---|
| `compact` | Summary cards only. Fastest for quick status checks. |
| `standard` | Summary cards plus key tables. |
| `full` | All output blocks including backend diagnostics, export diagnostics, memory telemetry, IBM hardware diagnostics, circuit overview, and solver comparison. Recommended for review and documentation. |

### 5.4 Worker Profile

See [Section 12](#12-worker-profiles) for full details.

### 5.5 QAOA Parameters

| Parameter | UI label | Workbook key | Description | Guidance |
|---|---|---|---|---|
| **Layers** | Layers | `QAOA P` | QAOA depth *p* — number of alternating cost + mixer layers. | Start at 1–2 for demos. Increasing depth can improve quality but adds runtime quadratically. |
| **Iterations** | Iterations | `QAOA Maxiter` | Maximum optimizer iterations per restart. | Keep modest (50–100) for demos; increase (150–300) for deeper searches. |
| **Restarts** | Restarts | `QAOA Multistart Restarts` | Number of independent optimizer starts. Each restart begins from a fresh (perturbed) set of initial angles. | 1 restart is fast; 3+ helps avoid local minima, especially at higher depths. |
| **QAOA Shots** | QAOA shots | `QAOA Shots` | Number of readout samples when sampling mode is active. | Shown as `exact` when exact-probability mode is used (Lightning Sim ≤ 24 qubits). |
| **Warm Start** | Warm start | `Warm Start` | Initializes layer *p* angles from the optimized layer *p−1* solution. | Adds ~50% runtime overhead but often produces better starting points for deeper circuits. |
| **Restart Perturbation** | Restart perturbation | `Restart Perturbation` | Magnitude of random noise added to initial angles at each restart. | Default 0.05. Increase if restarts converge too similarly. |
| **Budget Lambda** | Budget lambda | `Lambda Budget` | Penalty weight enforcing the total budget constraint. | Higher values (e.g., 50–100) enforce budget more strictly. Too high can drown out the return term. |
| **Risk Lambda** | Risk lambda | `Lambda Variance` | Penalty weight on portfolio variance. | Higher values favor lower-risk portfolios. |
| **Risk-Free Rate** | Risk-free rate | `Risk Free Rate` | Annual reference rate for Sharpe-like metric calculation. | Set consistently with the return horizon (e.g., 0.04 for 4%). |
| **Random Seed** | Random seed | `Random Seed` | Optional integer 0–4,294,967,295. Makes optimizer angle initialization reproducible. | Same seed + same code + same environment = same result. Exact reproducibility is not guaranteed across platform or version changes. |

---

## 6. Methods Used

### 6.1 Problem Formulation

The optimizer treats each variable asset block as a binary decision variable *x_i* ∈ {0, 1}. Fixed positions are always included and contribute constant offsets to the objective. The goal is to find the assignment of *x_i* values that minimizes the combined objective.

### 6.2 QUBO Construction

The full QUBO objective is:

```
H(x) = −λ_r · Σ_i w_i · x_i                        (return term)
      + λ_v · x^T Σ x                               (variance/risk term)
      + λ_b · ((Σ_i c_i · x_i + C_fixed) / B − 1)² (budget term)
      + Σ_k λ_k · ((E_k^fixed + Σ_i s_ki · x_i) / B_k − 1)²  (subtype budget terms)
```

Where:
- *w_i* = expected return proxy for variable block *i*
- *Σ* = annualized covariance matrix
- *c_i* = indicative market cost for block *i*; *C_fixed* = sum of fixed-block costs
- *B* = total budget target
- *λ_b*, *λ_v* = budget and risk penalty weights from the Settings sheet
- *E_k^fixed* = sum of `Type X Size` values across fixed blocks for constraint *k*
- *s_ki* = `Type X Size` value for variable block *i* under constraint *k*
- *B_k* = subtype budget target; *λ_k* = subtype budget penalty

The normalized form `(achieved / budget − 1)²` means a penalty of 0 when the target is hit exactly, and a positive penalty proportional to the squared relative deviation otherwise. Fixed blocks contribute a constant offset to the subtype term; only the variable block coefficients enter the QUBO matrix.

The QUBO matrix **Q** is then converted to Ising form (Pauli Z operators) for circuit construction:

```
x_i = (1 − σ_z^i) / 2
```

This produces the Ising Hamiltonian *H_C* used as the QAOA cost operator.

### 6.3 Classical Baseline

The classical path uses a heuristic search combining random sampling and local improvement over the binary decision space. It evaluates candidate portfolios under the same QUBO objective and exports the top unique candidates ranked by QUBO value. The classical baseline is always run, regardless of mode, and provides a practical benchmark for quantum results.

The number of classical candidates exported is capped at the number of unique candidates found (after deduplication). The diagnostic field `classical_export_cap_reason` explains why the count may be lower than requested.

### 6.4 QAOA Simulation

**Initialization:** A uniform superposition is created by applying a Hadamard gate to every qubit:

```
|ψ_0⟩ = H^⊗n |0⟩^⊗n = (1/√(2^n)) Σ_{x∈{0,1}^n} |x⟩
```

**QAOA layers (repeated *p* times):** Each layer alternates:

1. **Cost unitary** U_C(γ): Applied to encode the QUBO Hamiltonian.
   - Single-qubit diagonal terms (Ising *h* coefficients): `RZ(2γ·h_i)` on qubit *i*
   - Two-qubit ZZ interaction terms (Ising *J* coefficients): `CX(i,j) → RZ(2γ·J_ij, j) → CX(i,j)` for each pair

2. **Mixer unitary** U_B(β): `RX(2β)` applied to every qubit (transverse-field mixer).

**Gate counts for *n* qubits, *p* layers, *k* = (n·(n−1)/2) two-qubit QUBO terms:**

| Gate | Count |
|---|---|
| H (Hadamard) | n (initialization only) |
| RZ (cost diagonal) | n·p + k·p |
| CX (CNOT, cost ZZ) | 2·k·p |
| RX (mixer) | n·p |
| **Total 1Q gates** | n + (n + k)·p + n·p |
| **Total 2Q gates** | 2·k·p |

For the 16-qubit demo run (p=2, k=120): 800 total gates, 480 CX gates, 320 single-qubit gates.

**Parameter optimization:** The optimizer iterates over γ and β angle parameters using a classical gradient-free optimizer, minimizing the expected QUBO energy ⟨ψ(γ,β)|H_C|ψ(γ,β)⟩. This uses PennyLane's built-in optimization pipeline, wrapping the V6.1 core optimizer.

**Exact vs. sampling mode:**

| Condition | Mode | Behavior |
|---|---|---|
| Lightning Sim, ≤ 24 qubits | **Exact probability** | Full statevector computed. Every 2^n bitstring gets an exact probability. No shot noise. |
| Lightning Sim, > 24 qubits | **Sampling** | `qaoa_shots` measurements drawn from the statevector. |
| Tensor Sim (any qubit count) | **Sampling** | Always uses sampling — tensor network does not produce the full statevector efficiently. |

In exact mode, the exported candidate table is derived from the complete probability distribution. In sampling mode, it is derived from observed measurement counts.

**Export cap:** A safety cap (default 5,000 rows) limits the number of candidate rows written to the result. In exact mode for 16 qubits (65,536 states), the top 5,000 candidates by probability are exported.

### 6.5 Angle Parameters

The QAOA optimizer maintains `best_gammas` and `best_betas` arrays after optimization. These are the p-element parameter vectors that achieved the lowest expected QUBO energy across all restarts. They are embedded in the result JSON and used for code exports.

### 6.6 Runtime Estimation

The pre-run estimate uses the following formula:

**QAOA:**
```
raw_estimate = safety_factor × α × state_count × layers × iterations × restarts × (1.5 if warm_start)
calibrated_estimate = raw_estimate × estimate_multiplier
```

With calibrated parameters: `safety_factor = 2.0`, `α_qaoa = 5×10⁻⁷`, `estimate_multiplier = 2.75`.

**Classical:**
```
raw_estimate = safety_factor × (parse_overhead + result_overhead + α_qubit × n + α_candidate × state_count)
```

The live backend ETA during execution reflects actual measured speed and updates in real time.

---

## 7. Execution and Live Progress

### 7.1 Job Submission

Runs are submitted as asynchronous backend jobs. The browser polls the backend for progress, logs, ETA, and result availability. You do not need to keep the tab focused during execution.

### 7.2 Client Log

The Client Log shows timestamped messages from the frontend, including file load confirmation and status updates.

### 7.3 Backend Optimization Log

The Backend Optimization Log streams live messages from the worker job. Messages are shown newest-first and cover:

- Input validation and workbook parsing
- QUBO construction (including type constraint injection)
- Classical candidate search and export
- QAOA configuration, angle initialization, and per-iteration progress
- Optimizer convergence and best-energy reporting
- IBM hardware submission (if selected)
- Result table generation and finalization
- Export diagnostic summary

**Example log excerpt (from actual 16-qubit run):**
```
[16:34:31] QAOA sample count: 5000
[16:34:31] Generating Version 6.1 result tables.
[16:34:31] Classical export requested 5016 rows; exported 9 rows; reason:
           unique_candidate_count_after_duplicate_removal_or_search_convergence
[16:34:31] QAOA export requested 5000 rows; exported 5000 rows; reason:
           requested_rows_within_safety_cap
[16:34:31] IBM hardware submitted on ibm_fez: job d81jg0ugbeec73akljpg (4096 shots).
[16:34:31] IBM hardware completed on ibm_fez (job d81jg0ugbeec73akljpg).
```

### 7.4 Cancellation

Long-running jobs can be cancelled from the UI. Cancel only if the run is no longer needed — partial results are not preserved.

---

## 8. Outputs and Interpretation

### 8.1 Result Summary Cards

Three summary cards appear side-by-side when all configured paths complete:

| Card | Content |
|---|---|
| **Classical Result Summary** | Best bitstring, QUBO value, selected amount, budget gap, return proxy, volatility, Sharpe ratio. Source: `Classical_Candidates`. |
| **Quantum Result Summary** | Best bitstring by QUBO value from QAOA output, plus readout probability. Source: `QAOA_Best_QUBO`. |
| **Quantum Result Summary (2nd opinion)** | Best bitstring from IBM hardware or Qiskit simulation, plus hardware/simulation probability. |

**Example (16-qubit demo run):**

| Metric | Classical | Quantum (QAOA) | IBM Hardware |
|---|---|---|---|
| QUBO value | 0.794121 | 0.794121 | 0.794121 |
| Selected amount | 2,999,905.3 | 2,999,905.3 | 2,999,905.3 |
| Budget gap | −94.7 | −94.7 | −94.7 |
| Return proxy | 0.598 | 0.598 | 0.598 |
| Volatility | 0.222 | 0.222 | 0.222 |
| Sharpe ratio | 2.517 | 2.517 | 2.517 |
| Bitstring | 0000000010011111 | 0000000010011111 | 0000000010011111 |
| Probability | — | 0.004787 | 0.001953 |

All three solvers converge on the same best bitstring in this run, which is the expected behavior when the QAOA circuit is well-configured and the problem has a clear optimum.

### 8.2 Portfolio Metrics

Detailed metric tables expand each summary card with:

- Cash weight (percentage of budget uninvested)
- Total selected amount and budget gap
- Portfolio return, volatility, Sharpe-like ratio
- Budget-normalized versions of each metric (accounts for any uninvested cash)
- QUBO readout probability (quantum paths only)

**Reading the metrics:**

- **Return** is the portfolio-weighted expected return proxy, computed from the Assets sheet values and selection weights.
- **Volatility** is computed from the AnnualizedCovariance matrix and the selected asset weights.
- **Sharpe-like ratio** = (return − risk-free rate) / volatility. This is an indicator for comparison, not a financial guarantee.
- **Budget gap** = selected amount − total budget. A small negative gap (e.g., −95) means the optimizer chose just below budget, which is expected when no single additional asset exactly fills the gap.
- **Budget-normalized metrics** rescale to the full budget assuming uninvested cash earns the risk-free rate.

### 8.3 QUBO Breakdown

The QUBO breakdown decomposes the objective value into its constituent terms for both the classical and quantum best portfolios:

| Term | Description |
|---|---|
| Return term | Negative contribution from expected return (want to minimize, so returns reduce QUBO). |
| Risk term | Positive contribution from portfolio variance scaled by λ_v. |
| Budget term | Penalty for deviating from the total budget target, scaled by λ_b. |
| Type-budget term | Sum of penalties for all active subtype budget deviations, each scaled by the corresponding λ_k. |
| **QUBO total** | Sum of all terms. Lower is better within the same penalty configuration. |

**Example QUBO breakdown (16-qubit demo):**
```
Return term:       −0.09573
Risk term:          0.63309
Budget term:        0.00000   ← budget constraint approximately satisfied
Type-budget term:   0.25676   ← Enterprise Rails at +7.2% deviation drives this
QUBO total:         0.79412
```

### 8.4 Type-Budget Achievements

For each active subtype constraint, the results show:

| Column | Description |
|---|---|
| Budget | Configured target exposure |
| Achieved | Actual sum of fixed + selected variable exposures for this type |
| Normalized | Achieved / Budget (1.0 = exact hit) |
| Deviation | Achieved − Budget (absolute) |
| Relative deviation | (Achieved / Budget) − 1.0 (percentage) |
| Penalty contribution | λ_k × (normalized − 1)² |

**Interpretation guidance:** A small relative deviation (< 1%) means the constraint is approximately satisfied. A larger deviation (e.g., 7%) with a low penalty contribution means the penalty weight is not strong enough to force compliance. Increase the penalty if tighter adherence is required.

### 8.5 Top Candidates Tables

**Top Classical Candidates:** Ranked by QUBO value ascending. Shows bitstring, QUBO, selected amount, budget gap, type achievement columns, and financial metrics. Classical candidates come from the heuristic search and are deduplicated.

**Top Quantum Candidates:** QAOA results ranked by QUBO value. Each row includes the readout probability, making it possible to compare what the optimizer found objectively (low QUBO) against what the quantum circuit preferred (high probability).

**Top Quantum Candidates by QUBO (2nd opinion):** Same structure, but sourced from the IBM hardware or Qiskit simulation run.

**Top Quantum Samples by Probability (2nd opinion):** IBM hardware results sorted by observed hit count / probability. Useful for assessing which states the hardware most frequently measured, independent of their QUBO quality.

> **Key insight:** In a well-converged run, the top-QUBO and top-probability candidates should overlap substantially. When they diverge significantly, it often indicates the circuit depth is insufficient, penalties need tuning, or more restarts/iterations are needed.

### 8.6 Solver Comparison

A side-by-side bar chart and table comparing classical, QAOA, and second-opinion results on QUBO value, portfolio return, volatility, and Sharpe ratio. The ideal outcome is convergence — all three solvers finding the same or similarly ranked candidate. Divergence is informative and should prompt investigation of settings, not be treated as a failure.

### 8.7 Optimization History

Shows the QAOA objective (expected QUBO energy) as a function of optimizer iteration, across all restarts. Key things to look for:

- Does the curve descend smoothly, or does it stagnate early? Stagnation may indicate too few iterations or a difficult landscape at this depth.
- Do multiple restarts converge to the same energy? Strong consistency is a positive sign.
- Is there a large gap between restarts? This may indicate sensitivity to initialization and warrants more restarts or warm-start enabled.

### 8.8 Backend Logs and Export Diagnostics

The backend log and export diagnostics block are shown in `full` response level. Key export diagnostic fields:

| Field | Meaning |
|---|---|
| `classical_export_requested` | How many classical candidates were requested |
| `classical_export_actual` | How many were returned (may be lower due to deduplication) |
| `classical_cap_reason` | Explanation of any reduction |
| `qaoa_export_requested` | Requested QAOA rows (default 5,000) |
| `qaoa_export_actual` | Rows actually exported |
| `qaoa_exact_states` | State space size; states evaluated; states exported (exact mode only) |

---

## 9. IBM Hardware Second Opinion

### 9.1 Overview

When **Qiskit on IBM Hardware** is selected as the second opinion, the backend reconstructs the optimized QAOA circuit in Qiskit, transpiles it for a real IBM quantum device, submits the job, and integrates the hardware measurement counts into the result.

This is intended for: cross-platform validation, demonstrating end-to-end quantum hardware execution, and comparing noise-free simulation against real hardware.

### 9.2 IBM Quantum Session Setup

In the IBM Quantum hardware panel:

| Field | Description |
|---|---|
| **IBM API token** | Your personal IBM Quantum API token. Used only for this run; not stored in result files. |
| **IBM instance** | IBM Quantum platform instance string (default `open-instance`). |
| **Optional backend override** | Leave blank for auto-selection of the best available backend. Or specify a backend name (e.g., `ibm_fez`). |
| **Fractional gates** | When enabled, uses RZZ gates instead of CX-RZ-CX for ZZ interactions. May reduce transpiled depth on backends that support fractional gates natively. |
| **Parallelization** | Groups non-overlapping two-qubit terms into parallel rounds. |

### 9.3 Pre-Run Hardware Depth Estimate

Before submitting, the tool shows:

| Metric | Description |
|---|---|
| Est. total gates | Logical gate count before transpilation |
| Est. 2Q gates | Logical CX / ZZ gate count |
| Est. sequential 2Q | Depth counted as sequential two-qubit operations — key hardware resource metric |
| HW reference limit | 2,000 (ibm_fez current reference) — warnings appear if estimate exceeds this |

> For the 16-qubit demo (p=2): 800 total logical gates, 480 CX gates, sequential 2Q depth = 480. After transpilation to ibm_fez native gates: 4,831 total transpiled gates, 1,158 CZ gates, transpiled depth 963.

### 9.4 Shot Count Logic

The number of hardware shots is determined automatically:

- **Exact probability mode** (Lightning Sim ≤ 24 qubits): 4,096 shots by default, to make hardware results comparable in scale to the exact probability distribution.
- **Sampling mode**: Matches the `qaoa_shots` setting used by the internal simulator.

### 9.5 Bit Order and Counts Decoding

IBM Qiskit uses a reversed bit ordering convention: the Qiskit counts key `cN-1...c0` maps to optimizer order `q0...qN-1`. The backend handles this reversal automatically, so all candidate tables report bitstrings in consistent optimizer order.

### 9.6 IBM Hardware Diagnostics (Full Response)

Available in `full` response level after a successful IBM hardware run:

| Diagnostic | Meaning |
|---|---|
| Backend | Selected IBM device (e.g., `ibm_fez`) |
| IBM job ID | Job identifier for audit / IBM Quantum dashboard lookup |
| Qiskit version | Qiskit SDK version used (e.g., 2.4.1) |
| Runtime version | IBM Runtime version (e.g., 0.46.1) |
| Queue wait / Execution / Total | Actual hardware timing breakdown |
| Transpiled depth | Post-transpilation circuit depth on target device |
| Transpiled 2Q gates | Number of native 2-qubit gates after transpilation |
| Transpiled 2Q depth | Sequential 2Q depth after transpilation |
| Circuit size after transpilation | Total gate count after transpilation |
| Parse status | Confirms counts were successfully decoded |

---

## 10. Review Files and Code Exports

### 10.1 Review File (JSON)

**Save Review File:** Captures the full result view — metrics, tables, charts, logs, settings, and workbook filename — as a self-contained local JSON file. Loading a review file restores the complete result view without rerunning the backend.

**Download Raw JSON Data:** Saves the raw backend result JSON, including the embedded code-export package needed to regenerate notebooks and scripts later. This is the primary artifact for audit, archival, and downstream processing.

**Load Review / Raw JSON File:** Loads a previously saved review or raw JSON file. Note: a review file loaded without the original workbook cannot be rerun — it is a read-only result snapshot.

### 10.2 Code Exports

Code exports generate executable quantum circuit files from the optimization result. They use the `best_gammas` and `best_betas` angle parameters embedded in the result JSON, together with the QUBO-derived Ising Hamiltonian.

| Export | Format | Description |
|---|---|---|
| **Qiskit Notebook** | `.ipynb` | Builds the QAOA circuit as a Qiskit `QuantumCircuit`, runs statevector simulation, computes output probabilities, and optionally includes an IBM Runtime cell for hardware submission. Python 3.9+ recommended. |
| **Qiskit Python** | `.py` | Script-style version of the Qiskit notebook. Useful for reproducible review, CI-style checks, or integration into existing Python workflows. |
| **PennyLane Notebook** | `.ipynb` | Cross-framework reconstruction using PennyLane's `default.qubit` device. Reads out exact probabilities. Python 3.11+ kernel recommended for this notebook. |
| **Google Cirq Notebook** | `.ipynb` | Alternative circuit framework using Cirq's `cirq_google` gates. Useful for comparison runs on Google-compatible simulators. |
| **Quantinuum Notebook** | `.ipynb` | Planned for a later release. |

> **Important:** Code exports require a completed QAOA run or a loaded result JSON that contains the code-export package. The export buttons are disabled until the required package is available. Code exports also require a license key at Tester level or above.

### 10.3 Circuit Construction Details

The exported Qiskit circuit uses the same gate decomposition as the internal PennyLane circuit:

```python
# Initialization
for wire in range(n):
    circuit.h(wire)

# Cost layer (repeated p times)
for wire, h_coeff in enumerate(h_terms):           # 1Q diagonal (RZ)
    circuit.rz(2 * gamma * h_coeff, wire)
for (ctrl, tgt), j_coeff in j_terms.items():        # 2Q ZZ (CX-RZ-CX)
    circuit.cx(ctrl, tgt)
    circuit.rz(2 * gamma * j_coeff, tgt)
    circuit.cx(ctrl, tgt)

# Mixer layer (repeated p times)
for wire in range(n):
    circuit.rx(2 * beta, wire)
```

The counts key from IBM hardware measurement results is reversed (`cN-1...c0` → `q0...qN-1`) to match the optimizer's internal bitstring convention before any candidate table is built.

---

## 11. Access Levels and Limits

Access is controlled by license key. The key is validated at submission time; limits may evolve. Current V9.2 levels:

| Level | Level ID | Key required | Max qubits (general) | Lightning Sim max qubits | Max layers | Max iterations | Max restarts | Max runtime | Upload |
|---|---|---|---|---|---|---|---|---|---|
| **Public Demo** | 0 | No | 8 | 8 (1 layer, 10 iter, 1 restart) | 3 | 60 | 1 | 60 s | 5 MB |
| **Qualified Demo** | 1 | Yes | 16 | 8 (2 layers, 20 iter, 1 restart) | 5 | 100 | 3 | 4 min | 10 MB |
| **Tester** | 2 | Yes | 24 | 16 (6 layers, 200 iter, 3 restarts) | 8 | 300 | 5 | 45 min | 25 MB |
| **Internal Power** | 3 | Yes | 24 | 24 (8 layers, 300 iter, 5 restarts) | 8 | 300 | 5 | 2 h | 25 MB |
| **Internal QAOA 30** | 4 | Yes | 30 | 30 (6 layers, 300 iter, 3 restarts) | 6 | 300 | 3 | 2 h | 25 MB |
| **Internal Ultra** | 5 | Yes | 35 | 35 (10 layers, 300 iter, 3 restarts) | 10 | 300 | 3 | 30 days | 25 MB |

**Feature availability by level:**

| Feature | Public Demo | Qualified Demo | Tester | Internal |
|---|---|---|---|---|
| Classical mode | ✓ | ✓ | ✓ | ✓ |
| QAOA Lightning Sim | ✓ | ✓ | ✓ | ✓ |
| QAOA Tensor Sim | — | — | ✓ | ✓ |
| Qiskit simulation (2nd opinion) | — | — | ✓ | ✓ |
| IBM Hardware (2nd opinion) | — | — | ✓ | ✓ |
| Code exports (Qiskit / PennyLane / Cirq) | — | — | ✓ | ✓ |
| Identity shown in Access panel | — | ✓ | ✓ | ✓ |

**Key metadata shown in Access panel** (authenticated keys):

| Field | Description |
|---|---|
| Key ID | Unique key identifier |
| Level | Usage level name |
| Status | `active`, `revoked`, `expired`, `suspended` |
| Name / Organization | Registered holder |
| Expires | Expiry timestamp (ISO 8601) |
| Max runs / Used runs / Remaining runs | Run budget tracking (where enforced) |
| Max runtime | Cumulative runtime limit |
| General limits | Summary of effective qubit, layer, iteration, and runtime limits |

---

## 12. Worker Profiles

Worker profiles control the backend CPU and memory resources allocated to the Cloud Run job. Each run dispatches to a dedicated profile-matched job.

| Profile | CPU | Memory | Qubit capacity | Level requirement | Description |
|---|---|---|---|---|---|
| **Small** | 2 vCPU | 2 GiB | Up to ~18 qubits (QAOA) | All levels | For small examples and quick tests. Good for ≤16-qubit demos. |
| **Medium** | 4 vCPU | 4 GiB | Up to ~25 qubits (QAOA) | Tester+ | For larger simulations requiring more memory. |
| **Large** | 4 vCPU | 8 GiB | Unlimited (policy-gated) | Internal Power+ | For heavy QAOA runs with many qubits or restarts. |

**Automatic capacity check:** If the selected profile is too small for the problem size and mode (e.g., 20 qubits on Small), the backend returns an error before the run starts, specifying the minimum required profile.

**Profile selection guidance:**
- 16-qubit runs in QAOA Lightning Sim mode fit comfortably on Small (peak memory ~0.49 GiB observed in the demo run).
- Use Medium for 20–24 qubit QAOA simulations or runs with many restarts at high depth.
- Large is reserved for the heaviest experiments at the upper qubit limits.

---

## 13. Memory Telemetry

The backend worker reports memory usage observations at regular intervals (approximately every 10 seconds during execution). The Memory Diagnostics panel (full response level) shows:

| Metric | Description |
|---|---|
| Current memory usage | GiB used at last observation |
| Memory limit | Profile memory ceiling (2 / 4 / 8 GiB depending on profile) |
| Remaining within job limit | Headroom remaining |
| Peak memory usage | Maximum observed across all samples |
| Sample count | Number of memory observations recorded during the run |
| Memory usage chart | Time-series plot of memory usage against the job limit |

Memory is read from Linux cgroup counters (`/sys/fs/cgroup/memory.current` or the v1 equivalent) directly inside the container. The peak figure is the most useful for profile selection planning.

**From the 16-qubit demo run:** Peak 0.49 GiB on a 2 GiB Small profile, with 11 samples. This leaves 75% headroom, confirming Small is well-suited for this problem size.

---

## 14. Good Practice and Troubleshooting

### 14.1 Recommended Workflow Discipline

- Always **inspect the workbook** before running. The inspect step is fast and catches structural errors, budget inconsistencies, and missing columns that would otherwise waste a run.
- Use **Classical Only** mode first on a new workbook to validate inputs and see the classical baseline before spending time on a QAOA run.
- **Save a Review File** for any run that may be discussed with clients, technical reviewers, or stakeholders. The review file is the complete reproducibility artifact.
- Treat QAOA results as **rapid prototypes**, not as production investment decisions. The tool is designed for education, demonstration, and structured exploration.
- Compare top-QUBO and top-probability tables deliberately. Disagreement between them is information, not a bug.

### 14.2 Troubleshooting Guide

| Situation | Recommended action |
|---|---|
| Workbook does not inspect (error on upload) | Check for required sheets (`Settings`, `Assets`, `AnnualizedCovariance`). Ensure required columns are present and headers match exactly. Check that numeric fields (costs, returns, volatilities, covariance values) contain only numbers. |
| Workbook inspects but shows warnings | Review the warnings in the Workbook Summary. Common causes: fixed holdings exceed budget; no variable blocks defined; budget too small relative to fixed holdings. |
| Type constraint validation fails | Ensure `Additional Type Constraints` is an integer 0–5. Check that `Type X Size` columns exist in the Assets sheet and contain only numeric values. Verify that `Type X Budget` is a positive number and `Type X Budget Penalty` is ≥ 0. |
| Runtime estimate exceeds limit | Reduce qubits (remove variable rows), reduce QAOA layers, reduce iterations, reduce restarts, or upgrade the key level / worker profile. |
| Run times out | The backend enforces a runtime cap per key level. Use Classical Only for a quick check, or use a smaller workbook / fewer layers. |
| QAOA result differs significantly from classical | This is expected for shorter circuits. Try increasing layers (p), iterations, and restarts. Enable warm start. Review whether penalty weights are balanced — a budget penalty that is too high can dominate the objective. |
| All QAOA candidates have similar bitstrings | The circuit may have converged prematurely. Increase restarts, enable restart perturbation, or increase iterations. |
| IBM hardware job fails or times out | Check the IBM token is valid. Review the pre-run circuit depth estimate — if the sequential 2Q depth approaches 2,000, hardware execution may be noisy or rejected. Reduce circuit depth by using fewer layers. |
| PennyLane notebook import error | Use a Python 3.11+ Jupyter kernel and run the first install cell (`%pip install pennylane`), then restart the kernel. |
| Qiskit notebook cell fails on package import | Run the first install cell (`%pip install qiskit qiskit-aer qiskit-ibm-runtime`), then restart or rerun from the top. |
| Code export buttons are disabled | Complete a QAOA run, or load a result JSON that contains the code-export package. Ensure the key level is Tester or above. |
| Memory exceeded during job | The backend will fail the job with a memory-exceeded error. Upgrade the worker profile or reduce the problem size (fewer qubits, fewer iterations). |

### 14.3 Penalty Tuning

Penalty weights are the most impactful settings for result quality. General guidance:

- **Budget lambda (λ_b):** Start at 50. If the selected amount is consistently far from the budget, increase to 100 or 200. If the budget term completely dominates QUBO and all candidates select the same assets, reduce it.
- **Risk lambda (λ_v):** Start at 6. Increase to emphasize lower-volatility portfolios; decrease to allow higher-return (higher-volatility) selections.
- **Subtype budget penalty (λ_k):** Start at 50. If a subtype is consistently missed, increase. If one subtype penalty dominates the QUBO breakdown (check the type-budget term column), consider whether the target is achievable given the available variable blocks.

The QUBO breakdown panel is the fastest way to diagnose penalty balance.

---

## Appendix A — Settings Field Reference

### A.1 Excel Settings Sheet Fields

| Field name (Settings sheet) | Type | Description |
|---|---|---|
| `Budget` | Numeric | Total portfolio budget in USD (or chosen currency). |
| `Lambda Budget` | Numeric | Penalty weight for total budget constraint. |
| `Lambda Variance` | Numeric | Penalty weight for portfolio variance. |
| `Risk Free Rate` | Numeric (decimal) | Annual risk-free rate, e.g., `0.04` for 4%. |
| `QAOA P` | Integer | QAOA depth (layers). |
| `QAOA Maxiter` | Integer | Maximum optimizer iterations per restart. |
| `QAOA Multistart Restarts` | Integer | Number of independent optimizer restarts. |
| `QAOA Shots` | Integer | Shots used when sampling mode is active. |
| `Warm Start` | Boolean | `true`/`false` — enable layerwise warm start. |
| `Restart Perturbation` | Numeric (decimal) | Noise magnitude for restart initialization. |
| `Random Seed` | Integer 0–4,294,967,295 | Optional reproducibility seed. |
| `Additional Type Constraints` | Integer 0–5 | Number of active subtype budget constraints. |
| `Type A Name` … `Type E Name` | Text | User-facing label for each subtype. |
| `Type A Budget` … `Type E Budget` | Numeric | Target exposure for each subtype. |
| `Type A Budget Penalty` … `Type E Budget Penalty` | Numeric ≥ 0 | Penalty weight for each subtype constraint. |

### A.2 UI Form Fields

| UI field | Type | Notes |
|---|---|---|
| License key | Text | Optional for public demo. Required for keyed tiers and code exports. |
| Excel file | `.xlsx` | Use a demo workbook as a template for required structure. |
| Mode | Dropdown | `Classical Only`, `QAOA Lightning Sim`, `QAOA Tensor Sim`. Availability depends on key level. |
| 2nd opinion | Dropdown | `Internal only`, `Qiskit simulation`, `Qiskit on IBM Hardware`. Requires Tester+ for non-internal. |
| Worker profile | Dropdown | `Small`, `Medium`, `Large`. Availability depends on key level. |
| Response level | Dropdown | `compact`, `standard`, `full`. All levels support all response levels. |
| Layers | Integer | Overrides workbook `QAOA P` if set. |
| Iterations | Integer | Overrides workbook `QAOA Maxiter` if set. |
| Restarts | Integer | Overrides workbook `QAOA Multistart Restarts` if set. |
| QAOA shots | Integer or `exact` | `exact` shown in exact-probability mode. |
| Budget lambda | Numeric | Overrides workbook `Lambda Budget` if set. |
| Risk lambda | Numeric | Overrides workbook `Lambda Variance` if set. |
| Risk-free rate | Numeric | Overrides workbook `Risk Free Rate` if set. |
| Restart perturbation | Numeric | Overrides workbook `Restart Perturbation` if set. |
| Random seed | Integer | Optional. Overrides workbook `Random Seed` if set. |
| IBM API token | Text | Session-only token for IBM hardware runs. Not stored in result files. |
| IBM instance | Text | IBM Quantum platform instance (default `open-instance`). |
| IBM backend override | Text | Leave blank for auto-select. |

---

## Appendix B — Glossary

| Term | Plain-language meaning |
|---|---|
| **QUBO** | Quadratic Unconstrained Binary Optimization. A problem formulation where all decisions are binary (0 or 1) and the objective is a quadratic polynomial over those variables. |
| **Ising model** | An equivalent quantum-friendly reformulation of the QUBO. Binary variables become ±1 spin variables; the QUBO matrix maps to Pauli Z operators. |
| **QAOA** | Quantum Approximate Optimization Algorithm. A variational quantum algorithm that encodes the QUBO Hamiltonian into a quantum circuit with alternating cost and mixer unitaries, optimizing angle parameters classically. |
| **PennyLane** | The quantum machine learning framework (by Xanadu) used as the QAOA simulation backend. Version 9 uses `lightning.qubit` (C++ statevector) and `default.tensor` (tensor network). |
| **Statevector** | A complete description of a quantum state as a vector of 2^n complex amplitudes. In exact-probability mode, the full statevector is computed and squared to give exact bitstring probabilities. |
| **Bitstring** | A string of *n* binary digits (0s and 1s) representing a portfolio selection. Bit *i* = 1 means variable block *i* is selected. |
| **Fixed asset** | A portfolio block with `Decision Role = fixed`. Always included; no qubit consumed. |
| **Variable asset** | A portfolio block with `Decision Role = variable`. The optimizer decides whether to include it. Consumes one qubit. |
| **QUBO value** | The numerical objective value assigned to a given bitstring by the QUBO formulation. Lower is better (within the same penalty configuration). |
| **Probability (QAOA)** | The readout probability of a given bitstring — how likely the quantum circuit is to measure that portfolio selection. |
| **Exact probability mode** | Lightning Sim mode for ≤ 24 qubits. Computes the full probability distribution over all 2^n bitstrings without sampling noise. |
| **Sampling mode** | Measurement-based mode. The circuit is "measured" `qaoa_shots` times; probabilities are estimated from observed frequencies. |
| **Second opinion** | An independent reconstruction and evaluation of the QAOA circuit in a different framework (Qiskit) or on real quantum hardware (IBM), used for cross-validation. |
| **Review file** | A JSON snapshot of a completed result. Restores the full view in the browser without rerunning the backend. |
| **Code-export package** | A self-contained data block embedded in the result JSON, containing the QUBO, Ising terms, optimized angles, and metadata needed to regenerate notebooks. |
| **Worker profile** | The Cloud Run job resource tier (Small / Medium / Large) allocated for backend execution. |
| **Runtime estimate** | A pre-run predicted job duration, calibrated from known algorithm complexity. The live backend ETA during execution is more accurate. |
| **Budget gap** | Selected amount − total budget. Negative means slightly below budget (typical), zero means exact, positive means over budget (penalty applies). |
| **Type-budget term** | The sum of all active subtype budget penalty contributions in the QUBO objective. |
| **Warm start** | An optimizer initialization strategy where layer *p* angles are seeded from the optimized layer *p−1* solution, rather than random initialization. |
| **Transpilation** | The process of converting a logical quantum circuit (e.g., CX + RZ gates) into the native gate set of a specific hardware device, typically increasing the gate count and depth. |
| **Sequential 2Q depth** | The critical path length counting only two-qubit gates — the primary resource metric for hardware execution feasibility. |

---

## Disclaimer

This manual describes a rapid prototyping and education tool. Outputs are intended for technical review, experimentation, demonstration, and structured discussion. They are not financial advice and should not be used as the sole basis for investment, risk, or production technology decisions. Quantum hardware results include noise effects intrinsic to current-generation devices and should be interpreted in that context.

---

*qubit-lab.ch | QAOA RQP Pro V9.2 | Client User Manual*  
*Generated from source inspection of Version 9 backend — May 2026*
