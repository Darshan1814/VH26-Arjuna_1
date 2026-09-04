#!/usr/bin/env bash
# =============================================================================
# CodeDeploy Hook: ValidateService
# Verifies health of backend API and frontend service
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[VALIDATE INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[VALIDATE SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[VALIDATE WARN]${NC} $1"; }
log_error() { echo -e "${RED}[VALIDATE ERROR]${NC} $1"; }

APP_DIR="/opt/machine-troubleshooter"
cd "$APP_DIR"

if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

# -----------------------------------------------------------------------------
# 1. Validate Backend Health (http://localhost:8000/health)
# -----------------------------------------------------------------------------
log_info "Verifying Backend API health (http://localhost:8000/health)..."
BACKEND_HEALTHY=false
MAX_BACKEND_ATTEMPTS=30
ATTEMPT=1

while [ "$ATTEMPT" -le "$MAX_BACKEND_ATTEMPTS" ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        BACKEND_HEALTHY=true
        log_success "Backend is healthy (HTTP $HTTP_CODE) after $ATTEMPT attempt(s)."
        break
    fi
    log_info "Attempt $ATTEMPT/$MAX_BACKEND_ATTEMPTS: Backend returned HTTP $HTTP_CODE. Waiting 3s..."
    sleep 3
    ATTEMPT=$((ATTEMPT + 1))
done

if [ "$BACKEND_HEALTHY" = false ]; then
    log_error "Backend health check failed after $MAX_BACKEND_ATTEMPTS attempts."
    echo "--- Docker Container Status ---"
    docker ps -a
    echo "--- Recent Backend Logs ---"
    docker compose -f "$COMPOSE_FILE" logs backend --tail=60 || true
    exit 1
fi

# -----------------------------------------------------------------------------
# 2. Validate Frontend Readiness (http://localhost:3000)
# -----------------------------------------------------------------------------
log_info "Verifying Frontend service readiness (http://localhost:3000)..."
FRONTEND_HEALTHY=false
MAX_FRONTEND_ATTEMPTS=25
ATTEMPT=1

while [ "$ATTEMPT" -le "$MAX_FRONTEND_ATTEMPTS" ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L http://localhost:3000 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "308" ]; then
        FRONTEND_HEALTHY=true
        log_success "Frontend is responsive (HTTP $HTTP_CODE) after $ATTEMPT attempt(s)."
        break
    fi
    log_info "Attempt $ATTEMPT/$MAX_FRONTEND_ATTEMPTS: Frontend returned HTTP $HTTP_CODE. Waiting 3s..."
    sleep 3
    ATTEMPT=$((ATTEMPT + 1))
done

if [ "$FRONTEND_HEALTHY" = false ]; then
    log_error "Frontend readiness check failed after $MAX_FRONTEND_ATTEMPTS attempts."
    echo "--- Docker Container Status ---"
    docker ps -a
    echo "--- Recent Frontend Logs ---"
    docker compose -f "$COMPOSE_FILE" logs frontend --tail=60 || true
    exit 1
fi

echo ""
echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}   Deployment Validation Passed Successfully!       ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "  Backend API:  http://localhost:8000/health"
echo -e "  Frontend UI:  http://localhost:3000"
echo -e "${GREEN}====================================================${NC}"
exit 0
