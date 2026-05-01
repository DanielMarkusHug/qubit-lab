"""Gunicorn settings for the Cloud Run container."""

from __future__ import annotations

import os


bind = f":{os.getenv('PORT', '8080')}"
workers = 1
threads = 8
timeout = 300
