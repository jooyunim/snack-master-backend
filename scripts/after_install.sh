#!/bin/bash

set -e

export NVM_DIR="/home/ec2-user/.nvm"
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"

APP_DIR="/home/ec2-user/snack-master-backend"
# zip이 .bin/prisma 심볼릭 링크를 풀어버리면 wasm을 .bin에서 찾다 ENOENT 남.
# 패키지 실제 경로로 실행해야 prisma/build/*.wasm을 정상 로드함.
PRISMA_CLI="$APP_DIR/node_modules/prisma/build/index.js"

echo "=== NVM DIR ==="
echo "$NVM_DIR"

echo "=== NODE VERSION ==="
node -v

echo "=== NPM VERSION ==="
npm -v

echo "=== APP DIR ==="
echo "$APP_DIR"

cd "$APP_DIR"

echo "=== CURRENT DIRECTORY ==="
pwd

echo "=== NODE_MODULES CHECK ==="
if [ -d "node_modules" ]; then
  echo "SUCCESS: node_modules directory exists!"
else
  echo "ERROR: node_modules directory does NOT exist!"
  exit 1
fi

# CodeDeploy가 root로 파일을 풀어 소유권이 꼬일 수 있음
sudo chown -R ec2-user:ec2-user "$APP_DIR"

echo "=== PRISMA MIGRATIONS ==="
node "$PRISMA_CLI" migrate deploy

echo "=== PRODUCT SEARCH BACKFILL ==="
node "$APP_DIR/dist/scripts/backfill-product-search.js"
