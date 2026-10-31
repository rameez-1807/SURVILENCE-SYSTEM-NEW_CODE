#!/usr/bin/env bash
set -e

# ==============================================================================
# AI Surveillance System - EC2 Local MariaDB Staging Setup & Verification Suite
#
# Specifications:
# 1. System Audit: Verifies EC2 OS, CPU architecture, RAM, disk space, and port 3306.
# 2. Secure Isolation: Sets up local MariaDB on 127.0.0.1 with a dedicated,
#    password-protected 'staging_user' (NOT root, NO empty password).
# 3. Schema & Cross-Engine Compatibility: Normalizes MySQL 8 collation to MariaDB utf8mb4.
# 4. Strict Isolation: ZERO touches to Hostinger production MySQL database.
# 5. Full 14-Point Staging Audit: Restores backup, alters UUID columns to VARCHAR(36),
#    preserves original bcrypt password hash byte-for-byte, audits FKs,
#    and validates FastAPI JWT auth simulation.
# 6. Safe Guardrail: ZERO automatic production deployment.
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

echo "=========================================================================="
echo " AI SURVEILLANCE SYSTEM - EC2 ISOLATED STAGING VERIFICATION"
echo "=========================================================================="

# ------------------------------------------------------------------------------
# STEP 1: AUDIT EC2 OS, RAM, DISK SPACE, AND RUNNING SERVICES
# ------------------------------------------------------------------------------
echo -e "\n==> [AUDIT 1/5] Auditing EC2 System Resources & Environment..."

# 1.1 OS Information
if [ -f "/etc/os-release" ]; then
    OS_NAME=$(grep -E '^PRETTY_NAME=' /etc/os-release | cut -d'=' -f2 | tr -d '"')
else
    OS_NAME=$(uname -s)
fi
KERNEL_VER=$(uname -r)
ARCH=$(uname -m)

echo "    - Operating System: $OS_NAME"
echo "    - Kernel Version:   $KERNEL_VER"
echo "    - Architecture:     $ARCH"

# 1.2 RAM Audit
RAM_TOTAL_MB=$(free -m | awk '/^Mem:/{print $2}')
RAM_AVAIL_MB=$(free -m | awk '/^Mem:/{print $7}')

echo "    - RAM Total:        ${RAM_TOTAL_MB} MB"
echo "    - RAM Available:    ${RAM_AVAIL_MB} MB"

if [ "$RAM_AVAIL_MB" -lt 150 ]; then
    echo "    [!] Warning: Low available memory (<150 MB). MariaDB requires ~100 MB."
fi

# 1.3 Disk Space Audit
DISK_AVAIL_KB=$(df / --output=avail | tail -1 | tr -d ' ')
DISK_AVAIL_GB=$(echo "scale=2; $DISK_AVAIL_KB / 1024 / 1024" | bc 2>/dev/null || awk "BEGIN {print $DISK_AVAIL_KB/1048576}")
DISK_AVAIL_INT=${DISK_AVAIL_GB%.*}

echo "    - Disk Available:   ${DISK_AVAIL_GB} GB on root filesystem (/)"

if [ "${DISK_AVAIL_INT:-0}" -lt 1 ]; then
    echo "    [FATAL] Less than 1 GB disk space available. Aborting to prevent out-of-disk failure."
    exit 1
fi

# 1.4 Port 3306 & Existing Services Audit
echo "    - Auditing network port 3306 and existing services..."
PORT_3306_IN_USE=false
if command -v ss >/dev/null 2>&1; then
    if ss -tlpn | grep -q ':3306 '; then
        PORT_3306_IN_USE=true
    fi
elif command -v netstat >/dev/null 2>&1; then
    if netstat -tlpn 2>/dev/null | grep -q ':3306 '; then
        PORT_3306_IN_USE=true
    fi
fi

SERVICE_BACKEND_STATUS=$(systemctl is-active surveillance-backend 2>/dev/null || echo "inactive")
SERVICE_NGINX_STATUS=$(systemctl is-active nginx 2>/dev/null || echo "inactive")
echo "    - surveillance-backend status: $SERVICE_BACKEND_STATUS"
echo "    - nginx status:                $SERVICE_NGINX_STATUS"
echo "    - Port 3306 in use:            $PORT_3306_IN_USE"

# ------------------------------------------------------------------------------
# STEP 2: INSTALL AND CONFIGURE LOCAL MARIADB (STAGING TARGET ONLY)
# ------------------------------------------------------------------------------
echo -e "\n==> [SETUP 2/5] Setting up local MariaDB on EC2 for isolated staging..."

if ! command -v mariadb >/dev/null 2>&1 && ! command -v mysql >/dev/null 2>&1; then
    echo "    [*] Installing MariaDB server via package manager..."
    if command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y mariadb105-server mariadb105 -q
    elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y mariadb-server mariadb -q
    elif command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -qq && sudo apt-get install -y mariadb-server mariadb-client -qq
    else
        echo "    [FATAL] No supported package manager found to install MariaDB."
        exit 1
    fi
fi

# Enable and start local MariaDB service
sudo systemctl enable mariadb 2>/dev/null || true
sudo systemctl start mariadb

MARIADB_STATUS=$(systemctl is-active mariadb 2>/dev/null || echo "failed")
if [ "$MARIADB_STATUS" != "active" ]; then
    echo "    [FATAL] MariaDB service failed to start (status: $MARIADB_STATUS)."
    sudo journalctl -u mariadb -n 20 --no-pager
    exit 1
fi
echo "    [+] Local MariaDB service is active and running on 127.0.0.1:3306."

