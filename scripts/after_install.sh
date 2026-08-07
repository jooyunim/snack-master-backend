#!/bin/bash

export NVM_DIR="/home/ec2-user/.nvm"
source "$NVM_DIR/nvm.sh"

APP_DIR=/home/ec2-user/snack-master-backend

cd $APP_DIR

npm install

npx prisma generate