#!/bin/bash

set -e

APP_DIR=/home/ec2-user/snack-master-backend
ENV_BACKUP=/tmp/snack-master-backend.env.bak

rm -f "$ENV_BACKUP"

if [ -d "$APP_DIR" ]; then
  if [ -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env" "$ENV_BACKUP"
  fi

  sudo rm -rf "$APP_DIR"/*

  if [ -f "$ENV_BACKUP" ]; then
    sudo cp "$ENV_BACKUP" "$APP_DIR/.env"
    sudo chown ec2-user:ec2-user "$APP_DIR/.env"
    rm -f "$ENV_BACKUP"
  fi
fi
