# Local Minikube CI/CD & Kubernetes Deployment Guide

This guide provides complete instructions for running the **Industrial RAG Machine Troubleshooter** CI/CD pipeline and Kubernetes deployment on a local **Minikube** cluster using **Jenkins**, **Helm**, **Trivy**, **SonarQube**, and **Prometheus/Grafana**.

---

## 1. System Architecture

```
Developer
   ↓
GitHub / Git Push
   ↓
Jenkins Pipeline
   ↓
[Stage 1] Checkout
   ↓
[Stage 2] Tests (pytest + npm lint) + SonarQube Quality Gate
   ↓
[Stage 3] Trivy Filesystem Scan (HIGH, CRITICAL)
   ↓
[Stage 4] Docker Build inside Minikube Environment
   ↓
[Stage 5] Trivy Image Scan (HIGH, CRITICAL)
   ↓
[Stage 6] Helm Deploy (image.pullPolicy: Never)
   ↓
[Stage 7] Verify Deployment & Probes (/health)

Kubernetes Cluster (Minikube):
   Minikube Ingress (industrial-rag.local)
       ↓
   ClusterIP Service (industrial-rag:8000)
       ↓
   Deployment (industrial-rag)
       ↓
   ReplicaSet
       ↓
   Pods [FastAPI Backend] ← Scraped by Prometheus
       ↑
   HPA (Autoscaling: 2 to 5 replicas, CPU > 70%)

Monitoring Stack:
   Pods / Nodes
       ↓
   Prometheus (cAdvisor / kubelet / metrics-server)
       ↓
   Grafana (Dashboards)
```

---

## 2. Minikube Setup

### 2.1 Start Minikube
Allocate at least 4 CPUs and 8 GB RAM to accommodate the application and monitoring stack:

```bash
minikube start --cpus=4 --memory=8192 --profile=minikube
```

### 2.2 Verify Cluster Status
```bash
minikube status
kubectl get nodes
```

Expected output:
```
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   1m    v1.30.0
```

### 2.3 Enable Required Minikube Addons
Enable the **Ingress** controller and **Metrics Server** (critical for HPA):

```bash
# Enable Ingress (NGINX Ingress Controller)
minikube addons enable ingress

# Enable Metrics Server for HPA
minikube addons enable metrics-server
```

Verify that the addons are active:
```bash
minikube addons list | grep -E "ingress|metrics-server"
kubectl top nodes
```

---

## 3. Docker & Minikube Local Image Workflow

To deploy locally without pushing to Docker Hub, we make images directly accessible to Minikube using either **Option A** or **Option B**:

### Option A: Build Directly in Minikube's Docker Daemon (Recommended)
Configure your shell to point to Minikube's Docker daemon:

```bash
# On Linux / macOS / Git Bash:
eval $(minikube -p minikube docker-env)

# On Windows PowerShell:
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# On Windows CMD:
@FOR /f "tokens=*" %i IN ('minikube -p minikube docker-env --shell cmd') DO @%i
```

Then build the image:
```bash
docker build -t industrial-rag:latest -f backend/Dockerfile backend
```

Any image built while `docker-env` is active is immediately available inside Minikube without network transfer.

### Option B: Load Host Docker Image into Minikube
If built on the host Docker daemon outside Minikube:
```bash
docker build -t industrial-rag:latest -f backend/Dockerfile backend
minikube -p minikube image load industrial-rag:latest
```

Verify the image is in Minikube:
```bash
minikube image ls | grep industrial-rag
```

---

## 4. Helm Deployment

The Helm chart is located in `./helm/app`.

### 4.1 Chart Structure
```
helm/app/
├── Chart.yaml                  # Chart metadata
├── values.yaml                 # Centralized configuration
└── templates/
    ├── deployment.yaml         # RollingUpdate deployment & probes
    ├── service.yaml            # ClusterIP service
    ├── hpa.yaml                # Horizontal Pod Autoscaler (2-5 replicas)
    ├── configmap.yaml          # Non-sensitive environment variables
    ├── secret.yaml             # Sensitive credentials (OpenAI/Supabase)
    └── ingress.yaml            # NGINX Ingress rules
```

### 4.2 Validate the Chart
```bash
helm lint ./helm/app
```

### 4.3 Deploy / Upgrade
```bash
helm upgrade --install industrial-rag ./helm/app \
  --namespace industrial-rag \
  --create-namespace \
  --set image.repository=industrial-rag \
  --set image.tag=latest \
  --set image.pullPolicy=Never
```

