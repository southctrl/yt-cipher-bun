#!/bin/bash

set -e

SERVICE_NAME="ytdlp-api"

echo "--- Building new Docker image for service '$SERVICE_NAME' ---"
docker-compose build --pull "$SERVICE_NAME"
echo "--- Build complete ---"

echo "--- Restarting Docker Compose stack ---"
docker-compose up -d --force-recreate --remove-orphans
echo "--- Docker Compose stack restarted successfully ---"

exit 0