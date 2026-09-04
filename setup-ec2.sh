#!/usr/bin/env bash
# =============================================================================
# Machine Troubleshooting System — Complete EC2 Server Setup Script
# Ubuntu 22.04 / 24.04 LTS (t3.xlarge or minimum 4 vCPU, 16GB RAM recommended)
# =============================================================================
set -e

echo "=========================================================="
echo " Starting Full Setup: Jenkins, Docker, SonarQube, Trivy,   "
echo " Minikube, Helm, Kubectl on AWS EC2 Ubuntu               "
echo "=========================================================="

# 1. Update system packages
echo "--> Updating package repositories..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Install essential dependencies
echo "--> Installing curl, wget, apt-transport-https, git, python3-pip..."
sudo apt-get install -y curl wget git unzip apt-transport-https ca-certificates gnupg lsb-release python3-pip python3-venv

# 3. Install OpenJDK 17 (Required by Jenkins)
echo "--> Installing OpenJDK 17..."
sudo apt-get install -y openjdk-17-jdk
java -version

# 4. Install Docker CE
echo "--> Installing Docker CE..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker

# Add current user (ubuntu) to docker group
sudo usermod -aG docker "$USER"

# 5. Install Jenkins
echo "--> Installing Jenkins LTS..."
sudo wget -O /usr/share/keyrings/jenkins-keyring.asc https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y jenkins

# Enable docker execution by the jenkins user
sudo usermod -aG docker jenkins
sudo systemctl enable jenkins
sudo systemctl start jenkins

# 6. Install Trivy Vulnerability Scanner
echo "--> Installing Trivy Security Scanner..."
sudo wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update -y
sudo apt-get install -y trivy

# 7. Install Kubectl
echo "--> Installing Kubectl..."
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl

# 8. Install Helm 3
echo "--> Installing Helm 3..."
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh
rm get_helm.sh

# 9. Install Minikube
echo "--> Installing Minikube..."
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
rm minikube-linux-amd64

# 10. Start SonarQube Container (runs on port 9000)
echo "--> Starting SonarQube container on port 9000..."
sudo docker run -d --name sonarqube \
  -p 9000:9000 \
  --restart unless-stopped \
  sonarqube:lts-community || true

# 11. Allow jenkins user to access docker socket and minikube
sudo chmod 666 /var/run/docker.sock || true

echo "=========================================================="
echo " Installation Complete! "
echo "=========================================================="
echo "Jenkins URL: http://<YOUR_EC2_PUBLIC_IP>:8080"
echo "SonarQube URL: http://<YOUR_EC2_PUBLIC_IP>:9000"
echo ""
echo "Initial Jenkins Admin Password:"
sudo cat /var/lib/jenkins/secrets/initialAdminPassword || true
echo ""
echo "Next step: Run 'minikube start --driver=docker' to start your local Kubernetes cluster!"
echo "=========================================================="
