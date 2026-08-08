#!/bin/bash

export NVM_DIR="/home/ec2-user/.nvm"
source "$NVM_DIR/nvm.sh"

APP_DIR=/home/ec2-user/snack-master-backend

cd $APP_DIR

pm2 restart backend || pm2 start npm --name backend -- start