#!/usr/bin/env bash
# ============================================================
# AI Surveillance System — EC2 Server Setup Script
# Run this FIRST after SSH into a fresh Amazon Linux 2023 EC2
# Usage: bash deploy/ec2-setup.sh
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn()  { echo -e "${YELLOW}[⚠] $1${NC}"; }
error() { echo -e "${RED}[✘] $1${NC}"; }

echo ""
echo "=============================================="
echo "  🛡️  AI Surveillance System — EC2 Setup"
echo "  Amazon Linux 2023 • Python 3.11 • Node 20"
echo "=============================================="
echo ""

# ── 1. System Update ──
info "Step 1/6: System update..."
sudo yum update -y -q

# ── 2. Python 3.11 ──
info "Step 2/6: Installing Python 3.11..."
sudo yum install -y -q python3.11 python3.11-pip python3.11-devel 2>/dev/null || {
    warn "python3.11 package not found, trying python3..."
    sudo yum install -y -q python3 python3-pip python3-devel
}

# Set python3 to 3.11
if command -v python3.11 &>/dev/null; then
    sudo alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 2>/dev/null || true
    sudo alternatives --set python3 /usr/bin/python3.11 2>/dev/null || true
fi

PYTHON_VER=$(python3 --version 2>&1)
info "Python installed: $PYTHON_VER"

# ── 3. Node.js 20 ──
info "Step 3/6: Installing Node.js 20..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1
    sudo yum install -y -q nodejs
fi

NODE_VER=$(node -v 2>&1)
NPM_VER=$(npm -v 2>&1)
info "Node.js installed: $NODE_VER (npm $NPM_VER)"

# ── 4. System tools (Git, GCC, OpenGL for OpenCV) ──
info "Step 4/6: Installing system tools (git, gcc, mesa-libGL)..."
sudo yum install -y -q git gcc gcc-c++ make mesa-libGL mesa-libGL-devel 2>/dev/null || true

# ── 5. Swap File (4 GB — critical for PyTorch) ──
info "Step 5/6: Creating 4 GB swap file..."
if [ -f /swapfile ]; then
    warn "Swap file already exists, skipping."
else
    sudo dd if=/dev/zero of=/swapfile bs=128M count=32 status=progress
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab >/dev/null
    info "Swap file created and enabled."
fi

SWAP_INFO=$(free -h | grep Swap)
info "Swap status: $SWAP_INFO"

# ── 6. Nginx ──
info "Step 6/6: Installing Nginx..."
sudo yum install -y -q nginx

echo ""
echo "=============================================="
echo -e "  ${GREEN}✅ Server setup complete!${NC}"
echo ""
echo "  Python:  $(python3 --version)"
echo "  Node.js: $(node -v)"
echo "  npm:     $(npm -v)"
echo "  Nginx:   $(nginx -v 2>&1)"
echo "  Swap:    $(free -h | grep Swap | awk '{print $2}')"
echo ""
echo "  Next step → Run: bash deploy/ec2-deploy.sh"
echo "=============================================="
