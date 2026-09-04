# AWS Deployment Guide: CodePipeline, CodeBuild & CodeDeploy

This guide explains how to deploy **Machine Troubleshooter** to an AWS EC2 instance using **AWS CodePipeline**, **AWS CodeBuild**, and **AWS CodeDeploy**.

---

## 1. Architecture Overview

```
[ GitHub Repo (main branch) ]
             ↓  (CodePipeline Source Trigger)
[ AWS CodeBuild ]
  - Validates Python syntax & dependencies
  - Builds Next.js frontend standalone package
  - Packages artifacts (appspec.yml, scripts/, docker-compose.prod.yml)
             ↓  (Outputs S3 artifact zip)
[ AWS CodeDeploy ]
             ↓  (Deploys via CodeDeploy Agent)
[ AWS EC2 Instance ]
  - BeforeInstall: Installs Docker/Compose if missing, configures 4GB swap space
  - AfterInstall: Restores .env from SSM / persistent backup, sets permissions
  - ApplicationStart: Runs `docker compose -f docker-compose.prod.yml up -d --build`
  - ValidateService: Checks http://localhost:8000/health & http://localhost:3000
```

---

## 2. EC2 Instance Provisioning

### Recommended Instance Types
The backend runs local PyTorch embeddings (`BAAI/bge-m3`) and cross-encoder reranking (`bge-reranker-v2-m3`).
- **Recommended**: `t3.large` (2 vCPU, 8 GB RAM) or `t3.xlarge` (4 vCPU, 16 GB RAM).
- **Minimum**: `t3.medium` (4 GB RAM) — our `scripts/before_install.sh` automatically provisions a **4 GB swap file** to prevent Linux kernel Out-Of-Memory (OOM) kills.
- **AMI**: **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS** (or Amazon Linux 2023).
- **Storage**: At least **30 GB gp3 SSD** (Docker images + HuggingFace cache).

### Security Group Inbound Rules
| Port | Protocol | Source | Purpose |
|---|---|---|---|
| `22` | TCP | Your IP | SSH access |
| `80` | TCP | `0.0.0.0/0` | HTTP (if using reverse proxy / Nginx) |
| `443` | TCP | `0.0.0.0/0` | HTTPS |
| `3000` | TCP | `0.0.0.0/0` | Frontend UI |
| `8000` | TCP | `0.0.0.0/0` | Backend API docs & health |

---

## 3. EC2 IAM Role & CodeDeploy Agent

### Step 3.1: Create EC2 IAM Role
1. Go to **AWS IAM Console** → **Roles** → **Create Role**.
2. Select **AWS Service** → **EC2**.
3. Attach policies:
   - `AmazonSSMManagedInstanceCore` (for SSM access and remote terminal)
   - `AmazonS3ReadOnlyAccess` (for downloading CodeDeploy build artifacts from S3)
   - *(Optional for SSM Secrets)*: Custom inline policy for SSM Parameter Store:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "ssm:GetParameter",
             "ssm:GetParameters"
           ],
           "Resource": "arn:aws:ssm:*:*:parameter/machine-troubleshooter/*"
         }
       ]
     }
     ```
4. Name the role: `EC2-CodeDeploy-Role` and attach it to your EC2 instance:
   - **EC2 Console** → Select instance → **Actions** → **Security** → **Modify IAM Role** → Choose `EC2-CodeDeploy-Role`.

### Step 3.2: Tag Your EC2 Instance
Add a tag to your EC2 instance so CodeDeploy can find it:
- Key: `Environment`
- Value: `Production`
*(or Key: `Application`, Value: `machine-troubleshooter`)*

### Step 3.3: Install CodeDeploy Agent on EC2
Connect to your EC2 instance via SSH or SSM Session Manager, and run:

**On Ubuntu:**
```bash
sudo apt-get update -y
sudo apt-get install -y ruby-full wget curl

cd /tmp
# Replace 'us-east-1' with your AWS region if different
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region || echo "us-east-1")
wget "https://aws-codedeploy-${REGION}.s3.${REGION}.amazonaws.com/latest/install"
chmod +x ./install
sudo ./install auto