### 4.4 Verify Deployment Status
```bash
# Check Helm release
helm status industrial-rag -n industrial-rag

# Inspect workloads
kubectl get deployments -n industrial-rag
kubectl get replicasets -n industrial-rag
kubectl get pods -n industrial-rag
kubectl get svc -n industrial-rag
kubectl get hpa -n industrial-rag

# Monitor rollout
kubectl rollout status deployment/industrial-rag -n industrial-rag
```

### 4.5 Rollback
If any deployment needs to be reverted:
```bash
# View release history
helm history industrial-rag -n industrial-rag

# Roll back to previous revision (e.g. revision 1)
helm rollback industrial-rag 1 -n industrial-rag
```

---

## 5. Ingress & Accessing the Application

### 5.1 Obtain Minikube IP
```bash
minikube ip
```
*(Example: `192.168.49.2`)*

### 5.2 Configure Local DNS / Hosts File
Add the following line to your `hosts` file:
- **Linux / macOS**: `/etc/hosts`
- **Windows**: `C:\Windows\System32\drivers\etc\hosts`

```
<MINIKUBE_IP>   industrial-rag.local
```
*(e.g., `192.168.49.2   industrial-rag.local`)*

### 5.3 Test Access
```bash
# Health endpoint
curl http://industrial-rag.local/health

# Expected response:
# {"status":"healthy","service":"machine-troubleshooter-api","version":"0.1.0"}

# API documentation
curl http://industrial-rag.local/docs
```

Or run `minikube tunnel` in a separate terminal window on Windows/macOS if using the hypervisor/docker driver.

---

## 6. Monitoring: Prometheus & Grafana on Minikube

Install the standard `kube-prometheus-stack` via Helm to monitor Pod CPU, memory, HPA, and API availability.

### 6.1 Add Helm Repository
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

### 6.2 Install Monitoring Stack
```bash
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false
```

### 6.3 Access Dashboards

#### Grafana
Forward the Grafana port to localhost:
```bash
kubectl port-forward svc/monitoring-grafana 3001:80 -n monitoring
```
- **URL**: `http://localhost:3001`
- **User**: `admin`
- **Password**: Retrieve with:
  ```bash
  kubectl get secret --namespace monitoring monitoring-grafana -o jsonpath="{.data.admin-password}" | base64 --decode
  ```
- **Recommended Dashboards**:
  - *Kubernetes / Compute Resources / Pod* (pod CPU, memory, network)
  - *Kubernetes / Horizontal Pod Autoscaler* (HPA target vs current utilization, replica count)

#### Prometheus UI
```bash
kubectl port-forward svc/monitoring-kube-prometheus-prometheus 9090:9090 -n monitoring
```
- **URL**: `http://localhost:9090`
- **Useful Queries**:
  - Pod CPU utilization: `sum(rate(container_cpu_usage_seconds_total{namespace="industrial-rag",pod=~"industrial-rag.*"}[2m])) by (pod)`
  - Pod Memory: `sum(container_memory_working_set_bytes{namespace="industrial-rag",pod=~"industrial-rag.*"}) by (pod)`
  - Replicas: `kube_deployment_status_replicas_available{namespace="industrial-rag",deployment="industrial-rag"}`

---

## 7. Jenkins Local Pipeline Configuration

### 7.1 Pre-Flight Check
Ensure Jenkins runner has the following CLI tools installed and accessible on PATH:
```bash
docker --version
kubectl version --client
helm version
minikube version
minikube status
```

### 7.2 Running Jenkins inside Docker (Docker-in-Docker / Host Socket)
If Jenkins is running as a Docker container, pass the host Docker socket and Minikube credentials:
```bash
docker run -d \
  --name jenkins \
  --restart=always \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.kube:/var/jenkins_home/.kube \
  -v ~/.minikube:/var/jenkins_home/.minikube \
  jenkins/jenkins:lts
```

### 7.3 Pipeline Stages Overview
The provided `Jenkinsfile` orchestrates:
1. **Checkout**: Clones the GitHub repository.
2. **Test + SonarQube**: Executes backend unit tests (`pytest backend/tests/`), frontend linting (`npm run lint`), runs `sonar-scanner`, and checks Quality Gate.
3. **Trivy Scan**: Scans local filesystem dependencies for `HIGH,CRITICAL` CVEs.
4. **Docker Build**: Builds `industrial-rag:${BUILD_NUMBER}` using `backend/Dockerfile` and loads into Minikube.
5. **Image Scan**: Scans the newly created container image with Trivy.
6. **Helm Deploy**: Runs `helm lint` and performs `helm upgrade --install` with `--set image.pullPolicy=Never`.
7. **Verify**: Asserts rollout status via `kubectl rollout status` and prints running pods, services, and HPA.
- **Post Action**: Automatically runs `helm rollback` if any step fails.
