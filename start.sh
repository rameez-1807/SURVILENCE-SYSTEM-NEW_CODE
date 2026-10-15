#!/usr/bin/env bash
set -o errexit
PORT="${PORT:-10000}"
if [ -d "backend" ]; then
    cd backend
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1
