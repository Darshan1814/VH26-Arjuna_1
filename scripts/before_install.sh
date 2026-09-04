#!/usr/bin/env bash
# =============================================================================
# CodeDeploy Hook: BeforeInstall
# Sets up Docker, Docker Compose, system swap, and target directories
# =============================================================================

set -e

log_info() { echo -e "\033[0;34m[BEFORE_INSTALL INFO]\033[0m $1"; }
log_warn() { echo -e "\033[1;33m[BEFORE_INSTALL WARN]\033[0m $1"; }
log_success() { echo -e "\033[0;32m[BEFORE_INSTALL SUCCESS]\033[0m $1"; }

log_info "Starting BeforeInstall preparation..."

# -----------------------------------------------------------------------------
# 1. Setup Swap Space (Prevents OOM for BGE-M3 & Reranker on <= 8GB RAM instances)
# -----------------------------------------------------------------------------
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
TOTAL_SWAP_MB=$(free -m | awk '/^Swap:/{print $2}')

log_info "Detected System RAM: ${TOTAL_RAM_MB}MB, Swap: ${TOTAL_SWAP_MB}MB"

if [ "$TOTAL_RAM_MB" -lt 7800 ] && [ "$TOTAL_SWAP_MB" -lt 2000 ]; then
    log_info "Configuring 4GB swap space to prevent memory exhaustion..."
    if [ ! -f /swapfile ]; then
        fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        if ! grep -q '/swapfile' /etc/fstab; then
            echo '/swapfile none swap sw 0 0' >> /etc/fstab
        fi
        log_success "4GB swap space created and enabled."
    else
        swapon /swapfile 2>/dev/null || true
        log_info "Existing swapfile enabled."
    fi
fi

# -----------------------------------------------------------------------------
# 2. Install Docker & Docker Compose if not already installed
# -----------------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
    log_warn "Docker not detected. Installing Docker Engine..."
    if command -v apt-get &>/dev/null; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -y
        apt-get install -y ca-certificates curl gnupg lsb-release
        curl -fsSL https://get.docker.com | sh
    elif command -v dnf &>/dev/null; then
        dnf install -y docker
    elif command -v yum &>/dev/null; then
        yum install -y docker
    fi
    log_success "Docker installed successfully."
else
    log_info "Docker is already installed: $(docker --version)"
fi

# Ensure Docker service is running
systemctl daemon-reload || true
systemctl enable docker || true
systemctl start docker || true

# Add default users to docker group if present
for USER_NAME in ubuntu ec2-user admin; do
    if id "$USER_NAME" &>/dev/null; then
        usermod -aG docker "$USER_NAME" 2>/dev/null || true
    fi
done

# Ensure docker compose plugin exists
if ! docker compose version &>/dev/null; then
    log_warn "Docker Compose plugin missing. Installing compose plugin..."
    if command -v apt-get &>/dev/null; then
        apt-get update -y && apt-get install -y docker-compose-plugin || true
    fi
fi

# -----------------------------------------------------------------------------
# 3. Prepare Target App Directory
# -----------------------------------------------------------------------------
APP_DIR="/opt/machine-troubleshooter"
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/manuals"
mkdir -p "$APP_DIR/scripts"

# Preserve existing .env if present
if [ -f "$APP_DIR/.env" ]; then
    log_info "Backing up existing production .env file..."
    cp "$APP_DIR/.env" "/tmp/machine_troubleshooter_env.bak"
fi

log_success "BeforeInstall completed successfully."
