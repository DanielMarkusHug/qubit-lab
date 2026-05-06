#!/usr/bin/env python3
"""Generate an HMAC-SHA256 API-key hash for demo_keys.yaml."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


VERSION_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VERSION_DIR))

from app.usage_policy import generate_key_hash  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a QAOA RQP API-key HMAC hash.")
    parser.add_argument("raw_key", help="Raw API key to hash. Do not store this raw value in YAML.")
    args = parser.parse_args()
    print(generate_key_hash(args.raw_key))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

