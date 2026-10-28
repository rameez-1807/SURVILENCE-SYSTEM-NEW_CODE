#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR/backend"

source venv/bin/activate
python init_db.py
sudo systemctl restart surveillance-backend
echo "SUCCESS: Database initialized, admin seeded, and backend restarted!"