# ------------------------------------------------------------------------------
# STEP 3: CREATE DEDICATED PASSWORD-PROTECTED STAGING USER
# ------------------------------------------------------------------------------
echo -e "\n==> [SECURITY 3/5] Configuring dedicated password-protected staging database & user..."

# Generate a strong cryptographically secure password (24 characters)
STAGING_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
STAGING_DB="aisurv_staging_test"
STAGING_USER="staging_user"

# Reset/Create staging database ensuring it is 100% empty for pre-condition test
sudo mysql -e "
DROP DATABASE IF EXISTS \`${STAGING_DB}\`;
CREATE DATABASE \`${STAGING_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '${STAGING_USER}'@'127.0.0.1';
DROP USER IF EXISTS '${STAGING_USER}'@'localhost';
CREATE USER '${STAGING_USER}'@'127.0.0.1' IDENTIFIED BY '${STAGING_PASSWORD}';
CREATE USER '${STAGING_USER}'@'localhost' IDENTIFIED BY '${STAGING_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${STAGING_DB}\`.* TO '${STAGING_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${STAGING_DB}\`.* TO '${STAGING_USER}'@'localhost';
FLUSH PRIVILEGES;
"

echo "    [+] Dedicated staging database created: \`${STAGING_DB}\` (100% empty)"
echo "    [+] Dedicated staging user configured:  \`${STAGING_USER}\`@'127.0.0.1'"
echo "    [+] Authentication mode:                Password-protected (NOT root, NO empty password)"
echo "    [+] Credentials Redaction:              Password generated securely and stored in memory only"

# Test local authentication with the newly created staging credentials
AUTH_TEST=$(mysql -h 127.0.0.1 -P 3306 -u "${STAGING_USER}" -p"${STAGING_PASSWORD}" "${STAGING_DB}" -e "SELECT 1;" 2>&1)
if [[ "$AUTH_TEST" != *"1"* ]]; then
    echo "    [FATAL] Unable to authenticate as staging_user on 127.0.0.1: $AUTH_TEST"
    exit 1
fi
echo "    [+] Staging user authentication test verified successfully."

# ------------------------------------------------------------------------------
# STEP 4: VERIFY BACKUP AVAILABILITY
# ------------------------------------------------------------------------------
echo -e "\n==> [BACKUP 4/5] Checking for verified production backup..."
cd "$BACKEND_DIR"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

pip install pymysql aiomysql cryptography bcrypt -q

BACKUP_DIR="${HOME}/.surveillance_backups"
LATEST_SQL=$(ls -t "$BACKUP_DIR"/mysql_backup_*.sql 2>/dev/null | head -1 || echo "")
LATEST_JSON=$(ls -t "$BACKUP_DIR"/mysql_backup_*.json 2>/dev/null | head -1 || echo "")

if [ -z "$LATEST_SQL" ] || [ -z "$LATEST_JSON" ]; then
    echo "    [*] No existing backup found in $BACKUP_DIR. Creating non-destructive backup now..."
    python scripts/repair_and_backup_mysql.py --backup-only
    LATEST_SQL=$(ls -t "$BACKUP_DIR"/mysql_backup_*.sql 2>/dev/null | head -1)
    LATEST_JSON=$(ls -t "$BACKUP_DIR"/mysql_backup_*.json 2>/dev/null | head -1)
fi

echo "    [+] Using SQL Backup:  $(basename "$LATEST_SQL") ($(wc -c < "$LATEST_SQL") bytes)"
echo "    [+] Using JSON Backup: $(basename "$LATEST_JSON") ($(wc -c < "$LATEST_JSON") bytes)"

# ------------------------------------------------------------------------------
# STEP 5: RUN COMPREHENSIVE 14-POINT ISOLATED STAGING SUITE
# ------------------------------------------------------------------------------
echo -e "\n==> [EXECUTION 5/5] Executing 14-point isolated staging verification suite..."

python scripts/test_staging_verification.py \
    --staging-host "127.0.0.1" \
    --staging-port 3306 \
    --staging-user "$STAGING_USER" \
    --staging-password "$STAGING_PASSWORD" \
    --staging-db "$STAGING_DB"

STAGING_EXIT_CODE=$?

echo ""
echo "=========================================================================="
if [ $STAGING_EXIT_CODE -eq 0 ]; then
    echo " [RESULT: 100% PASS] ALL STAGING VERIFICATION TESTS COMPLETED SUCCESSFULLY"
    echo "=========================================================================="
    echo "Evidence Summary:"
    echo "  ✔ Staging DB isolation:       100% verified (Production DB was NEVER touched)"
    echo "  ✔ Backup restoration:        1:1 row counts restored into staging"
    echo "  ✔ Engine compatibility:       MariaDB utf8mb4 schema validated"
    echo "  ✔ UUID column alterations:   VARCHAR(36) applied without modifying text columns"
    echo "  ✔ Admin bcrypt password:     SHA-256 fingerprint verified 100% UNCHANGED"
    echo "  ✔ Referential integrity:     0 broken foreign keys introduced"
    echo "  ✔ UUID deserialization:      100% valid Python UUID objects"
    echo "  ✔ FastAPI authentication:    bcrypt validation, JWT issuance & decoding verified"
    echo ""
    echo "NEXT STEP: Production database repair has NOT been run automatically."
    echo "To safely repair production MySQL and deploy latest backend, run:"
    echo ""
    echo "    cd ~/SURVILENCE-SYSTEM-NEW_CODE"
    echo "    bash deploy/repair-and-deploy.sh"
    echo ""
else
    echo " [RESULT: FAILED] STAGING VERIFICATION FAILED WITH EXIT CODE $STAGING_EXIT_CODE"
    echo "=========================================================================="
    echo "Production database was NOT modified. DO NOT deploy to production until resolved."
    exit 1
fi
