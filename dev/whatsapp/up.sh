#!/usr/bin/env bash
# Boots the local Evolution API dev stack. Generates a fresh .env on
# first run so each developer ends up with their own credentials.

set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "Generating dev .env with fresh credentials..."
  cat > .env <<EOF
EVOLUTION_API_KEY=$(openssl rand -hex 24)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
EOF
  chmod 600 .env
fi

docker compose up -d
echo
echo "Evolution API is starting at http://127.0.0.1:8081"
echo "Manager UI:  http://127.0.0.1:8081/manager"
echo "API key:     $(grep '^EVOLUTION_API_KEY=' .env | cut -d= -f2)"
echo
echo "Wait ~10s, then create an instance with:"
echo "  ./create-instance.sh placa-completa"
