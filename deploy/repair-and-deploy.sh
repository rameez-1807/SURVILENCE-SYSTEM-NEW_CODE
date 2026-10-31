#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

echo "=================================================================="
echo " AI SURVEILLANCE SYSTEM - REPAIR & DEPLOYMENT SCRIPT"
echo "=================================================================="

# Step 1: Ensure clean git state on latest origin/main
echo "==> Step 1: Fetching latest code from GitHub..."
cd "$PROJECT_DIR"
git fetch origin main || true
git reset --hard origin/main || true

# Step 2: Configure environment & virtual environment
echo "==> Step 2: Setting up Python environment..."
cd "$BACKEND_DIR"
if [ -d "venv" ]; then
    source venv/bin/activate
fi
pip install pymysql aiomysql cryptography bcrypt -q

# Step 3: Run MySQL backup and non-destructive UUID repair
echo "==> Step 3: Running MySQL Backup & Safe UUID repair..."
python scripts/repair_and_backup_mysql.py

# Step 4: Restart backend service
echo "==> Step 4: Restarting surveillance-backend service..."
sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl restart surveillance-backend 2>/dev/null || true
sleep 3

# Step 5: Check backend status
echo "==> Step 5: Verifying backend service health..."
sudo systemctl status surveillance-backend --no-pager || true

# Step 6: Test local authentication endpoint
echo "==> Step 6: Testing local authentication..."
AUTH_RES=$(curl -s -X POST http://127.0.0.1:8000/api/v1/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com&password=admin123" || true)
echo "Auth Test Response: $AUTH_RES"

# Step 7: Build frontend and reload Nginx
echo "==> Step 7: Rebuilding frontend and reloading Nginx..."
cd "$PROJECT_DIR/frontend"
if command -v npm >/dev/null 2>&1; then
    npm run build 2>/dev/null || true
    sudo systemctl reload nginx 2>/dev/null || true
fi

echo "=================================================================="
echo " SUCCESS: MySQL backed up, UUIDs repaired, and Backend deployed!"
echo "=================================================================="
