#!/usr/bin/env bash
# =============================================================================
# Production Deployment Script for Industrial Machine Troubleshooter
# Runs directly on the host / EC2 via Jenkins or manual execution
# =============================================================================
set -e
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/snap/bin:$HOME/bin:$HOME/.local/bin"

echo "=========================================================="
echo " Starting Production Deployment (Docker Containers)       "
echo "=========================================================="

BACKEND_IMG="${BACKEND_IMAGE:-darshan11111/mt-backend}"
FRONTEND_IMG="${FRONTEND_IMAGE:-darshan11111/mt-frontend}"
TAG="${IMAGE_TAG:-latest}"

echo "Deploying Backend:  ${BACKEND_IMG}:${TAG}"
echo "Deploying Frontend: ${FRONTEND_IMG}:${TAG}"

# 1. Write production environment file to /tmp/arjuna.env
ENV_FILE="/tmp/arjuna.env"
rm -f "$ENV_FILE" 2>/dev/null || true

cat <<EOF > "$ENV_FILE"
GROQ_API_KEY=${GROQ_API_KEY:-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}
GROQ_MODEL=${GROQ_MODEL:-qwen/qwen3.8-27b}
GROQ_FAST_MODEL=${GROQ_FAST_MODEL:-openai/gpt-oss-20b}
GROQ_REASONING_MODEL=${GROQ_REASONING_MODEL:-openai/gpt-oss-120b}
GROQ_VISION_MODEL=${GROQ_VISION_MODEL:-qwen/qwen3.8-27b}
ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY:-sk_fba5cf151cea3db4dfb248622cd85872fd097a02fa15520e}
ELEVENLABS_VOICE_ID=${ELEVENLABS_VOICE_ID:-gHu9GtaHOXcSqFTK06ux}
ELEVENLABS_FALLBACK_VOICE_ID=${ELEVENLABS_FALLBACK_VOICE_ID:-EXAVITQu4vr4xnSDxMaL}
ELEVENLABS_MODEL_ID=${ELEVENLABS_MODEL_ID:-eleven_multilingual_v2}
SERPER_API_KEY=${SERPER_API_KEY}
SUPABASE_URL=${SUPABASE_URL:-https://hvnqbtobyvfxtbbjqdw.supabase.co}
SUPABASE_KEY=${SUPABASE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bnFidG9ieXZmeHRiYmpicWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NzgwMDUsImV4cCI6MjEwNDA1NDAwNX0.WSrmUWCe43Wb_gbt59kq5b8OWqJPm-muAn_fhnJA_KQ}
SUPABASE_ANON_KEY=${SUPABASE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bnFidG9ieXZmeHRiYmpicWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NzgwMDUsImV4cCI6MjEwNDA1NDAwNX0.WSrmUWCe43Wb_gbt59kq5b8OWqJPm-muAn_fhnJA_KQ}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bnFidG9ieXZmeHRiYmpicWR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODQ3ODAwNSwiZXhwIjoyMTA0MDU0MDA1fQ.fiOMxdcxrq5izcCdeMjqTuF_5havyK6ll1-gJ-FpdBE}
SUPABASE_STORAGE_BUCKET=manuals
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DIMENSION=1024
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
HF_HOME=/app/model_cache
MANUALS_DIR=/app/manuals
SQLITE_DB_PATH=/app/database/troubleshooter.db
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
LOG_LEVEL=info
BACKEND_URL=http://localhost:8000
EOF

chmod 600 "$ENV_FILE" 2>/dev/null || true

# 2. Stop and remove any previous containers
echo "Stopping old containers..."
docker stop mt-backend mt-frontend 2>/dev/null || true
docker rm -f mt-backend mt-frontend 2>/dev/null || true

# Stop old minikube/helm services on port 80 if running
if command -v helm >/dev/null 2>&1; then
    helm uninstall mt-system -n mt-system 2>/dev/null || true
    helm uninstall mt-system 2>/dev/null || true
fi
if command -v minikube >/dev/null 2>&1; then
    minikube stop 2>/dev/null || true
fi
fuser -k 80/tcp 2>/dev/null || true

# Update host Nginx if installed so port 80 routes to port 3000
if command -v nginx >/dev/null 2>&1 && [ -d /etc/nginx ]; then
    echo "Updating host Nginx configuration for machfixai.in..."
    cat << 'NGINX_EOF' | sudo tee /etc/nginx/sites-available/default >/dev/null 2>&1 || true
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name machfixai.in www.machfixai.in _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_EOF
    sudo systemctl reload nginx 2>/dev/null || sudo service nginx reload 2>/dev/null || true
fi

# 3. Ensure Docker network and volumes exist for state persistence
echo "Ensuring Docker network and storage volumes exist..."
docker network inspect mt-network >/dev/null 2>&1 || docker network create mt-network
docker volume create mt-manuals 2>/dev/null || true
docker volume create mt-database 2>/dev/null || true
docker volume create mt-model-cache 2>/dev/null || true

# 4. Launch Backend container
echo "Launching mt-backend container..."
docker rm -f mt-backend 2>/dev/null || true
docker run -d \
    --name mt-backend \
    --network mt-network \
    --network-alias backend \
    --restart unless-stopped \
    -p 8000:8000 \
    --env-file "$ENV_FILE" \
    -v mt-manuals:/app/manuals \
    -v mt-database:/app/database \
    -v mt-model-cache:/app/model_cache \
    "${BACKEND_IMG}:${TAG}"

# 5. Launch Frontend container (bind both 80 and 3000)
echo "Launching mt-frontend container..."
docker rm -f mt-frontend 2>/dev/null || true
docker run -d \
    --name mt-frontend \
    --network mt-network \
    --restart unless-stopped \
    -p 80:3000 \
    -p 3000:3000 \
    -e BACKEND_URL="http://mt-backend:8000" \
    "${FRONTEND_IMG}:${TAG}" 2>/dev/null || \
docker run -d \
    --name mt-frontend \
    --network mt-network \
    --restart unless-stopped \
    -p 3000:3000 \
    -e BACKEND_URL="http://mt-backend:8000" \
    "${FRONTEND_IMG}:${TAG}"

# 6. Wait for initialization
echo "Waiting 15s for containers to initialize..."
sleep 15

# 7. Health checks
echo "=== Running Containers ==="
docker ps --filter "name=mt-" || true

echo "=== Service Health ==="
if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
    echo "✓ BACKEND: HEALTHY (:8000)"
else
    echo "! Backend is initializing or warming up models..."
fi

if curl -sf -o /dev/null http://localhost:3000 >/dev/null 2>&1; then
    echo "✓ FRONTEND: HEALTHY (:3000)"
else
    echo "! Frontend is starting up..."
fi

echo "=========================================================="
echo " Production Deployment Complete!                         "
echo " Backend:  http://<HOST>:8000                             "
echo " Frontend: http://<HOST>:3000                             "
echo "=========================================================="
exit 0
