#!/bin/bash
# Instala o pc-monitor na VPS (rodar como root a partir deste diretorio). Idempotente.
# Backup do que existir em /root/pc-monitor-backup-<data>. Volta atras: ./instalar.sh --voltar <dir-do-backup>
set -euo pipefail
cd "$(dirname "$0")"
if [ "${1:-}" = "--voltar" ]; then
  B=$2; cp "$B/pc-checkout-probe.mjs" /usr/local/bin/; cp "$B"/pc-checkout-probe.{service,timer} /etc/systemd/system/
  systemctl disable --now pc-site-check.timer || true; systemctl daemon-reload; systemctl restart pc-checkout-probe.timer
  echo "voltou para $B"; exit 0
fi
B=/root/pc-monitor-backup-$(date +%Y%m%d-%H%M); mkdir -p "$B"
cp /usr/local/bin/pc-checkout-probe.mjs "$B/" 2>/dev/null || true
cp /etc/systemd/system/pc-checkout-probe.{service,timer} "$B/" 2>/dev/null || true
install -m 755 pc-monitor /usr/local/bin/pc-monitor
install -m 755 pc-checkout-probe.mjs /usr/local/bin/pc-checkout-probe.mjs
install -m 644 pc-site-check.service pc-site-check.timer pc-checkout-probe.service pc-checkout-probe.timer /etc/systemd/system/
mkdir -p /var/lib/pc-monitor /var/log/pc-monitor
systemctl daemon-reload
systemctl enable pc-site-check.timer pc-checkout-probe.timer
systemctl restart pc-site-check.timer pc-checkout-probe.timer
systemctl list-timers pc-site-check.timer pc-checkout-probe.timer --no-pager
echo "backup em $B"
