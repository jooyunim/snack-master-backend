#!/bin/bash

set -e

export NVM_DIR="/home/ec2-user/.nvm"
source "$NVM_DIR/nvm.sh"

APP_DIR=/home/ec2-user/snack-master-backend

cd $APP_DIR

echo "=== START BACKEND ==="

pm2 restart backend || pm2 start dist/server.js --name backend

pm2 save

echo "=== PM2 STATUS ==="
pm2 status