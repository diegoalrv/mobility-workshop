#!/bin/bash

try() {
    "$@" || echo "Warning: command failed - $*"
}

try docker stop pm
try docker rm pm
try docker rmi pois_manager
try docker build -t pois_manager .
try docker run --name pm --env-file .env -p 8080:8080 -d pois_manager
