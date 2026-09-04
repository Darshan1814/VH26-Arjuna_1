#!/usr/bin/env bash
# =============================================================================
# Machine Troubleshooting System — EC2 Attached EBS Volume Setup Script
# Formats, mounts, and configures persistent storage on AWS EC2
# =============================================================================
set -e

MOUNT_DIR="/mnt/data"
ENV_FILE="$(pwd)/.env"

echo "=========================================================="
echo " AWS EC2 Attached Volume Setup"
echo " Target Mount Directory: ${MOUNT_DIR}"
echo "=========================================================="

# 1. Check if user is root or has sudo
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script with sudo: sudo ./mount-ebs-volume.sh [DEVICE]"
  exit 1
fi

# 2. Determine device
TARGET_DEV="$1"

if [ -z "$TARGET_DEV" ]; then
  echo "Detecting attached block devices..."
  lsblk
  echo ""
  # Find unmounted disk (excluding root disk type 'disk' without mountpoint)
  CANDIDATE=$(lsblk -dpno NAME,TYPE,MOUNTPOINT | awk '$2=="disk" && $3=="" {print $1}' | head -n 1)
  if [ -n "$CANDIDATE" ]; then
    echo "Auto-detected unmounted attached volume: $CANDIDATE"
    TARGET_DEV="$CANDIDATE"
  else
    # Check if already mounted
    if mountpoint -q "$MOUNT_DIR"; then
      echo "Volume is already mounted at $MOUNT_DIR."
    else
      echo "No unmounted block device automatically detected."
      echo "Usage: sudo ./mount-ebs-volume.sh /dev/xvdf  (or /dev/nvme1n1)"
      exit 1
    fi
  fi
fi

if [ -n "$TARGET_DEV" ]; then
  echo "--> Using device: ${TARGET_DEV}"

  # Check if device has an existing filesystem
  FSTYPE=$(blkid -o value -s TYPE "$TARGET_DEV" || true)
  if [ -z "$FSTYPE" ]; then
    echo "--> No filesystem found on ${TARGET_DEV}. Creating ext4 filesystem..."
    mkfs -t ext4 "$TARGET_DEV"
  else
    echo "--> Existing filesystem detected (${FSTYPE}). Skipping format."
  fi

  # Create mount directory
  mkdir -p "$MOUNT_DIR"

  # Mount if not already mounted
  if ! mountpoint -q "$MOUNT_DIR"; then
    echo "--> Mounting ${TARGET_DEV} to ${MOUNT_DIR}..."
    mount "$TARGET_DEV" "$MOUNT_DIR"
  fi

  # Add to /etc/fstab for persistence across reboots
  UUID=$(blkid -s UUID -o value "$TARGET_DEV")
  if [ -n "$UUID" ]; then
    if ! grep -q "$UUID" /etc/fstab; then
      echo "--> Adding UUID=${UUID} to /etc/fstab for auto-mount on reboot..."
      echo "UUID=${UUID} ${MOUNT_DIR} ext4 defaults,nofail 0 2" >> /etc/fstab
    fi
  fi
fi

# 3. Create necessary persistent directories on the attached volume
echo "--> Setting up persistent application directories on ${MOUNT_DIR}..."
mkdir -p "${MOUNT_DIR}/manuals"
mkdir -p "${MOUNT_DIR}/manuals/evidence"
mkdir -p "${MOUNT_DIR}/manuals/reports"
mkdir -p "${MOUNT_DIR}/database"
mkdir -p "${MOUNT_DIR}/model_cache"

# Set permissions so docker containers (non-root / nextjs / uvicorn) have full write access
chmod -R 777 "${MOUNT_DIR}"

echo "--> Verifying mounted volume structure:"
ls -ld "${MOUNT_DIR}"/*

# 4. Update .env if present
if [ -f "$ENV_FILE" ]; then
  echo "--> Updating DATA_VOLUME_PATH=${MOUNT_DIR} in ${ENV_FILE}..."
  if grep -q "^DATA_VOLUME_PATH=" "$ENV_FILE"; then
    sed -i.bak "s|^DATA_VOLUME_PATH=.*|DATA_VOLUME_PATH=${MOUNT_DIR}|" "$ENV_FILE"
  else
    echo "DATA_VOLUME_PATH=${MOUNT_DIR}" >> "$ENV_FILE"
  fi
  # Also verify NEXT_PUBLIC_API_URL is empty in .env to prevent fetch errors
  sed -i.bak "s|^NEXT_PUBLIC_API_URL=http://localhost:8000|NEXT_PUBLIC_API_URL=|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  echo "--> Successfully configured .env to use attached volume at ${MOUNT_DIR}!"
fi

echo "=========================================================="
echo " Volume Setup Completed Successfully!"
echo " Attached storage is active at: ${MOUNT_DIR}"
echo " Persistent directories ready:"
echo "   - ${MOUNT_DIR}/manuals"
echo "   - ${MOUNT_DIR}/database"
echo "   - ${MOUNT_DIR}/model_cache"
echo ""
echo " You can now start or restart Docker Compose:"
echo "   docker compose down && docker compose up -d"
echo "=========================================================="
