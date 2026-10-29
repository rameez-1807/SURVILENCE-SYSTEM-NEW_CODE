#!/usr/bin/env bash
# Linux / AWS EC2 Startup Script for Awiros ANPR OCR Persistent Worker
# Runs inside an isolated Python 3.11 virtual environment
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/venv"

if [ ! -f "${VENV_DIR}/bin/python" ]; then
    echo "[!] Virtual environment not found at ${VENV_DIR}"
    echo "[*] Creating Python 3.11 virtual environment..."
    python3.11 -m venv "${VENV_DIR}"
    "${VENV_DIR}/bin/pip" install --upgrade pip
    "${VENV_DIR}/bin/pip" install -r "${SCRIPT_DIR}/requirements_worker.txt"
fi

echo "[*] Starting Awiros ANPR OCR Worker daemon on http://127.0.0.1:8008..."
exec "${VENV_DIR}/bin/python" "${SCRIPT_DIR}/worker.py" --port 8008

