#!/usr/bin/env bash
# Stops the local Evolution API dev stack. Keeps the named volumes
# (DB + redis state) unless --wipe is passed.

set -euo pipefail
cd "$(dirname "$0")"

if [[ "${1:-}" == "--wipe" ]]; then
  docker compose down -v
  echo "Containers stopped and volumes wiped."
else
  docker compose down
  echo "Containers stopped (volumes preserved). Use --wipe to also drop them."
fi
