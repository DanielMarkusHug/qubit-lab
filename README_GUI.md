# QAOA Portfolio Optimizer - GUI Application

A cross-platform graphical application that performs quantum and classical portfolio optimization using QAOA (Quantum Approximate Optimization Algorithm) and PennyLane.

## Features

- **GUI Interface**: User-friendly graphical interface for portfolio optimization
- **Quantum & Classical**: Supports both QAOA quantum optimization and classical search
- **Market Data Integration**: Optional automatic refresh from Yahoo Finance
- **Excel Integration**: Reads input from Excel, writes results back to Excel
- **Cross-Platform**: Runs on macOS, Windows, and Linux
- **Bundled Executable**: Single standalone executable, no Python installation required

## Requirements

- Python 3.10+
- See `requirements.txt` for dependencies

## Installation

### Option 1: Run from Python (Development)

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
python qaoa_optimizer_app.py
```

### Option 2: Build Standalone Executable

```bash
# Install PyInstaller
pip install pyinstaller

# Build the executable
python build_executable.py
```

The executable will be created in `dist/` folder.

## Usage

### Setting Up Your Excel File

The Excel file should contain the following sheets:

1. **Assets**: Contains available investment options
   - Supported layouts:
   - Headers on row 1, or a title row followed by headers on row 2
   - Required columns: `Ticker`, `Expected Return Proxy`, `Annual Volatility`
   - Cost may be supplied as `Approx Cost USD`, or derived from `Current Price (USD)` and optional `Shares`
   - Optional columns include `Company`, `Shares`, `Current Price (USD)`, `Approx Cost USD`, `Allowed`

2. **Settings**: Configuration parameters
   - Key-value pairs controlling optimization behavior
   - Headers can be on row 1, or on row 2 if row 1 is a descriptive title

### Running Optimization

1. Launch the GUI (either via Python or the standalone executable)
2. Click "Browse" to select your Excel file
3. Configure optimization settings:
   - Enable/disable market data refresh
   - Enable/disable QAOA and classical search
   - Set QAOA parameters (layers, iterations)
4. Click "▶ Run Optimization"
5. Monitor progress in the status panel
6. Results are automatically written back to the Excel file

## Configuration Settings (Excel Settings sheet)

Key settings that can be configured:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `refresh_market_data` | bool | 0 | Fetch latest market data from Yahoo Finance |
| `budget_usd` | float | 1,000,000 | Portfolio budget constraint |
| `enable_qaoa` | bool | 1 | Enable QAOA quantum optimization |
| `enable_classical_search` | bool | 1 | Enable classical search |
| `qaoa_p` | int | 1 | QAOA layers (complexity) |
| `qaoa_maxiter` | int | 60 | Maximum QAOA iterations |
| `qaoa_shots` | int | 4096 | Number of measurement shots (for non-exact mode) |
| `top_n_export` | int | 20 | Number of top results to export |
| `lambda_budget` | float | 50.0 | Budget constraint weight |
| `lambda_variance` | float | 6.0 | Risk penalty weight |
| `risk_free_rate_annual` | float | 0.04 | Risk-free rate for Sharpe ratio |

## Building Executables for All Platforms

### macOS
```bash
python build_executable.py
# Creates: dist/QAOA-Optimizer-mac
```

### Windows
```bash
python build_executable.py
# Creates: dist/QAOA-Optimizer-windows.exe
```

### Linux
```bash
python build_executable.py
# Creates: dist/QAOA-Optimizer-linux
```

## Troubleshooting

### "yfinance not installed" error
If market data refresh fails:
```bash
pip install yfinance
```

### "PennyLane not installed" error
If QAOA fails to run:
```bash
pip install pennylane pennylane-lightning
```

### Quantum library issues
For best performance with PennyLane:
```bash
pip install pennylane pennylane-lightning --upgrade
```

## Architecture

- **qaoa_optimizer_app.py**: Main GUI application (tkinter)
- **qaoa_optimizer_core.py**: Core optimization logic extracted from notebook
- **build_executable.py**: PyInstaller build script

## Performance Notes

- **Problem Size**: Supports up to ~24-30 qubits for QAOA
- **Classical Search**: Unlimited qubit count but slower
- **QAOA Layers**: p=1-3 recommended for desktop, p=1-2 for quick runs
- **Market Data**: First refresh takes ~30s (12 months of daily data per ticker)

## Dependencies

- **numpy**: Numerical computing
- **pandas**: Data manipulation
- **scipy**: Optimization algorithms
- **matplotlib**: Plotting
- **openpyxl**: Excel file I/O
- **pennylane**: Quantum computing framework
- **pennylane-lightning**: Fast quantum simulator
- **yfinance**: Market data (optional)

## File Structure

```
QAOA-Optimizer/
├── qaoa_optimizer_app.py          # GUI application
├── qaoa_optimizer_core.py         # Core optimizer logic
├── build_executable.py            # Build script
├── requirements.txt               # Python dependencies
├── README.md                      # This file
└── parametric_assets_only_input_extended.xlsx  # Example input
```

## License

[Add your license here]

## Support

For issues or questions, refer to the execution log panel in the application for detailed error messages.
