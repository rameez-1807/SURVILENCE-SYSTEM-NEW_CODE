#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "==> Generating SSL Certificate for HTTPS..."
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/selfsigned.key \
  -out /etc/nginx/ssl/selfsigned.crt \
  -subj "/C=IN/ST=Delhi/L=Delhi/O=AISurveillance/CN=18.117.247.217"

echo "==> Configuring Nginx for HTTP + HTTPS..."
sudo tee /etc/nginx/conf.d/surveillance.conf > /dev/null <<NGXEOF
# AI Surveillance System - Nginx Reverse Proxy with SSL
server {
    listen 80;
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

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

echo "==> Testing and reloading Nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "=========================================================="
echo "  HTTPS ENABLED SUCCESSFULLY!"
echo "  Secure URL: https://18.117.247.217"
echo "=========================================================="
