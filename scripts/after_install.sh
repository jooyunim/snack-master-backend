#!/bin/bash

set -e

echo "=== USER ==="
whoami

echo "=== HOME ==="
echo "$HOME"

export NVM_DIR="/home/ec2-user/.nvm"
source "$NVM_DIR/nvm.sh"

echo "=== NVM DIR ==="
echo "$NVM_DIR"

APP_DIR="/home/ec2-user/snack-master-backend"

cd "$APP_DIR"

echo "=== NODE VERSION ==="
which node
node -v

echo "=== NPM VERSION ==="
which npm
npm -v

echo "=== NPM CI START ==="
npm ci --ignore-scripts

echo "=== NPM CI END ==="

echo "=== PRISMA CHECK ==="
ls -la node_modules/.bin/prisma

echo "=== PRISMA GENERATE START ==="
npx prisma generate

echo "=== PRISMA GENERATE END ==="