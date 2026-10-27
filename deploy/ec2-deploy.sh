#!/usr/bin/env bash
# ============================================================
# AI Surveillance System — App Deployment Script
# Run AFTER ec2-setup.sh from INSIDE the project directory.
# Usage: bash deploy/ec2-deploy.sh
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn()  { echo -e "${YELLOW}[⚠] $1${NC}"; }
error() { echo -e "${RED}[✘] $1${NC}"; exit 1; }

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo ""
echo "=============================================="
echo "  🛡️  AI Surveillance System — Deploy"
echo "  Backend + Frontend + Nginx + SystemD"
echo "=============================================="
echo ""

# ── Auto-detect EC2 Public IP ──
EC2_PUBLIC_IP=$(curl -s --connect-timeout 3 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
if [ -z "$EC2_PUBLIC_IP" ]; then
    # IMDSv2 fallback
    TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null || echo "")
    if [ -n "$TOKEN" ]; then
        EC2_PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
    fi
fi

if [ -z "$EC2_PUBLIC_IP" ]; then
    warn "Could not auto-detect Public IP. Enter manually:"
    read -rp "  EC2 Public IP: " EC2_PUBLIC_IP
fi

info "EC2 Public IP: $EC2_PUBLIC_IP"

# ═══════════════════════════════════════
# BACKEND SETUP
# ═══════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ BACKEND SETUP ━━━${NC}"

cd "$BACKEND_DIR"

# Virtual environment
if [ ! -d "venv" ]; then
    info "Creating Python 3.11 virtual environment..."
    python3.11 -m venv venv 2>/dev/null || python3 -m venv venv
fi

source venv/bin/activate
info "Virtual environment activated"

# Upgrade pip
pip install --upgrade pip -q

# Install dependencies (CPU PyTorch)
info "Installing Python dependencies (this takes 10-15 min on first run)..."
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt -q

# Create .env if missing
if [ ! -f ".env" ]; then
    warn ".env file not found! Creating from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        warn "IMPORTANT: Edit backend/.env and set your MONGODB_URL and SECRET_KEY!"
        warn "  Run: nano $BACKEND_DIR/.env"
    else
        cat > .env <<'ENVEOF'
APP_NAME=AI Surveillance System
APP_VERSION=1.0.0
DEBUG=false
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
DETECTION_ENABLED=true
SECRET_KEY=change-me-to-a-long-random-string-2026
MONGODB_URL=
MONGODB_DATABASE=ai_surveillance
GROQ_API_KEY=
ENVEOF
        warn "IMPORTANT: Edit backend/.env and set your MONGODB_URL!"
    fi
fi

# Seed database
info "Seeding SQLite database..."
python seed_sqlite.py 2>/dev/null || warn "Seed script had issues (may be OK if already seeded)"

# Pre-cache EasyOCR models
info "Pre-caching EasyOCR weights for ANPR..."
python -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False)" 2>/dev/null || warn "EasyOCR pre-cache skipped"

info "Backend dependencies installed ✅"

# ═══════════════════════════════════════
# FRONTEND SETUP
# ═══════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ FRONTEND SETUP ━━━${NC}"

cd "$FRONTEND_DIR"

# Install npm dependencies
info "Installing frontend npm dependencies..."
npm install --silent 2>/dev/null || npm install

# Write production .env with auto-detected IP
info "Configuring frontend for EC2 IP: $EC2_PUBLIC_IP"
cat > .env.production <<FENVEOF
VITE_API_URL=
VITE_WS_URL=
FENVEOF

# Build frontend
info "Building frontend production bundle..."
npm run build

info "Frontend built successfully ✅"

# ═══════════════════════════════════════
# NGINX CONFIGURATION
# ═══════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ NGINX SETUP ━━━${NC}"

# Set permissions
sudo chmod -R 755 "$FRONTEND_DIR/dist"
sudo chmod 711 /home/ec2-user

# Write Nginx config
sudo tee /etc/nginx/conf.d/surveillance.conf > /dev/null <<NGXEOF
# AI Surveillance System - Nginx Reverse Proxy
server {
    listen 80;
    server_name _;

    # Frontend static files (React build)
    root ${FRONTEND_DIR}/dist;
    index index.html;

    # SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 300s;
        proxy_read_timeout 300s;
    }

    # WebSocket proxy
    location /api/v1/ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
    }

    # Health check & docs proxy
    location /health { proxy_pass http://127.0.0.1:8000; }
    location /docs   { proxy_pass http://127.0.0.1:8000; }
    location /redoc  { proxy_pass http://127.0.0.1:8000; }
    location /openapi.json { proxy_pass http://127.0.0.1:8000; }

    # Evidence snapshots
    location /evidence/ {
        alias ${BACKEND_DIR}/evidence/;
    }

    client_max_body_size 50M;
}
NGXEOF

# Ensure clean base nginx.conf that delegates to conf.d/ without conflicting default server
sudo tee /etc/nginx/nginx.conf > /dev/null <<'BASECONF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

include /usr/share/nginx/modules/*.conf;

events {
    worker_connections 1024;
}

http {
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile            on;
    tcp_nopush          on;
    keepalive_timeout   65;
    types_hash_max_size 4096;

    include             /etc/nginx/mime.types;
    default_type        application/octet-stream;

    include /etc/nginx/conf.d/*.conf;
}
BASECONF

# Test & start Nginx
sudo nginx -t
sudo systemctl start nginx 2>/dev/null || sudo systemctl restart nginx
sudo systemctl enable nginx

info "Nginx configured and running ✅"

# ═══════════════════════════════════════
# SYSTEMD SERVICE
# ═══════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ SYSTEMD SERVICE ━━━${NC}"

sudo tee /etc/systemd/system/surveillance-backend.service > /dev/null <<SVCEOF
[Unit]
Description=AI Surveillance Backend (FastAPI + Uvicorn)
After=network.target

[Service]
Type=exec
User=ec2-user
Group=ec2-user
WorkingDirectory=${BACKEND_DIR}
Environment="PATH=${BACKEND_DIR}/venv/bin:/usr/bin:/usr/local/bin"
ExecStart=${BACKEND_DIR}/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
MemoryMax=3G
TasksMax=100

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl start surveillance-backend
sudo systemctl enable surveillance-backend

info "Backend SystemD service running ✅"

# ═══════════════════════════════════════
# FINAL STATUS
# ═══════════════════════════════════════
echo ""
echo "=============================================="
echo -e "  ${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo ""
echo "  🌐 Frontend:  http://${EC2_PUBLIC_IP}"
echo "  📡 API Docs:   http://${EC2_PUBLIC_IP}/docs"
echo "  💚 Health:     http://${EC2_PUBLIC_IP}/health"
echo ""
echo "  🔑 Login:  admin@example.com / admin123"
echo ""
echo -e "  ${YELLOW}⚠️  Don't forget to edit backend/.env${NC}"
echo -e "  ${YELLOW}   with your MONGODB_URL and SECRET_KEY!${NC}"
echo ""
echo "  Backend logs:  sudo journalctl -u surveillance-backend -f"
echo "  Restart:       sudo systemctl restart surveillance-backend"
echo "=============================================="
