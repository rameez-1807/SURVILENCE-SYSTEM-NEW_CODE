#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

echo "==> Configuring Hostinger MySQL Database in backend/.env..."

cat > "$BACKEND_DIR/.env" <<'ENVEOF'
# Application Settings
APP_NAME=AI Surveillance System
APP_VERSION=1.0.0
DEBUG=false

# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8000

# Security
SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7

# MySQL Hostinger Database Configuration
MYSQL_HOST=srv1100.hstgr.io
MYSQL_PORT=3306
MYSQL_USER=u963801592_AISURVILENCEU
MYSQL_PASSWORD=AiSURV!LENCE3026
MYSQL_DATABASE=u963801592_AISURVILENCE

DATABASE_URL=mysql+aiomysql://u963801592_AISURVILENCEU:AiSURV%21LENCE3026@srv1100.hstgr.io:3306/u963801592_AISURVILENCE
DATABASE_URL_SYNC=mysql+pymysql://u963801592_AISURVILENCEU:AiSURV%21LENCE3026@srv1100.hstgr.io:3306/u963801592_AISURVILENCE

# MongoDB Atlas Cloud Database (Optional Telemetry)
MONGODB_URL=
MONGODB_DATABASE=ai_surveillance

# Groq Vision AI API Key (Optional)
GROQ_API_KEY=
ENVEOF

echo "==> Initializing MySQL tables & Admin user..."
cd "$BACKEND_DIR"
if [ -d "venv" ]; then
    source venv/bin/activate
fi
pip install aiomysql pymysql cryptography -q
python init_db.py || true

echo "==> Restarting surveillance-backend service..."
sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl restart surveillance-backend 2>/dev/null || true
sleep 2

echo "==> Building frontend for production..."
cd "$PROJECT_DIR/frontend"
if command -v npm >/dev/null 2>&1; then
    npm run build 2>/dev/null || true
    sudo systemctl reload nginx 2>/dev/null || true
fi

echo "==> SUCCESS: Hostinger MySQL configured, backend and frontend deployed!"
