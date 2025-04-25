#!/bin/bash

set -e

CONTAINER_NAME="ytdlp_signature_api" 
SERVICE_NAME="ytdlp-api"       
PYTHON_CMD="python3"             
PIP_CMD="pip"                  

version_gt() {
    "$PYTHON_CMD" -c "from packaging.version import parse; import sys; sys.exit(0 if parse('$1') > parse('$2') else 1)"
}

echo "--- Checking for yt-dlp updates ---"

echo "Fetching latest yt-dlp version from PyPI..."
LATEST_VERSION=$("$PIP_CMD" index versions --pre yt-dlp | grep 'LATEST:' | awk '{print $2}')
if [ -z "$LATEST_VERSION" ]; then
    echo "Error: Could not fetch the latest version from PyPI. Exiting."
    exit 1
fi
echo "Latest available yt-dlp version: $LATEST_VERSION"

CURRENT_VERSION=""
echo "Attempting to get current version from container '$CONTAINER_NAME'..."
if docker ps -f name="^/${CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    CURRENT_VERSION=$(docker exec "$CONTAINER_NAME" "$PIP_CMD" show yt-dlp | grep Version | awk '{print $2}' || echo "")
    if [ -n "$CURRENT_VERSION" ]; then
        echo "Currently installed yt-dlp version: $CURRENT_VERSION"
    else
        echo "Warning: Container '$CONTAINER_NAME' is running, but failed to get yt-dlp version. Assuming update is needed."
        CURRENT_VERSION=""
    fi
else
    echo "Container '$CONTAINER_NAME' is not running. Will build/recreate."
fi


NEEDS_BUILD=false
if [ -z "$CURRENT_VERSION" ]; then
    echo "Update status unknown or container not running. Proceeding to build/recreate."
    NEEDS_BUILD=true
elif version_gt "$LATEST_VERSION" "$CURRENT_VERSION"; then
    echo "Newer yt-dlp version ($LATEST_VERSION) found (current: $CURRENT_VERSION). Rebuilding image."
    NEEDS_BUILD=true
else
    echo "Current yt-dlp version ($CURRENT_VERSION) is up-to-date or newer. No build needed."
    NEEDS_BUILD=false
fi

if [ "$NEEDS_BUILD" = true ]; then
    echo "--- Building new Docker image for service '$SERVICE_NAME' ---"
    docker-compose build --pull "$SERVICE_NAME"
    echo "--- Build complete ---"
else
    echo "--- Skipping build ---"
fi

echo "--- Restarting Docker Compose stack ---"
docker-compose up -d --force-recreate --remove-orphans
echo "--- Docker Compose stack restarted successfully ---"

exit 0