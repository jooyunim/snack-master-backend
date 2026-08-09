#!/bin/bash

set -e

export NVM_DIR="/home/ec2-user/.nvm"
source "$NVM_DIR/nvm.sh"

APP_DIR="/home/ec2-user/snack-master-backend"

echo "=== NVM DIR ==="
echo "$NVM_DIR"

echo "=== NODE VERSION ==="
node -v

echo "=== NPM VERSION ==="
npm -v

echo "=== NODE_MODULES CHECK ==="
if [ -d "node_modules" ]; then
    echo "SUCCESS: node_modules directory exists!"
else
    echo "ERROR: node_modules directory does NOT exist!"
    # node_modules가 없으면 배포 실패로 처리
    exit 1
fi
