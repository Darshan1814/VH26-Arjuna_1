#!/usr/bin/env bash
# =============================================================================
# Automated Environment Setup & Launcher
# Installs all system dependencies (Docker, Compose) if missing and runs project
# =============================================================================

set -e

# Formatting colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BOLD}${CYAN}====================================================${NC}"
echo -e "${BOLD}${CYAN}   Machine Troubleshooter — Automated Setup & Run   ${NC}"
echo -e "${BOLD}${CYAN}====================================================${NC}"

OS="$(uname -s)"
log_info "Detected Operating System: $OS"

# -----------------------------------------------------------------------------
# 1. Ensure Docker & Compose are installed
# -----------------------------------------------------------------------------
install_docker_macos() {
    log_info "Checking package manager for macOS..."
    if ! command -v brew &>/dev/null; then
        log_info "Homebrew not found. Installing Homebrew..."
        NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add brew to PATH for M-series (Apple Silicon) or Intel
        if [ -f "/opt/homebrew/bin/brew" ]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [ -f "/usr/local/bin/brew" ]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    fi

    log_info "Installing Docker CLI, Docker Compose, Buildx, and Colima via Homebrew..."
    brew install colima docker docker-compose docker-buildx || true

    # Configure buildx plugin directory
    mkdir -p "$HOME/.docker/cli-plugins"
    BUILDX_BIN="$(which docker-buildx 2>/dev/null || echo '/opt/homebrew/bin/docker-buildx')"
    if [ -f "$BUILDX_BIN" ]; then
        ln -sfn "$BUILDX_BIN" "$HOME/.docker/cli-plugins/docker-buildx"
    fi
}

install_docker_linux() {
    log_info "Installing Docker and Docker Compose on Linux..."
    if command -v apt-get &>/dev/null; then
        sudo apt-get update
        sudo apt-get install -y ca-certificates curl gnupg
        curl -fsSL https://get.docker.com | sudo sh
        sudo usermod -aG docker "$USER" 2>/dev/null || true
    elif command -v dnf &>/dev/null; then
        sudo dnf install -y dnf-plugins-core
        curl -fsSL https://get.docker.com | sudo sh
        sudo usermod -aG docker "$USER" 2>/dev/null || true
    else
        log_warn "Unknown Linux package manager. Attempting convenience install script..."
        curl -fsSL https://get.docker.com | sudo sh
    fi
}

if ! command -v docker &>/dev/null; then
    log_warn "Docker CLI is not installed. Installing now..."
    if [ "$OS" = "Darwin" ]; then
        install_docker_macos
    elif [ "$OS" = "Linux" ]; then
        install_docker_linux
    else
        log_error "Unsupported OS: $OS. Please install Docker manually."
        exit 1
    fi
else
    log_success "Docker CLI is already installed: $(docker --version)"
fi

# -----------------------------------------------------------------------------
# 2. Ensure Docker daemon is running
# -----------------------------------------------------------------------------
start_docker_daemon() {
    log_info "Checking Docker daemon status..."
    if docker info &>/dev/null; then
        log_success "Docker daemon is already running."
        return 0
    fi

    log_warn "Docker daemon is not running. Starting it now..."
    if [ "$OS" = "Darwin" ]; then
        if command -v colima &>/dev/null; then
            log_info "Starting Colima VM with 4 CPUs and 8GB RAM..."
            colima start --cpu 4 --memory 8 || colima start
        elif [ -d "/Applications/Docker.app" ]; then
            log_info "Launching Docker Desktop..."
            open -a Docker
        else
            log_info "Colima not found. Installing and starting Colima..."
            brew install colima || true
            colima start --cpu 4 --memory 8
        fi
    elif [ "$OS" = "Linux" ]; then
        log_info "Starting Docker system service..."
        sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
    fi

    log_info "Waiting for Docker daemon to become responsive..."
    MAX_ATTEMPTS=30
    ATTEMPT=1
    while ! docker info &>/dev/null; do
        if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
            log_error "Timed out waiting for Docker daemon. Please ensure Docker is running."
            exit 1
        fi
        sleep 2
        ATTEMPT=$((ATTEMPT + 1))
    done
    log_success "Docker daemon is active and responsive."
}

start_docker_daemon

# -----------------------------------------------------------------------------
# 3. Environment configuration check
# -----------------------------------------------------------------------------
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        log_info "Creating .env from .env.example..."
        cp .env.example .env
        log_success "Created .env file."
    else
        log_warn "No .env or .env.example found. Creating minimal .env..."
        touch .env
    fi
else
    log_success "Configuration file .env detected."
fi

# -----------------------------------------------------------------------------
# 4. Resolve Docker Compose command
# -----------------------------------------------------------------------------
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    log_warn "Docker Compose not detected. Attempting installation..."
    if [ "$OS" = "Darwin" ]; then
        brew install docker-compose || true
    fi
    DOCKER_COMPOSE="docker compose"
fi

# -----------------------------------------------------------------------------
# 5. Build and launch services
# -----------------------------------------------------------------------------
log_info "Building and starting containers in detached mode..."
$DOCKER_COMPOSE down --remove-orphans 2>/dev/null || true
$DOCKER_COMPOSE up --build -d

# -----------------------------------------------------------------------------
# 6. Wait for service readiness
# -----------------------------------------------------------------------------
log_info "Waiting for backend service to become healthy..."
BACKEND_HEALTHY=0
for i in {1..40}; do
    if curl -s -f http://localhost:8000/health &>/dev/null; then
        BACKEND_HEALTHY=1
        break
    fi
    sleep 2
done

if [ "$BACKEND_HEALTHY" -eq 1 ]; then
    log_success "Backend is healthy and ready on http://localhost:8000"
else
    log_warn "Backend health check taking longer than expected. Continuing..."
fi

log_info "Waiting for frontend service..."
FRONTEND_READY=0
for i in {1..30}; do
    if curl -s -f http://localhost:3000 &>/dev/null; then
        FRONTEND_READY=1
        break
    fi
    sleep 2
done

if [ "$FRONTEND_READY" -eq 1 ]; then
    log_success "Frontend is ready on http://localhost:3000"
fi

echo ""
echo -e "${BOLD}${GREEN}====================================================${NC}"
echo -e "${BOLD}${GREEN}   All Services Are Up and Running!                 ${NC}"
echo -e "${BOLD}${GREEN}====================================================${NC}"
echo -e "  ${BOLD}Frontend:${NC}     http://localhost:3000"
echo -e "  ${BOLD}Backend API:${NC}  http://localhost:8000"
echo -e "  ${BOLD}API Docs:${NC}     http://localhost:8000/docs"
echo -e "  ${BOLD}Health Check:${NC} http://localhost:8000/health"
echo -e "${BOLD}${GREEN}====================================================${NC}"
echo ""
echo -e "To view live logs:    ${CYAN}$DOCKER_COMPOSE logs -f${NC}"
echo -e "To stop application:  ${CYAN}$DOCKER_COMPOSE down${NC}"
