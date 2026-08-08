#!/bin/bash

APP_DIR=/home/ec2-user/snack-master-backend

if [ -d "$APP_DIR" ]; then
  sudo rm -rf $APP_DIR/*
fi