#!/usr/bin/env bash
# Render Build Script for AI Surveillance Backend
set -o errexit

echo "==> Upgrading pip..."
python -m pip install --upgrade pip

echo "==> Installing Python dependencies (CPU PyTorch optimized for cloud limits)..."
if [ -f "requirements.txt" ]; then
    pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
elif [ -f "backend/requirements.txt" ]; then
    pip install --extra-index-url https://download.pytorch.org/whl/cpu -r backend/requirements.txt
fi

echo "==> Build finished successfully!"
