#!/usr/bin/env python3
"""
Build script for creating cross-platform executable with PyInstaller
Usage: python build_executable.py
"""

import os
import sys
import subprocess
from pathlib import Path


def ensure_pyinstaller():
    """Ensure PyInstaller is available before starting the build."""
    version_check = subprocess.run(
        [sys.executable, "-m", "PyInstaller", "--version"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if version_check.returncode == 0:
        version = version_check.stdout.strip() or version_check.stderr.strip()
        print(f"   PyInstaller available ({version})")
        return True

    print("   PyInstaller not found, attempting to install it...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pyinstaller"], check=True)
    except subprocess.CalledProcessError as exc:
        print("\n" + "=" * 70)
        print("✗ Could not install PyInstaller automatically")
        print("=" * 70)
        print("\nInstall it manually once network access is available:")
        print(f"  {sys.executable} -m pip install pyinstaller")
        print(f"\nUnderlying error: {exc}")
        return False

    return True


def main():
    """Build the executable."""
    
    script_dir = Path(__file__).parent
    app_file = script_dir / "qaoa_optimizer_app.py"
    
    if not app_file.exists():
        print(f"Error: {app_file} not found")
        sys.exit(1)
    
    print("=" * 70)
    print("QAOA Optimizer - Building Executable")
    print("=" * 70)
    
    # Install PyInstaller if needed
    print("\n1. Checking/installing PyInstaller...")
    if not ensure_pyinstaller():
        sys.exit(1)
    
    # Determine output name
    import platform
    system = platform.system()
    
    if system == "Darwin":
        output_name = "QAOA-Optimizer-mac"
    elif system == "Windows":
        output_name = "QAOA-Optimizer-windows"
    else:
        output_name = "QAOA-Optimizer-linux"
    
    print(f"\n2. Building executable for {system}...")
    print(f"   Output: {output_name}")
    
    # PyInstaller command
    cmd = [
        sys.executable,
        "-m", "PyInstaller",
        "--onefile",
        "--windowed",
        "--name", output_name,
        "--icon", str(script_dir / "app_icon.ico") if (script_dir / "app_icon.ico").exists() else None,
        str(app_file)
    ]
    
    # Remove None values from command
    cmd = [c for c in cmd if c is not None]
    
    result = subprocess.run(cmd)
    
    if result.returncode == 0:
        print("\n" + "=" * 70)
        print("✓ Build successful!")
        print("=" * 70)
        print(f"\nExecutable location:")
        print(f"  {script_dir}/dist/{output_name}")
        print(f"\nTo run:")
        if system == "Darwin":
            print(f"  ./{output_name}")
        elif system == "Windows":
            print(f"  {output_name}.exe")
        else:
            print(f"  ./{output_name}")
    else:
        print("\n✗ Build failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
