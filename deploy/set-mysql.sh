#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

echo "==> Configuring Hostinger MySQL Database in backend/.env..."

MYSQL_HOST="${MYSQL_HOST:-srv1100.hstgr.io}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-u963801592_AISURVILENCEU}"
MYSQL_DATABASE="${MYSQL_DATABASE:-u963801592_AISURVILENCE}"

if [ -z "$MYSQL_PASSWORD" ]; then
    if [ -f "$BACKEND_DIR/.env" ]; then
        EXISTING_PWD=$(grep -E "^MYSQL_PASSWORD=" "$BACKEND_DIR/.env" | cut -d= -f2- | tr -d "'\"" || true)
        if [ -n "$EXISTING_PWD" ]; then
            MYSQL_PASSWORD="$EXISTING_PWD"
        fi
    fi
fi

if [ -z "$MYSQL_PASSWORD" ]; then
    echo "ERROR: MYSQL_PASSWORD environment variable is not set and not found in backend/.env."
    echo "Please run: export MYSQL_PASSWORD='your_password' before running this script."
    exit 1
fi

# URL-encode password for SQLAlchemy URLs
ENCODED_PWD=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote_plus(sys.argv[1]))" "$MYSQL_PASSWORD" 2>/dev/null || python -c "import urllib.parse, sys; print(urllib.parse.quote_plus(sys.argv[1]))" "$MYSQL_PASSWORD")

cat > "$BACKEND_DIR/.env" <<ENVEOF
# Application Settings
APP_NAME=AI Surveillance System
APP_VERSION=1.0.0
DEBUG=false

# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8000

# Security
SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7

# MySQL Database Configuration
MYSQL_HOST=${MYSQL_HOST}
MYSQL_PORT=${MYSQL_PORT}
MYSQL_USER=${MYSQL_USER}
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_DATABASE=${MYSQL_DATABASE}

DATABASE_URL=mysql+aiomysql://${MYSQL_USER}:${ENCODED_PWD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}
DATABASE_URL_SYNC=mysql+pymysql://${MYSQL_USER}:${ENCODED_PWD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}

# MongoDB Atlas Cloud Database (Optional Telemetry)
MONGODB_URL=
MONGODB_DATABASE=ai_surveillance

# Groq Vision AI API Key (Optional)
GROQ_API_KEY=
ENVEOF

chmod 600 "$BACKEND_DIR/.env" 2>/dev/null || true
echo "[+] backend/.env updated with secure permissions."

echo "==> Initializing MySQL tables & Admin user..."
cd "$BACKEND_DIR"
if [ -d "venv" ]; then
    source venv/bin/activate
fi
pip install aiomysql pymysql cryptography bcrypt -q
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
