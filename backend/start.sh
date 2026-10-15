#!/usr/bin/env bash
set -o errexit
PORT="${PORT:-10000}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1
