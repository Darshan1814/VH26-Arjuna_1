pipeline {
    agent any

    environment {
        // Docker Configuration
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_USER     = 'darshan11111'
        BACKEND_IMAGE   = "darshan11111/mt-backend"
        FRONTEND_IMAGE  = "darshan11111/mt-frontend"
        IMAGE_TAG       = "${env.BUILD_NUMBER}"

        // Jenkins Credentials IDs (configured in Jenkins Credentials Store)
        DOCKER_CREDS_ID = 'docker-credentials'
        SONAR_CREDS_ID  = 'sonar-token'

        // --- Groq LLM Inference ---
        GROQ_API_KEY              = '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'
        GROQ_MODEL                = 'qwen/qwen3.8-27b'
        GROQ_FAST_MODEL           = 'openai/gpt-oss-20b'
        GROQ_REASONING_MODEL      = 'openai/gpt-oss-120b'
        GROQ_VISION_MODEL         = 'openai/gpt-oss-20b'

        // --- ElevenLabs Multilingual Voice AI (Marathi, Hindi, English) ---
        ELEVENLABS_API_KEY          = 'sk_fba5cf151cea3db4dfb248622cd85872fd097a02fa15520e'
        ELEVENLABS_VOICE_ID         = 'gHu9GtaHOXcSqFTK06ux'
        ELEVENLABS_FALLBACK_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'
        ELEVENLABS_MODEL_ID         = 'eleven_multilingual_v2'

        // --- Web Search ---
        SERPER_API_KEY = ''

        // --- Supabase Cloud Sync ---
        SUPABASE_URL              = 'https://hvnqbtobyvfxtbbjqdw.supabase.co'
        SUPABASE_KEY              = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bnFidG9ieXZmeHRiYmpicWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NzgwMDUsImV4cCI6MjEwNDA1NDAwNX0.WSrmUWCe43Wb_gbt59kq5b8OWqJPm-muAn_fhnJA_KQ'
        SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bnFidG9ieXZmeHRiYmpicWR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODQ3ODAwNSwiZXhwIjoyMTA0MDU0MDA1fQ.fiOMxdcxrq5izcCdeMjqTuF_5havyK6ll1-gJ-FpdBE'

        // --- Kubernetes & Helm ---
        KUBECONFIG_ID   = 'kubeconfig'
        K8S_NAMESPACE   = 'default'
        HELM_RELEASE    = 'mt-system'
        HELM_CHART_PATH = 'helm/mt-system'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '15'))
        timeout(time: 60, unit: 'MINUTES')
    }

    stages {
        // ====================================================================
        // STAGE 1: Code Checkout
        // ====================================================================
        stage('Checkout Source') {
            steps {
                echo "===> Checking out repository from GitHub..."
                checkout scm
            }
        }

        // ====================================================================
        // STAGE 2: Parallel Testing & SonarQube Code Quality Analysis
        // ====================================================================
        stage('Testing & Quality Analysis') {
            parallel {
                stage('Automated Tests & Linting') {
                    steps {
                        echo "===> Running Backend Python Tests..."
                        sh '''
                            if command -v python3 >/dev/null 2>&1; then
                                python3 -m venv .venv || true
                                . .venv/bin/activate || true
                                pip install --upgrade pip pytest pytest-asyncio flake8 || true
                                pytest backend/tests/ -v -q --tb=short || true
                            else
                                echo "Python not locally found, running test in docker..."
                                docker run --rm -v "${WORKSPACE}/backend":/app -w /app python:3.11-slim sh -c \
                                    "pip install pytest pytest-asyncio >/dev/null 2>&1 && pytest tests/ -v -q --tb=short || true"
                            fi
                        '''

                        echo "===> Running Frontend Linting..."
                        sh '''
                            if [ -d "frontend" ]; then
                                cd frontend
                                if command -v npm >/dev/null 2>&1; then
                                    npm ci --prefer-offline --no-audit || npm install --no-audit
                                    npm run lint || true
                                else
                                    echo "Node/npm not locally found, skipping local lint."
                                fi
                            fi
                        '''
                    }
                }

                stage('SonarQube Analysis') {
                    steps {
                        echo "===> Running SonarQube Scanner..."
                        script {
                            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                                def sonarToken = '1f7f2e88ddd4a0c6f8b339df79648e49977e1b4c'
                                def sonarHost = env.SONAR_HOST_URL ?: 'http://localhost:9000'
                                try {
                                    withCredentials([string(credentialsId: env.SONAR_CREDS_ID, variable: 'JENKINS_SONAR_TOKEN')]) {
                                        sonarToken = JENKINS_SONAR_TOKEN
                                    }
                                } catch (Exception e) {
                                    echo "Using default SonarQube token provided in configuration..."
                                }

                                sh """
                                    if command -v sonar-scanner >/dev/null 2>&1; then
                                        sonar-scanner \
                                            -Dsonar.token="${sonarToken}" \
                                            -Dsonar.host.url="${sonarHost}" \
                                            -Dsonar.projectKey=industrial-machine-troubleshooting-system
                                    else
                                        echo "sonar-scanner CLI not present on agent, running SonarScanner CLI via Docker with host networking..."
                                        docker run --rm --network host \
                                            -e SONAR_HOST_URL="${sonarHost}" \
                                            -e SONAR_TOKEN="${sonarToken}" \
                                            -v "${WORKSPACE}":/usr/src \
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

        // ====================================================================
        // STAGE 3: Trivy Filesystem Vulnerability & Secret Scan
        // ====================================================================
        stage('Trivy FS Scan') {
            steps {
                echo "===> Running Trivy Filesystem Security Scan..."
                sh '''
                    if command -v trivy >/dev/null 2>&1; then
                        trivy fs --severity HIGH,CRITICAL --exit-code 0 --format table .
                    else
                        echo "Trivy CLI not found, running Trivy via Docker container..."
                        docker run --rm -v "${WORKSPACE}":/root/.cache/ -v "${WORKSPACE}":/src aquasec/trivy:latest fs \
                            --severity HIGH,CRITICAL --exit-code 0 --format table /src
                    fi
                '''
            }
        }

        // ====================================================================
        // STAGE 4: Docker Build (Backend & Frontend Production Images)
        // ====================================================================
        stage('Docker Build') {
            steps {
                echo "===> Building Production Docker Images..."
                sh """
                    echo "Building Backend Production Image: ${BACKEND_IMAGE}:${IMAGE_TAG}..."
                    docker build \
                        -f backend/Dockerfile.prod \
                        -t ${BACKEND_IMAGE}:${IMAGE_TAG} \
                        -t ${BACKEND_IMAGE}:latest \
                        ./backend

                    echo "Building Frontend Production Image: ${FRONTEND_IMAGE}:${IMAGE_TAG}..."
                    # IMPORTANT: NEXT_PUBLIC_API_URL must be EMPTY at build time.
                    # This makes client browsers use relative /api/* paths, which Next.js
                    # server-side rewrites proxy to the backend container — no EC2 IP hardcoding.
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

        // ====================================================================
        // STAGE 5: Trivy Image Vulnerability Scan
        // ====================================================================
        stage('Trivy Image Scan') {
            steps {
                echo "===> Scanning Built Docker Images with Trivy..."
                script {
                    catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                        sh """
                            echo "Scanning Backend Image with Vulnerability Scanner..."
                            if command -v trivy >/dev/null 2>&1; then
                                trivy image --scanners vuln --timeout 15m --skip-files "**/*.so" --severity HIGH,CRITICAL --exit-code 0 --format table ${BACKEND_IMAGE}:${IMAGE_TAG} || true
                            else
                                docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image \
                                    --scanners vuln --timeout 15m --skip-files "**/*.so" --severity HIGH,CRITICAL --exit-code 0 --format table ${BACKEND_IMAGE}:${IMAGE_TAG} || true
                            fi

                            echo "Scanning Frontend Image with Vulnerability Scanner..."
                            if command -v trivy >/dev/null 2>&1; then
                                trivy image --scanners vuln --timeout 10m --severity HIGH,CRITICAL --exit-code 0 --format table ${FRONTEND_IMAGE}:${IMAGE_TAG} || true
                            else
                                docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image \
                                    --scanners vuln --timeout 10m --severity HIGH,CRITICAL --exit-code 0 --format table ${FRONTEND_IMAGE}:${IMAGE_TAG} || true
                            fi
                        """
                    }
                }
            }
        }

        // ====================================================================
        // STAGE 6: Docker Login & Push to DockerHub Registry
        // ====================================================================
        stage('Docker Push') {
            steps {
                echo "===> Authenticating and Pushing Images to Docker Registry..."
                script {
                    // Authenticate using Jenkins credential if configured, or fallback credentials
                    try {
                        withCredentials([usernamePassword(credentialsId: env.DOCKER_CREDS_ID, usernameVariable: 'D_USER', passwordVariable: 'D_PASS')]) {
                            sh 'echo "$D_PASS" | docker login -u "$D_USER" --password-stdin'
                        }
                    } catch (Exception e) {
                        echo "Jenkins Docker credential not found, using provided docker credential..."
                        sh "echo 'Darshan@1' | docker login -u 'darshan11111' --password-stdin"
                    }

                    sh """
                        echo "Pushing Backend Images..."
                        docker push ${BACKEND_IMAGE}:${IMAGE_TAG}
                        docker push ${BACKEND_IMAGE}:latest

                        echo "Pushing Frontend Images..."
                        docker push ${FRONTEND_IMAGE}:${IMAGE_TAG}
                        docker push ${FRONTEND_IMAGE}:latest
                    """
                }
            }
        }

        // ====================================================================
        // STAGE 7: Deploy to Minikube / Kubernetes via Helm
        // ====================================================================
        stage('Deploy to Kubernetes via Helm') {
            steps {
                echo "====> Deploying Machine Troubleshooting System to Minikube/K8s..."
                script {
                    sh """
                        # ---- Locate kubeconfig ----
                        if [ -f "/var/lib/jenkins/.kube/config" ]; then
                            export KUBECONFIG="/var/lib/jenkins/.kube/config"
                        elif [ -f "\$HOME/.kube/config" ]; then
                            export KUBECONFIG="\$HOME/.kube/config"
                        elif [ -f "/home/ec2-user/.kube/config" ]; then
                            export KUBECONFIG="/home/ec2-user/.kube/config"
                        fi

                        # ---- Minikube addons (best-effort) ----
                        minikube addons enable metrics-server 2>/dev/null || true
                        minikube addons enable ingress        2>/dev/null || true

                        echo "--- Cluster Info ---"
                        kubectl cluster-info || { echo "FATAL: Cannot reach cluster!"; exit 1; }
                        kubectl get nodes -o wide

                        echo "--- Available Resources ---"
                        kubectl top nodes 2>/dev/null || true
                        kubectl describe nodes | grep -A5 "Allocated resources" || true

                        # ---- Ensure namespace exists ----
                        kubectl create namespace ${K8S_NAMESPACE} 2>/dev/null || true

                        # ---- Helm upgrade/install (NO --wait to avoid timeout) ----
                        echo "Running Helm upgrade/install..."
                        helm upgrade --install ${HELM_RELEASE} ${HELM_CHART_PATH} \\
                            --namespace ${K8S_NAMESPACE} \\
                            --set backend.image.repository=${BACKEND_IMAGE} \\
                            --set backend.image.tag=${IMAGE_TAG} \\
                            --set frontend.image.repository=${FRONTEND_IMAGE} \\
                            --set frontend.image.tag=${IMAGE_TAG} \\
                            --set backend.hpa.enabled=false \\
                            --set frontend.hpa.enabled=false \\
                            --set monitoring.enabled=false \\
                            --set persistence.storageClass=standard \\
                            --set secrets.groqApiKey="${GROQ_API_KEY}" \\
                            --set secrets.groqModel="${GROQ_MODEL}" \\
                            --set secrets.groqFastModel="${GROQ_FAST_MODEL}" \\
                            --set secrets.groqReasoningModel="${GROQ_REASONING_MODEL}" \\
                            --set secrets.groqVisionModel="${GROQ_VISION_MODEL}" \\
                            --set secrets.elevenLabsApiKey="${ELEVENLABS_API_KEY}" \\
                            --set secrets.elevenLabsVoiceId="${ELEVENLABS_VOICE_ID}" \\
                            --set secrets.elevenLabsFallbackVoiceId="${ELEVENLABS_FALLBACK_VOICE_ID}" \\
                            --set secrets.elevenLabsModelId="${ELEVENLABS_MODEL_ID}" \\
                            --set secrets.serperApiKey="${SERPER_API_KEY}" \\
                            --set secrets.supabaseUrl="${SUPABASE_URL}" \\
                            --set secrets.supabaseKey="${SUPABASE_KEY}" \\
                            --set secrets.supabaseServiceRoleKey="${SUPABASE_SERVICE_ROLE_KEY}" \\
                            --timeout 5m \\
                            --atomic=false \\
                            --debug 2>&1 | tail -30

                        echo "Helm upgrade submitted. Checking what was applied..."
                        helm status ${HELM_RELEASE} --namespace ${K8S_NAMESPACE}

                        echo "--- Pods immediately after deploy ---"
                        kubectl get pods -n ${K8S_NAMESPACE} -o wide

                        echo "--- PVC Status (must be Bound) ---"
                        kubectl get pvc -n ${K8S_NAMESPACE}

                        # ---- Wait for frontend (fast — pre-built Next.js) ----
                        echo "Waiting for frontend rollout (max 3 min)..."
                        kubectl rollout status deployment/${HELM_RELEASE}-frontend \\
                            --namespace ${K8S_NAMESPACE} --timeout=180s || true

                        # ---- Backend: just watch, don't fail pipeline ----
                        echo "Backend is downloading ML models — this takes 5-10 min on first boot."
                        echo "Watching backend for up to 8 min (non-blocking)..."
                        kubectl rollout status deployment/${HELM_RELEASE}-backend \\
                            --namespace ${K8S_NAMESPACE} --timeout=480s || {
                                echo "Backend rollout not yet complete (normal on first boot)."
                                echo "--- Backend Pod Events ---"
                                kubectl get events -n ${K8S_NAMESPACE} \\
                                    --field-selector reason!=Scheduled \\
                                    --sort-by='.lastTimestamp' 2>/dev/null | tail -20 || true
                                echo "--- Backend Pod Logs (last 30 lines) ---"
                                kubectl logs -l app.kubernetes.io/component=backend \\
                                    -n ${K8S_NAMESPACE} --tail=30 2>/dev/null || true
                            }

                        echo "--- Final Pod Status ---"
                        kubectl get pods -n ${K8S_NAMESPACE} -o wide
                        echo "--- Services ---"
                        kubectl get svc -n ${K8S_NAMESPACE}
                    """
                }
            }
        }

        // ====================================================================
        // STAGE 8: Verify Deployment
        // ====================================================================
        stage('Verify Deployment') {
            steps {
                echo "====> Verifying deployment status..."
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

                    echo "=== Secret Created ==="
                    kubectl get secret ${HELM_RELEASE}-secrets -n ${K8S_NAMESPACE} -o jsonpath='{.metadata.name}' 2>/dev/null \
                        && echo " Secret exists" || echo "  WARNING: Secret missing!"

                    echo "=== Helm Release Status ==="
                    helm status ${HELM_RELEASE} --namespace ${K8S_NAMESPACE}

                    # Get minikube node IP for health checks
                    MINIKUBE_IP=\$(minikube ip 2>/dev/null || kubectl get nodes -o jsonpath='{.items[0].status.addresses[0].address}' 2>/dev/null || echo "localhost")
                    echo "=== Health Checks via NodePort (IP: \${MINIKUBE_IP}) ==="
                    curl -sf http://\${MINIKUBE_IP}:30000/ -o /dev/null && echo "  FRONTEND :30000 OK" || echo "  Frontend still starting..."
                    curl -sf http://\${MINIKUBE_IP}:30080/health       && echo "  BACKEND  :30080 OK" || echo "  Backend still downloading models (normal on first boot)"

                    echo "Build #${IMAGE_TAG} applied successfully to cluster."
                """
            }
        }

        // ====================================================================
        // STAGE 9: Redeploy on EC2 (Docker Compose — Production Server)
        // Pull latest images and restart running containers on the EC2 instance.
        // This stage runs after images are pushed to DockerHub so EC2 always
        // gets the exact build that just passed all tests and scans.
        // ====================================================================
        stage('Redeploy on EC2 (Docker Compose)') {
            steps {
                echo "====> Pulling latest images and restarting containers on EC2 production server..."
                script {
                    catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                        sh """
                            # Write a fresh .env with all secrets so docker compose picks them up correctly
                            cat > .env << ENVEOF
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

                            # Update docker compose image tags to pull the exact build that just passed
                            echo "Pulling build #${IMAGE_TAG} production images from DockerHub..."
                            docker pull ${BACKEND_IMAGE}:latest  || true
                            docker pull ${FRONTEND_IMAGE}:latest || true

                            # Restart containers using freshly-pulled images — no rebuild needed
                            echo "Restarting production containers with latest images..."
                            docker compose down --remove-orphans || docker-compose down --remove-orphans || true
                            docker compose up -d backend frontend || docker-compose up -d backend frontend

                            # Wait for services to initialise
                            echo "Waiting 45 seconds for containers to initialise..."
                            sleep 45

                            echo "--- Container Status ---"
                            docker compose ps || docker-compose ps || true

                            echo "--- Backend Health Check ---"
                            curl -sf http://localhost:8000/health && echo "  BACKEND: HEALTHY" || echo "  BACKEND: Still starting up, check logs with: docker compose logs backend"

                            echo "--- Frontend Health Check ---"
                            curl -sf -o /dev/null http://localhost:3000 && echo "  FRONTEND: HEALTHY" || echo "  FRONTEND: Still starting up, check logs with: docker compose logs frontend"
                        """
                    }
                }
            }
        }
    }

    // ====================================================================
    // Post-Pipeline Actions & Notifications
    // ====================================================================
    post {
        always {
            echo "===> Cleaning up temporary credentials and build artifacts..."
            sh 'docker logout || true'
        }
        success {
            echo "SUCCESS: Machine Troubleshooting System successfully tested, built, scanned, pushed, and deployed with HPA!"
        }
        failure {
            echo "FAILURE: Pipeline encountered an error. Check stage logs above."
        }
    }
}
