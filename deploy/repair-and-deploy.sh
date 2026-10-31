#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

echo "=========================================================================="
echo " AI SURVEILLANCE SYSTEM - AUDITED SAFE DEPLOYMENT & MIGRATION"
echo "=========================================================================="

# 1. Non-destructive Git update (NO git reset --hard)
echo "==> Step 1: Performing safe non-destructive Git sync..."
cd "$PROJECT_DIR"

if [ -n "$(git status --porcelain)" ]; then
    STASH_NAME="auto_stash_before_deploy_$(date +%Y%m%d_%H%M%S)"
    echo "[!] Uncommitted local changes detected. Stashing safely as '$STASH_NAME'..."
    git stash push -u -m "$STASH_NAME"
fi

echo "[*] Fetching latest commits from origin/main..."
git fetch origin main

# Fast-forward or safe rebase without destroying local files
if git merge-base --is-ancestor HEAD origin/main; then
    git merge --ff-only origin/main
    echo "[+] Fast-forward update applied successfully."
else
    echo "[*] Merging origin/main cleanly..."
    git merge origin/main --no-edit || {
        echo "[FATAL] Automatic merge conflict. Aborting deployment without altering system state."
        exit 1
    }
fi

# 2. Check environment credentials
echo "==> Step 2: Verifying database environment configuration..."
cd "$BACKEND_DIR"

if [ ! -f ".env" ]; then
    echo "[FATAL] backend/.env file not found. Please create it from .env.example before deploying."
    exit 1
fi

if [ -d "venv" ]; then
    source venv/bin/activate
fi

pip install pymysql aiomysql cryptography bcrypt -q

# 3. Step 3: Run Dry-Run Simulation First
echo "==> Step 3: Running pre-migration dry-run audit..."
python scripts/repair_and_backup_mysql.py --dry-run

# 4. Step 4: Run Live Backup & Non-Destructive UUID Repair
echo "==> Step 4: Executing verified full backup & live safe repair..."
python scripts/repair_and_backup_mysql.py

# 5. Step 5: Restart surveillance-backend service
echo "==> Step 5: Restarting backend service..."
sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl restart surveillance-backend 2>/dev/null || true
sleep 3

# Check service status
SERVICE_STATE=$(systemctl is-active surveillance-backend 2>/dev/null || echo "unknown")
echo "[*] surveillance-backend status: $SERVICE_STATE"
if [ "$SERVICE_STATE" != "active" ]; then
    echo "[!] Warning: Service is not active. Checking recent logs:"
    sudo journalctl -u surveillance-backend -n 20 --no-pager
fi

# 6. Step 6: Test Local Authentication & Endpoint Verification
echo "==> Step 6: Testing local authentication endpoint..."
HTTP_STATUS=$(curl -s -o /tmp/auth_test_res.json -w "%{http_code}" -X POST http://127.0.0.1:8000/api/v1/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com&password=admin123" || echo "000")

echo "[*] Local Auth HTTP Status: $HTTP_STATUS"
if [ -f "/tmp/auth_test_res.json" ]; then
    echo "[*] Local Auth Response Body: $(cat /tmp/auth_test_res.json)"
fi

# 7. Step 7: Build Frontend & Reload Nginx
echo "==> Step 7: Rebuilding frontend and reloading Nginx..."
cd "$PROJECT_DIR/frontend"
if command -v npm >/dev/null 2>&1; then
    npm run build 2>/dev/null || true
    sudo systemctl reload nginx 2>/dev/null || true
fi

echo "=========================================================================="
echo " DEPLOYMENT SCRIPT FINISHED - PLEASE REVIEW OUTPUT AND TEST EVIDENCE ABOVE"
echo "=========================================================================="
