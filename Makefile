.PHONY: up down build logs restart clean backend-logs frontend-logs health

# Start all services
up:
	docker compose up --build

# Start in detached mode
up-d:
	docker compose up --build -d

# Stop all services
down:
	docker compose down

# Build without starting
build:
	docker compose build

# View all logs
logs:
	docker compose logs -f

# Backend logs only
backend-logs:
	docker compose logs -f backend

# Frontend logs only
frontend-logs:
	docker compose logs -f frontend

# Restart all services
restart:
	docker compose down && docker compose up --build

# Remove containers, volumes, and images
clean:
	docker compose down -v --rmi local

# Health check
health:
	@curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null || echo "Backend not running"
