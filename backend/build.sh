#!/usr/bin/env bash
# Render Build Script for AI Surveillance Backend (inside backend/)
set -o errexit

echo "==> Upgrading pip..."
python -m pip install --upgrade pip

echo "==> Installing Python dependencies (CPU PyTorch optimized for cloud limits)..."
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

echo "==> Pre-caching EasyOCR weights for instant ANPR plate scanning..."
python -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False)" || true

echo "==> Backend build finished successfully!"
