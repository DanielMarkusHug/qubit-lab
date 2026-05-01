#!/usr/bin/env python3
"""Command-line entrypoint for the Version 3 QAOA optimizer."""

import argparse
import sys

from qaoa_optimizer_v3_core import OptimizationError, QAOAOptimizerV3


def build_parser():
    parser = argparse.ArgumentParser(description="Run the Version 3 QAOA optimizer on an Excel workbook.")
    parser.add_argument("xlsx_path", help="Path to the workbook to process")

    refresh_group = parser.add_mutually_exclusive_group()
    refresh_group.add_argument("--refresh-data", dest="refresh_override", action="store_true")
    refresh_group.add_argument("--no-refresh-data", dest="refresh_override", action="store_false")

    qaoa_group = parser.add_mutually_exclusive_group()
    qaoa_group.add_argument("--enable-qaoa", dest="enable_qaoa_override", action="store_true")
    qaoa_group.add_argument("--disable-qaoa", dest="enable_qaoa_override", action="store_false")

    classical_group = parser.add_mutually_exclusive_group()
    classical_group.add_argument("--enable-classical", dest="enable_classical_override", action="store_true")
    classical_group.add_argument("--disable-classical", dest="enable_classical_override", action="store_false")

    parser.add_argument("--qaoa-p", type=int, default=None, help="Override workbook qaoa_p")
    parser.add_argument("--qaoa-maxiter", type=int, default=None, help="Override workbook qaoa_maxiter")
    parser.add_argument("--qaoa-shots", type=int, default=None, help="Override workbook qaoa_shots")

    parser.set_defaults(
        refresh_override=None,
        enable_qaoa_override=None,
        enable_classical_override=None,
    )
    return parser


def main():
    args = build_parser().parse_args()

    optimizer = QAOAOptimizerV3(
        xlsx_path=args.xlsx_path,
        refresh_override=args.refresh_override,
        enable_qaoa_override=args.enable_qaoa_override,
        enable_classical_override=args.enable_classical_override,
        qaoa_p_override=args.qaoa_p,
        qaoa_maxiter_override=args.qaoa_maxiter,
        qaoa_shots_override=args.qaoa_shots,
        log_callback=print,
    )

    try:
        optimizer.run_all()
        return 0
    except OptimizationError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Unexpected error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
