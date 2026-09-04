#!/usr/bin/env bash
# =============================================================================
# CodeDeploy Hook: ApplicationStop
# Gracefully stops previous running containers before new deployment
# =============================================================================

log_info() { echo -e "\033[0;34m[APPLICATION_STOP INFO]\033[0m $1"; }

APP_DIR="/opt/machine-troubleshooter"

if [ -d "$APP_DIR" ] && command -v docker &>/dev/null; then
    cd "$APP_DIR"
    log_info "Stopping active containers in $APP_DIR..."

    if [ -f "docker-compose.prod.yml" ]; then
        docker compose -f docker-compose.prod.yml down --timeout 30 2>/dev/null || true
    elif [ -f "docker-compose.yml" ]; then
        docker compose -f docker-compose.yml down --timeout 30 2>/dev/null || true
    fi
    log_info "Active containers stopped successfully."
else
    log_info "No previous application deployment found to stop."
fi

exit 0
