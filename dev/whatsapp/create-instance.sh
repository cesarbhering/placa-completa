#!/usr/bin/env bash
# Creates a named instance on the local Evolution API and prints the
# QR code URL you scan from the WhatsApp app to pair the number.
# Usage: ./create-instance.sh placa-completa

set -euo pipefail
cd "$(dirname "$0")"

NAME="${1:-placa-completa}"
KEY=$(grep '^EVOLUTION_API_KEY=' .env | cut -d= -f2)

curl -fsS -X POST "http://127.0.0.1:8081/instance/create" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d "{\"instanceName\": \"$NAME\", \"qrcode\": true, \"integration\": \"WHATSAPP-BAILEYS\"}" \
| python3 -m json.tool

echo
echo "Open http://127.0.0.1:8081/manager in a browser, log in with the API"
echo "key, click the '$NAME' instance, and scan the QR with WhatsApp →"
echo "Settings → Linked Devices → Link a Device."
