#!/bin/bash

set -e

export NVM_DIR="/home/ec2-user/.nvm"
source "$NVM_DIR/nvm.sh"

APP_DIR="/home/ec2-user/snack-master-backend"

cd "$APP_DIR"

echo "=== PM2 STATUS ==="
pm2 status

echo "=== BACKEND STATUS ==="
pm2 describe backend

echo "=== HEALTH CHECK ==="
curl -f http://localhost:4000/health

echo "=== DEPLOYMENT SUCCESS ==="