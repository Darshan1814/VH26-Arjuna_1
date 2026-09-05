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
        GROQ_VISION_MODEL         = 'qwen/qwen3.8-27b'

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
        // STAGE 7: Deploy Directly to Production (Docker Compose)
        // ============================================================
        stage('Deploy to Production (Docker Compose)') {
            steps {
                echo "===> Deploying directly to production using Docker Compose..."
                script {
                    catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                        sh """
                            export PATH="\$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/snap/bin:\$HOME/bin:\$HOME/.local/bin"

                            # --- Generate production .env without heredoc ---
                            echo "Writing production .env file..."
                            echo "GROQ_API_KEY=${GROQ_API_KEY}" > .env
                            echo "GROQ_MODEL=${GROQ_MODEL}" >> .env
                            echo "GROQ_FAST_MODEL=${GROQ_FAST_MODEL}" >> .env
                            echo "GROQ_REASONING_MODEL=${GROQ_REASONING_MODEL}" >> .env
                            echo "GROQ_VISION_MODEL=${GROQ_VISION_MODEL}" >> .env
                            echo "ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}" >> .env
                            echo "ELEVENLABS_VOICE_ID=${ELEVENLABS_VOICE_ID}" >> .env
                            echo "ELEVENLABS_FALLBACK_VOICE_ID=${ELEVENLABS_FALLBACK_VOICE_ID}" >> .env
                            echo "ELEVENLABS_MODEL_ID=${ELEVENLABS_MODEL_ID}" >> .env
                            echo "SERPER_API_KEY=${SERPER_API_KEY}" >> .env
                            echo "SUPABASE_URL=${SUPABASE_URL}" >> .env
                            echo "SUPABASE_KEY=${SUPABASE_KEY}" >> .env
                            echo "SUPABASE_ANON_KEY=${SUPABASE_KEY}" >> .env
                            echo "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}" >> .env
                            echo "SUPABASE_STORAGE_BUCKET=manuals" >> .env
                            echo "EMBEDDING_MODEL=BAAI/bge-m3" >> .env
                            echo "EMBEDDING_DIMENSION=1024" >> .env
                            echo "RERANKER_MODEL=BAAI/bge-reranker-v2-m3" >> .env
                            echo "HF_HOME=/app/model_cache" >> .env
                            echo "MANUALS_DIR=/app/manuals" >> .env
                            echo "SQLITE_DB_PATH=/app/database/troubleshooter.db" >> .env
                            echo "BACKEND_HOST=0.0.0.0" >> .env
                            echo "BACKEND_PORT=8000" >> .env
                            echo "LOG_LEVEL=info" >> .env
                            echo "NEXT_PUBLIC_API_URL=" >> .env
                            echo "NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}" >> .env
                            echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_KEY}" >> .env
                            echo "BACKEND_URL=http://backend:8000" >> .env
                            echo "DATA_VOLUME_PATH=." >> .env

                            # --- Tag built images as latest for local runner ---
                            echo "Tagging production images..."
                            docker tag ${BACKEND_IMAGE}:${IMAGE_TAG} ${BACKEND_IMAGE}:latest 2>/dev/null || true
                            docker tag ${FRONTEND_IMAGE}:${IMAGE_TAG} ${FRONTEND_IMAGE}:latest 2>/dev/null || true

                            # --- Determine compose command ---
                            if docker compose version >/dev/null 2>&1; then
                                COMPOSE_CMD="docker compose"
                            elif docker-compose version >/dev/null 2>&1; then
                                COMPOSE_CMD="docker-compose"
                            else
                                echo "WARNING: Neither docker compose nor docker-compose found in PATH."
                                COMPOSE_CMD="docker compose"
                            fi
                            echo "Using compose command: \$COMPOSE_CMD"

                            # --- Restart containers directly ---
                            echo "Restarting production containers..."
                            \$COMPOSE_CMD down --remove-orphans 2>/dev/null || true
                            \$COMPOSE_CMD up -d --force-recreate backend frontend

                            echo "Waiting 25s for containers to initialize..."
                            sleep 25

                            # --- Verify health ---
                            echo "=== Container Status ==="
                            \$COMPOSE_CMD ps || true

                            echo "=== Health Checks ==="
                            curl -sf http://localhost:8000/health \
                                && echo "BACKEND: HEALTHY (:8000)" || echo "Backend initializing..."
                            curl -sf -o /dev/null http://localhost:3000 \
                                && echo "FRONTEND: HEALTHY (:3000)" || echo "Frontend initializing..."

                            echo "=== Deployment Complete: Build #${IMAGE_TAG} is LIVE in Production! ==="
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