# Verify agent status
sudo systemctl status codedeploy-agent
```

---

## 4. Environment Variables Configuration

Sensitive production keys (Azure OpenAI, Supabase keys, Database URL) must **never** be checked into Git. Choose one of two methods:

### Method A: AWS Systems Manager Parameter Store (Recommended)
1. Go to **AWS Systems Manager** → **Parameter Store** → **Create parameter**.
2. **Name**: `/machine-troubleshooter/env`
3. **Type**: `SecureString`
4. **Value**: Paste your full `.env` file contents (from `.env.example` filled with your production keys).
5. `scripts/after_install.sh` will automatically fetch this parameter and write it to `/opt/machine-troubleshooter/.env`.

### Method B: Manual File on EC2 Instance
If you prefer not using SSM, SSH into your EC2 instance and create the file:
```bash
sudo mkdir -p /opt/machine-troubleshooter
sudo nano /opt/machine-troubleshooter/.env
# Paste your keys and save (Ctrl+O, Enter, Ctrl+X)
sudo chmod 600 /opt/machine-troubleshooter/.env
```
Our `scripts/before_install.sh` and `scripts/after_install.sh` automatically detect and preserve existing `.env` files across deployments.

---

## 5. AWS CodeDeploy Setup

1. Go to **AWS CodeDeploy** → **Applications** → **Create application**:
   - **Application name**: `MachineTroubleshooterApp`
   - **Compute platform**: `EC2/On-premises`
2. In the application, click **Create deployment group**:
   - **Deployment group name**: `MachineTroubleshooter-DG`
   - **Service role**: Select or create an IAM role with the `AWSCodeDeployRole` policy.
   - **Deployment type**: `In-place`
   - **Environment configuration**: Check **Amazon EC2 instances**, Tag Key: `Environment`, Value: `Production`.
   - **Deployment configuration**: `CodeDeployDefault.AllAtOnce`
   - **Load balancer**: Uncheck *Enable load balancing* (unless you have an Application Load Balancer).

---

## 6. AWS CodeBuild Setup

1. Go to **AWS CodeBuild** → **Build projects** → **Create build project**:
   - **Project name**: `MachineTroubleshooter-Build`
   - **Source provider**: `GitHub` (or CodeCommit / S3)
   - **Environment**:
     - Managed image: `Ubuntu`
     - Runtime: `Standard`
     - Image: `aws/codebuild/standard:7.0` (or latest)
     - Environment type: `Linux`
     - Privileged: **Check this box** (Enable this flag if you want to build Docker images or run Docker-in-Docker).
   - **Buildspec**: Choose **Use a buildspec file** (it automatically finds `buildspec.yml` in root).

---

## 7. AWS CodePipeline Setup

1. Go to **AWS CodePipeline** → **Pipelines** → **Create pipeline**:
   - **Pipeline name**: `MachineTroubleshooter-Pipeline`
   - **Service role**: New service role
2. **Source stage**:
   - Provider: **GitHub (Version 2)**
   - Connect your repository and select the `main` branch.
   - Trigger: Trigger on git push.
3. **Build stage**:
   - Provider: **AWS CodeBuild**
   - Project name: `MachineTroubleshooter-Build`
4. **Deploy stage**:
   - Provider: **AWS CodeDeploy**
   - Application name: `MachineTroubleshooterApp`
   - Deployment group: `MachineTroubleshooter-DG`
5. Click **Create pipeline**.

Whenever you push to the `main` branch:
1. CodePipeline pulls the source.
2. CodeBuild validates code and packages the build artifacts using `buildspec.yml`.
3. CodeDeploy triggers the EC2 agent, executing `appspec.yml` and all lifecycle hooks in `scripts/`.
4. The service is validated healthy on `http://<EC2-PUBLIC-IP>:8000/health` and `http://<EC2-PUBLIC-IP>:3000`.

---

## 8. Useful Commands & Troubleshooting

### View CodeDeploy Deployment Logs on EC2:
```bash
# View main CodeDeploy agent log
sudo tail -f /var/log/aws/codedeploy-agent/codedeploy-agent.log

# View hook execution script logs (before_install, application_start, validate_service, etc.)
sudo tail -f /opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log
```

### Check Container Status on EC2:
```bash
cd /opt/machine-troubleshooter
sudo docker compose -f docker-compose.prod.yml ps
sudo docker compose -f docker-compose.prod.yml logs -f
```

### Manual Restart / Reload:
```bash
cd /opt/machine-troubleshooter
sudo docker compose -f docker-compose.prod.yml down
sudo docker compose -f docker-compose.prod.yml up -d --build
```
