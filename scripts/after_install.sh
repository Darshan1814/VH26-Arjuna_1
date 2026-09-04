#!/usr/bin/env bash
# =============================================================================
# CodeDeploy Hook: AfterInstall
# Configures permissions, restores/populates .env, and prepares directories
# =============================================================================

set -e

log_info() { echo -e "\033[0;34m[AFTER_INSTALL INFO]\033[0m $1"; }
log_warn() { echo -e "\033[1;33m[AFTER_INSTALL WARN]\033[0m $1"; }
log_success() { echo -e "\033[0;32m[AFTER_INSTALL SUCCESS]\033[0m $1"; }

APP_DIR="/opt/machine-troubleshooter"
cd "$APP_DIR"

log_info "Running AfterInstall configuration in $APP_DIR..."

# -----------------------------------------------------------------------------
# 1. Ensure all deployment scripts are executable
# -----------------------------------------------------------------------------
if [ -d "$APP_DIR/scripts" ]; then
    chmod +x "$APP_DIR/scripts"/*.sh
    log_success "Deployment scripts set to executable."
fi

# -----------------------------------------------------------------------------
# 2. Configure Production .env
# -----------------------------------------------------------------------------
ENV_CONFIGURED=false

# Priority A: Restore previous running .env from BeforeInstall backup
if [ -f "/tmp/machine_troubleshooter_env.bak" ]; then
    log_info "Restoring .env from previous deployment backup..."
    cp "/tmp/machine_troubleshooter_env.bak" "$APP_DIR/.env"
    ENV_CONFIGURED=true
fi

# Priority B: Check for external persistent location (/etc/machine-troubleshooter/.env or home dir)
if [ "$ENV_CONFIGURED" = false ]; then
    for PERSISTENT_ENV in "/etc/machine-troubleshooter/.env" "/home/ubuntu/.env" "/home/ec2-user/.env"; do
        if [ -f "$PERSISTENT_ENV" ]; then
            log_info "Found persistent configuration at $PERSISTENT_ENV. Copying..."
            cp "$PERSISTENT_ENV" "$APP_DIR/.env"
            ENV_CONFIGURED=true
            break
        fi
    done
fi

# Priority C: Attempt retrieval from AWS Systems Manager (SSM) Parameter Store
if [ "$ENV_CONFIGURED" = false ] && command -v aws &>/dev/null; then
    log_info "Checking AWS Systems Manager Parameter Store for /machine-troubleshooter/env..."
    REGION=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || echo "us-east-1")
    if aws ssm get-parameter --name "/machine-troubleshooter/env" --with-decryption --region "$REGION" --query "Parameter.Value" --output text > "$APP_DIR/.env" 2>/dev/null; then
        log_success "Successfully fetched environment secrets from AWS SSM."
        ENV_CONFIGURED=true
    fi
fi

# Priority D: Fallback to .env.example template
if [ "$ENV_CONFIGURED" = false ]; then
    if [ ! -f "$APP_DIR/.env" ]; then
        log_warn "No existing .env found. Creating initial .env from .env.example..."
        if [ -f "$APP_DIR/.env.example" ]; then
            cp "$APP_DIR/.env.example" "$APP_DIR/.env"
        else
            touch "$APP_DIR/.env"
        fi
        log_warn "PLEASE NOTE: Update $APP_DIR/.env with your Azure OpenAI and Supabase credentials."
    fi
fi

# Set proper permissions on .env
if [ -f "$APP_DIR/.env" ]; then
    chmod 600 "$APP_DIR/.env"
fi

# -----------------------------------------------------------------------------
# 3. Create required runtime directories and set permissions
# -----------------------------------------------------------------------------
mkdir -p "$APP_DIR/manuals"
mkdir -p "$APP_DIR/manuals/evidence"
mkdir -p "$APP_DIR/manuals/reports"
mkdir -p "$APP_DIR/backend/model_cache"
chmod -R 777 "$APP_DIR/manuals"

log_success "AfterInstall completed successfully."
