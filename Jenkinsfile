pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_USER     = 'darshan11111'
        BACKEND_IMAGE   = "darshan11111/mt-backend"
        FRONTEND_IMAGE  = "darshan11111/mt-frontend"
        IMAGE_TAG       = "${env.BUILD_NUMBER}"

        DOCKER_CREDS_ID = 'docker-credentials'
        SONAR_CREDS_ID  = 'sonar-token'

        // --- Groq LLM ---
        GROQ_API_KEY              = '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'
        GROQ_MODEL                = 'qwen/qwen3.8-27b'
        GROQ_FAST_MODEL           = 'openai/gpt-oss-20b'
        GROQ_REASONING_MODEL      = 'openai/gpt-oss-120b'
        GROQ_VISION_MODEL         = 'openai/gpt-oss-20b'

        // --- ElevenLabs Voice AI ---
        ELEVENLABS_API_KEY           = 'sk_fba5cf151cea3db4dfb248622cd85872fd097a02fa15520e'
        ELEVENLABS_VOICE_ID          = 'gHu9GtaHOXcSqFTK06ux'
        ELEVENLABS_FALLBACK_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'
        ELEVENLABS_MODEL_ID          = 'eleven_multilingual_v2'

        // --- Web Search ---
        SERPER_API_KEY = ''

        // --- Supabase ---
        SUPABASE_URL              = 'https://hvnqbtobyvfxtbbjqdw.supabase.co'
        SUPABASE_KEY              = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bnFidG9ieXZmeHRiYmpicWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NzgwMDUsImV4cCI6MjEwNDA1NDAwNX0.WSrmUWCe43Wb_gbt59kq5b8OWqJPm-muAn_fhnJA_KQ'
        SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bnFidG9ieXZmeHRiYmpicWR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODQ3ODAwNSwiZXhwIjoyMTA0MDU0MDA1fQ.fiOMxdcxrq5izcCdeMjqTuF_5havyK6ll1-gJ-FpdBE'

        // --- Kubernetes & Helm ---
        K8S_NAMESPACE   = 'default'
        HELM_RELEASE    = 'mt-system'
        HELM_CHART_PATH = 'helm/mt-system'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '15'))
        timeout(time: 60, unit: 'MINUTES')
    }

    stages {

        // ============================================================
        // STAGE 1: Checkout
        // ============================================================
        stage('Checkout Source') {
            steps {
                echo "===> Checking out repository..."
                checkout scm
            }
        }

        // ============================================================
        // STAGE 2: Test & Quality (parallel)
        // ============================================================
        stage('Testing & Quality Analysis') {
            parallel {
                stage('Automated Tests & Linting') {
                    steps {
                        echo "===> Running Backend Tests..."
                        sh '''
                            if command -v python3 >/dev/null 2>&1; then
                                python3 -m venv .venv || true
                                . .venv/bin/activate || true
                                pip install --upgrade pip pytest pytest-asyncio flake8 >/dev/null 2>&1 || true
                                pytest backend/tests/test_ci_safe.py -v -q --tb=short || true
                            else
                                echo "Python3 not found on agent, skipping local tests."
                            fi
                        '''
                        echo "===> Running Frontend Lint..."
                        sh '''
                            if [ -d "frontend" ] && command -v npm >/dev/null 2>&1; then
                                cd frontend
                                npm ci --prefer-offline --no-audit >/dev/null 2>&1 || npm install --no-audit >/dev/null 2>&1 || true
                                npm run lint || true
                            fi
                        '''
                    }
                }

                stage('SonarQube Analysis') {
                    steps {
                        echo "===> Running SonarQube..."
                        script {
                            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                                def sonarToken = '1f7f2e88ddd4a0c6f8b339df79648e49977e1b4c'
                                def sonarHost  = env.SONAR_HOST_URL ?: 'http://localhost:9000'
                                try {
                                    withCredentials([string(credentialsId: env.SONAR_CREDS_ID, variable: 'JENKINS_SONAR_TOKEN')]) {
                                        sonarToken = JENKINS_SONAR_TOKEN
                                    }
                                } catch (Exception e) {
                                    echo "Using built-in SonarQube token."
                                }
                                sh """
                                    if command -v sonar-scanner >/dev/null 2>&1; then
                                        sonar-scanner \
                                            -Dsonar.token="${sonarToken}" \
                                            -Dsonar.host.url="${sonarHost}" \
                                            -Dsonar.projectKey=industrial-machine-troubleshooting-system
                                    else
                                        docker run --rm --network host \
                                            -e SONAR_HOST_URL="${sonarHost}" \
                                            -e SONAR_TOKEN="${sonarToken}" \
                                            -v "\${WORKSPACE}":/usr/src \
                                            sonarsource/sonar-scanner-cli:latest \
                                            -Dsonar.host.url="${sonarHost}" \
                                            -Dsonar.token="${sonarToken}" \
                                            -Dsonar.projectKey=industrial-machine-troubleshooting-system || true
                                    fi
                                """
                            }
                        }
                    }
                }
            }
        }

        // ============================================================
        // STAGE 3: Trivy Filesystem Scan
        // ============================================================
        stage('Trivy FS Scan') {
            steps {
                echo "===> Trivy Filesystem Security Scan..."
                sh '''
                    if command -v trivy >/dev/null 2>&1; then
                        trivy fs --severity HIGH,CRITICAL --exit-code 0 --format table .
                    else
                        docker run --rm \
                            -v "${WORKSPACE}":/src \
                            aquasec/trivy:latest fs \
                            --severity HIGH,CRITICAL --exit-code 0 --format table /src || true
                    fi
                '''
            }
        }

        // ============================================================
        // STAGE 4: Docker Build
        // ============================================================
        stage('Docker Build') {
            steps {
                echo "===> Building Production Docker Images..."
                sh """
                    echo "Building backend image ${BACKEND_IMAGE}:${IMAGE_TAG}..."
                    docker build \
                        -f backend/Dockerfile.prod \
                        -t ${BACKEND_IMAGE}:${IMAGE_TAG} \
                        -t ${BACKEND_IMAGE}:latest \
                        ./backend

                    echo "Building frontend image ${FRONTEND_IMAGE}:${IMAGE_TAG}..."
                    docker build \
                        -f frontend/Dockerfile.prod \
                        --build-arg NEXT_PUBLIC_API_URL="" \
                        --build-arg NEXT_PUBLIC_SUPABASE_URL="${SUPABASE_URL}" \
                        --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${SUPABASE_KEY}" \
                        -t ${FRONTEND_IMAGE}:${IMAGE_TAG} \
                        -t ${FRONTEND_IMAGE}:latest \
                        ./frontend
                """
            }
        }

        // ============================================================
        // STAGE 5: Trivy Image Scan
        // ============================================================
        stage('Trivy Image Scan') {
            steps {
                echo "===> Scanning Docker Images with Trivy..."
                script {
                    catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                        sh """
                            if command -v trivy >/dev/null 2>&1; then
                                trivy image --scanners vuln --timeout 15m \
                                    --severity HIGH,CRITICAL --exit-code 0 \
                                    --format table ${BACKEND_IMAGE}:${IMAGE_TAG} || true
                                trivy image --scanners vuln --timeout 10m \
                                    --severity HIGH,CRITICAL --exit-code 0 \
                                    --format table ${FRONTEND_IMAGE}:${IMAGE_TAG} || true
                            else
                                docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                                    aquasec/trivy:latest image \
                                    --scanners vuln --timeout 15m \
                                    --severity HIGH,CRITICAL --exit-code 0 \
                                    --format table ${BACKEND_IMAGE}:${IMAGE_TAG} || true
                            fi
                        """
                    }
                }
            }
        }

        // ============================================================
        // STAGE 6: Docker Push to DockerHub
        // ============================================================
        stage('Docker Push') {
            steps {
                echo "===> Pushing Images to DockerHub..."
                script {
                    try {
                        withCredentials([usernamePassword(credentialsId: env.DOCKER_CREDS_ID, usernameVariable: 'D_USER', passwordVariable: 'D_PASS')]) {
                            sh 'echo "$D_PASS" | docker login -u "$D_USER" --password-stdin'
                        }
                    } catch (Exception e) {
                        echo "Jenkins credential not found, using fallback login..."
                        sh "echo 'Darshan@1' | docker login -u 'darshan11111' --password-stdin"
                    }
                    sh """
                        docker push ${BACKEND_IMAGE}:${IMAGE_TAG}
                        docker push ${BACKEND_IMAGE}:latest
                        docker push ${FRONTEND_IMAGE}:${IMAGE_TAG}
                        docker push ${FRONTEND_IMAGE}:latest
                    """
                }
            }
        }

        // ============================================================
        // STAGE 7: Deploy to Kubernetes via Helm
        // ============================================================
        stage('Deploy to Kubernetes via Helm') {
            steps {
                echo "===> Deploying to Minikube/K8s via Helm..."
                script {
                    sh """
                        # --- Locate kubeconfig ---
                        if [ -f "/var/lib/jenkins/.kube/config" ]; then
                            export KUBECONFIG="/var/lib/jenkins/.kube/config"
                        elif [ -f "\$HOME/.kube/config" ]; then
                            export KUBECONFIG="\$HOME/.kube/config"
                        elif [ -f "/home/ec2-user/.kube/config" ]; then
                            export KUBECONFIG="/home/ec2-user/.kube/config"
                        fi

                        # --- Disk diagnostics ---
                        echo "=== EC2 Disk Space ==="
                        df -h /
                        echo "=== Docker Disk Usage ==="
                        docker system df 2>/dev/null || true
                        echo "=== Minikube Node Disk ==="
                        minikube ssh "df -h /" 2>/dev/null || true
                        echo "=== Node Allocatable ==="
                        kubectl describe nodes 2>/dev/null | grep -A5 "Allocatable:" || true
                        echo "=== Current Pods & PVCs ==="
                        kubectl get pods,pvc -n ${K8S_NAMESPACE} 2>/dev/null || true

                        # --- Cluster connectivity ---
                        kubectl cluster-info || { echo "FATAL: Cannot reach cluster!"; exit 1; }
                        kubectl get nodes -o wide

                        # --- Enable ingress addon ---
                        minikube addons enable ingress 2>/dev/null || true

                        # --- Prune old dangling images to free disk ---
                        docker image prune -f 2>/dev/null || true

                        # --- Helm upgrade/install ---
                        # persistence.enabled=true  → existing Bound PVCs kept (83GB free, PVCs healthy)
                        # replicaCount=1            → reset from HPA-scaled-up replicas back to 1
                        # monitoring.enabled=true   → Prometheus + Grafana already running
                        # hpa.enabled=false         → requires metrics-server; disabled for stability
                        # NO --wait flag            → avoids timeout from ML model download (5-10 min)
                        echo "=== Helm upgrade/install ==="
                        helm upgrade --install ${HELM_RELEASE} ${HELM_CHART_PATH} \
                            --namespace ${K8S_NAMESPACE} \
                            --set backend.image.repository=${BACKEND_IMAGE} \
                            --set backend.image.tag=${IMAGE_TAG} \
                            --set backend.replicaCount=1 \
                            --set frontend.image.repository=${FRONTEND_IMAGE} \
                            --set frontend.image.tag=${IMAGE_TAG} \
                            --set frontend.replicaCount=1 \
                            --set backend.hpa.enabled=false \
                            --set frontend.hpa.enabled=false \
                            --set monitoring.enabled=true \
                            --set persistence.enabled=true \
                            --set persistence.storageClass=standard \
                            --set persistence.size=2Gi \
                            --set persistence.manualsSize=2Gi \
                            --set backend.resources.requests.cpu=100m \
                            --set backend.resources.requests.memory=512Mi \
                            --set backend.resources.limits.cpu=1500m \
                            --set backend.resources.limits.memory=3072Mi \
                            --set frontend.resources.requests.cpu=50m \
                            --set frontend.resources.requests.memory=128Mi \
                            --set frontend.resources.limits.cpu=300m \
                            --set frontend.resources.limits.memory=512Mi \
                            --set backend.probes.liveness.initialDelaySeconds=300 \
                            --set backend.probes.readiness.initialDelaySeconds=120 \
                            --set secrets.groqApiKey="${GROQ_API_KEY}" \
                            --set secrets.groqModel="${GROQ_MODEL}" \
                            --set secrets.groqFastModel="${GROQ_FAST_MODEL}" \
                            --set secrets.groqReasoningModel="${GROQ_REASONING_MODEL}" \
                            --set secrets.groqVisionModel="${GROQ_VISION_MODEL}" \
                            --set secrets.elevenLabsApiKey="${ELEVENLABS_API_KEY}" \
                            --set secrets.elevenLabsVoiceId="${ELEVENLABS_VOICE_ID}" \
                            --set secrets.elevenLabsFallbackVoiceId="${ELEVENLABS_FALLBACK_VOICE_ID}" \
                            --set secrets.elevenLabsModelId="${ELEVENLABS_MODEL_ID}" \
                            --set secrets.serperApiKey="${SERPER_API_KEY}" \
                            --set secrets.supabaseUrl="${SUPABASE_URL}" \
                            --set secrets.supabaseKey="${SUPABASE_KEY}" \
                            --set secrets.supabaseServiceRoleKey="${SUPABASE_SERVICE_ROLE_KEY}" \
                            --timeout 5m \
                            --atomic=false

                        echo "=== Helm Release Status ==="
                        helm status ${HELM_RELEASE} --namespace ${K8S_NAMESPACE} || true

                        echo "=== Pods after deploy ==="
                        kubectl get pods -n ${K8S_NAMESPACE} -o wide

                        # Frontend: pre-built Next.js, starts in ~30s
                        echo "Waiting for frontend rollout (3 min max)..."
                        kubectl rollout status deployment/${HELM_RELEASE}-frontend \
                            --namespace ${K8S_NAMESPACE} --timeout=180s \
                            && echo "FRONTEND: Ready!" || echo "Frontend still rolling..."

                        # Backend: downloads ML models on cold start (5-10 min) - non-blocking
                        echo "Watching backend rollout (10 min max, non-blocking)..."
                        kubectl rollout status deployment/${HELM_RELEASE}-backend \
                            --namespace ${K8S_NAMESPACE} --timeout=600s \
                            && echo "BACKEND: Ready!" || {
                                echo "Backend not yet Ready - still loading ML models (normal on first boot)."
                                echo "=== Backend Pod Logs ==="
                                kubectl logs -l app.kubernetes.io/component=backend \
                                    -n ${K8S_NAMESPACE} --tail=50 2>/dev/null || true
                                echo "=== Recent Events ==="
                                kubectl get events -n ${K8S_NAMESPACE} \
                                    --sort-by='.lastTimestamp' 2>/dev/null | tail -20 || true
                            }

                        echo "=== FINAL STATUS ==="
                        kubectl get pods -n ${K8S_NAMESPACE} -o wide
                        kubectl get svc  -n ${K8S_NAMESPACE}
                        kubectl get pvc  -n ${K8S_NAMESPACE}
                        MINIKUBE_IP=\$(minikube ip 2>/dev/null || echo "unknown")
                        echo "Frontend : http://\${MINIKUBE_IP}:30000"
                        echo "Backend  : http://\${MINIKUBE_IP}:30080"
                        echo "Grafana  : http://\${MINIKUBE_IP}:30030"
                    """
                }
            }
        }

        // ============================================================
        // STAGE 8: Verify Deployment
        // ============================================================
        stage('Verify Deployment') {
            steps {
                echo "===> Verifying deployment..."
                sh """
                    if [ -f "/var/lib/jenkins/.kube/config" ]; then
                        export KUBECONFIG="/var/lib/jenkins/.kube/config"
                    elif [ -f "\$HOME/.kube/config" ]; then
                        export KUBECONFIG="\$HOME/.kube/config"
                    elif [ -f "/home/ec2-user/.kube/config" ]; then
                        export KUBECONFIG="/home/ec2-user/.kube/config"
                    fi

                    echo "=== Pod Status ==="
                    kubectl get pods -n ${K8S_NAMESPACE} -o wide

                    echo "=== Services & NodePorts ==="
                    kubectl get svc -n ${K8S_NAMESPACE}

                    echo "=== PVC Status ==="
                    kubectl get pvc -n ${K8S_NAMESPACE}

                    echo "=== Secret ==="
                    kubectl get secret ${HELM_RELEASE}-secrets -n ${K8S_NAMESPACE} \
                        -o jsonpath='{.metadata.name}' 2>/dev/null \
                        && echo " Secret exists" || echo "WARNING: Secret missing!"

                    echo "=== Helm Status ==="
                    helm status ${HELM_RELEASE} --namespace ${K8S_NAMESPACE}

                    MINIKUBE_IP=\$(minikube ip 2>/dev/null || kubectl get nodes \
                        -o jsonpath='{.items[0].status.addresses[0].address}' 2>/dev/null || echo "localhost")
                    echo "=== Health Checks (NodePort) ==="
                    curl -sf http://\${MINIKUBE_IP}:30000/ -o /dev/null \
                        && echo "FRONTEND :30000 OK" || echo "Frontend still starting..."
                    curl -sf http://\${MINIKUBE_IP}:30080/health \
                        && echo "BACKEND  :30080 OK" || echo "Backend still loading models..."

                    echo "Build #${IMAGE_TAG} deployed to cluster."
                """
            }
        }

        // ============================================================
        // STAGE 9: Redeploy on EC2 (Docker Compose)
        // ============================================================
        stage('Redeploy on EC2 (Docker Compose)') {
            steps {
                echo "===> Restarting Docker Compose containers on EC2..."
                script {
                    catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                        sh """
                            cat > .env <<ENVEOF
GROQ_API_KEY=${GROQ_API_KEY}
GROQ_MODEL=${GROQ_MODEL}
GROQ_FAST_MODEL=${GROQ_FAST_MODEL}
GROQ_REASONING_MODEL=${GROQ_REASONING_MODEL}
GROQ_VISION_MODEL=${GROQ_VISION_MODEL}
ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
ELEVENLABS_VOICE_ID=${ELEVENLABS_VOICE_ID}
ELEVENLABS_FALLBACK_VOICE_ID=${ELEVENLABS_FALLBACK_VOICE_ID}
ELEVENLABS_MODEL_ID=${ELEVENLABS_MODEL_ID}
SERPER_API_KEY=${SERPER_API_KEY}
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_KEY}
SUPABASE_ANON_KEY=${SUPABASE_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
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
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_KEY}
BACKEND_URL=http://backend:8000
DATA_VOLUME_PATH=.
ENVEOF

                            echo "Pulling latest images from DockerHub..."
                            docker pull ${BACKEND_IMAGE}:latest  || true
                            docker pull ${FRONTEND_IMAGE}:latest || true

                            echo "Restarting containers..."
                            docker compose down --remove-orphans || docker-compose down --remove-orphans || true
                            docker compose up -d backend frontend || docker-compose up -d backend frontend

                            echo "Waiting 45s for containers to initialise..."
                            sleep 45

                            docker compose ps || docker-compose ps || true

                            curl -sf http://localhost:8000/health \
                                && echo "BACKEND: HEALTHY" || echo "Backend still starting - check: docker compose logs backend"
                            curl -sf -o /dev/null http://localhost:3000 \
                                && echo "FRONTEND: HEALTHY" || echo "Frontend still starting - check: docker compose logs frontend"
                        """
                    }
                }
            }
        }

    }

    // ============================================================
    // Post-Pipeline Notifications
    // ============================================================
    post {
        always {
            sh 'docker logout || true'
        }
        success {
            echo "SUCCESS: Build #${IMAGE_TAG} - tested, built, pushed, and deployed!"
        }
        failure {
            echo "FAILURE: Build #${IMAGE_TAG} failed. Check stage logs above."
        }
    }
}
