#!/usr/bin/env bash
# ============================================================
# AI Surveillance System — Quick Update Script
# Run this to pull latest code and redeploy.
# Usage: bash deploy/ec2-update.sh
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn()  { echo -e "${YELLOW}[⚠] $1${NC}"; }

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo ""
echo "=============================================="
echo "  🔄 AI Surveillance System — Update Deploy"
echo "=============================================="
echo ""

# Pull latest code
cd "$PROJECT_DIR"
info "Pulling latest code from GitHub..."
git pull origin main 2>/dev/null || git pull personal main 2>/dev/null || git pull

# Update backend
cd "$BACKEND_DIR"
source venv/bin/activate
info "Updating Python dependencies..."
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt -q

# Update frontend
cd "$FRONTEND_DIR"
info "Updating npm dependencies..."
npm install --silent 2>/dev/null || npm install
info "Rebuilding frontend..."
npm run build

# Restart services
info "Restarting backend service..."
sudo systemctl restart surveillance-backend

info "Reloading Nginx..."
sudo systemctl reload nginx

# Health check
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    info "Backend health check: HEALTHY ✅"
else
    warn "Backend health check returned: $HTTP_CODE (may still be starting up)"
fi

echo ""
echo "=============================================="
echo -e "  ${GREEN}✅ Update deployed successfully!${NC}"
echo "=============================================="
