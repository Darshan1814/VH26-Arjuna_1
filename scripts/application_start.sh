#!/usr/bin/env bash
# =============================================================================
# CodeDeploy Hook: ApplicationStart
# Builds and launches backend and frontend containers with Docker Compose
# =============================================================================

set -e

log_info() { echo -e "\033[0;34m[APPLICATION_START INFO]\033[0m $1"; }
log_success() { echo -e "\033[0;32m[APPLICATION_START SUCCESS]\033[0m $1"; }

APP_DIR="/opt/machine-troubleshooter"
cd "$APP_DIR"

log_info "Starting application in $APP_DIR..."

# Determine Docker Compose file (prefer production if present)
if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

log_info "Using Docker Compose configuration: $COMPOSE_FILE"

# Build and start services in background
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

log_success "Containers started in detached mode."

# Clean up dangling images and build cache to save disk space on EC2
log_info "Cleaning up unused Docker build cache and images..."
docker image prune -f || true

log_success "ApplicationStart hook finished."
