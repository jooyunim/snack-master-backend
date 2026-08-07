#!/bin/bash

export NVM_DIR="/home/ec2-user/.nvm"
source "$NVM_DIR/nvm.sh"

pm2 describe backend | grep "status.*online"