# Quick Start Guide - QAOA Portfolio Optimizer GUI

## 🚀 Quick Setup (2 minutes)

### Step 1: Install Dependencies
```bash
cd /path/to/QAOA-Optimizer
pip install -r requirements.txt
```

### Step 2: Run the Application
```bash
python qaoa_optimizer_app.py
```

You should see a GUI window open with:
- File selector for Excel input
- Optimization settings
- Status display panel
- Execution log

## 📦 Build Standalone Executable (Optional)

To create a single executable file that doesn't require Python:

```bash
python build_executable.py
```

This creates an executable in the `dist/` folder for your operating system:
- macOS: `QAOA-Optimizer-mac`
- Windows: `QAOA-Optimizer-windows.exe`
- Linux: `QAOA-Optimizer-linux`

## 📊 Using the Application

### 1. Prepare Your Excel File
Create an Excel file with these sheets:
- **Assets**
  - Supported layouts:
  - Row 1 = headers, starting row 2 = data
  - Optional title row on top, with headers on row 2 and data starting on row 3
  - Required columns: Ticker, Expected Return Proxy, Annual Volatility
  - Cost can be provided either as `Approx Cost USD`, or as `Current Price (USD)` and optionally `Shares`
- **Settings**
  - Supported layouts:
  - Row 1 = headers: `Key | Value`
  - Optional title row on top, with headers on row 2
  - budget_usd | 1000000
  - enable_qaoa | 1
  - enable_classical_search | 1
  - qaoa_p | 1
  - (See README for full list)

### 2. Launch Application
```bash
python qaoa_optimizer_app.py
```

### 3. Configure & Run
1. Click **Browse** → select your Excel file
2. Check/uncheck options:
   - "Refresh Market Data from Yahoo Finance" (optional)
   - "Enable QAOA Optimization" (quantum)
   - "Enable Classical Search" (heuristic)
3. Set QAOA parameters if using quantum:
   - Layers (p): 1-3 recommended
   - Max Iterations: 60 default
4. Click **▶ Run Optimization**

### 4. Monitor Progress
- Status updates show current step
- Progress bar shows overall progress
- Log panel shows detailed execution info

### 5. Access Results
Results are written directly to your Excel file in new sheets:
- **Results_Summary**: Overview statistics
- **Results_Overview**: Top N portfolio recommendations
- **Classical_Candidates**: Classical search results
- **QAOA_Samples**: Quantum algorithm results

## ⚙️ Customizing Optimization

Edit the Settings sheet in your Excel file to customize:

| Setting | Default | Purpose |
|---------|---------|---------|
| budget_usd | 1,000,000 | Total investment budget |
| lambda_budget | 50.0 | Budget constraint weight |
| lambda_variance | 6.0 | Risk penalty weight |
| qaoa_p | 1 | QAOA circuit depth (1-3) |
| qaoa_maxiter | 60 | Optimization iterations |
| top_n_export | 20 | Results to export |
| rng_seed | 42 | Reproducibility |

## 🐛 Troubleshooting

### "ModuleNotFoundError"
```bash
pip install -r requirements.txt --upgrade
```

### "yfinance not installed" 
```bash
pip install yfinance
```

### "PennyLane not installed"
```bash
pip install pennylane pennylane-lightning
```

### First run slow
- Initial PennyLane import (~20s) is normal
- First QAOA run slower due to compilation
- Subsequent runs are faster

### No results written
Check the log panel for error messages. Common issues:
- Settings sheet missing required columns
- Assets sheet has invalid data (`Approx Cost USD` or `Current Price (USD)` missing/invalid, NaN, negative prices)
- Budget constraint impossible to satisfy

## 💡 Tips

1. **Start small**: Test with QAOA p=1 first (5-10 min)
2. **Classical baseline**: Enable classical search for comparison
3. **Market data**: Refresh annually or when market conditions change
4. **Problem size**: Best performance with 15-24 assets
5. **Reproducibility**: Set rng_seed in Settings for consistent results

## 📋 Example Excel Setup

**Assets sheet:**
```
Ticker  | Company      | Current Price (USD) | Shares | Expected Return Proxy | Annual Volatility
--------|--------------|---------------------|--------|----------------------|------------------
AAPL    | Apple        | 150.00              | 1      | 0.25                 | 0.30
MSFT    | Microsoft    | 300.00              | 1      | 0.20                 | 0.25
TSLA    | Tesla        | 250.00              | 1      | 0.40                 | 0.50
```

`Approx Cost USD` can be used instead of `Current Price (USD)` and `Shares`.

**Settings sheet:**
```
Key                    | Value
-----------------------|--------
budget_usd             | 1000000
enable_qaoa            | 1
enable_classical_search| 1
qaoa_p                 | 1
qaoa_maxiter           | 60
risk_free_rate_annual  | 0.04
lambda_budget          | 50
lambda_variance        | 6
```

## 🎯 Next Steps

1. Run with sample data
2. Review Results_Overview sheet
3. Compare quantum vs classical
4. Adjust parameters and re-run
5. Export results or integrate into workflow

Happy optimizing! 🚀
