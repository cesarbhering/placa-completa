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
# dependencias proprias da sonda (nunca o node_modules do checkout de trabalho do site)
mkdir -p /opt/pc-checkout-probe && cp probe-package.json /opt/pc-checkout-probe/package.json
(cd /opt/pc-checkout-probe && npm install --no-audit --no-fund >/dev/null && \
  PLAYWRIGHT_BROWSERS_PATH=/opt/pc-checkout-probe/browsers npx playwright install chromium >/dev/null)
install -m 755 pc-monitor pc-monitor-panico pc-deploy-watch /usr/local/bin/
install -m 755 pc-checkout-probe.mjs /usr/local/bin/pc-checkout-probe.mjs
install -m 644 pc-site-check.service pc-site-check.timer pc-checkout-probe.service pc-checkout-probe.timer \
  pc-fila-check.service pc-fila-check.timer pc-tunel-check.service pc-tunel-check.timer \
  pc-monitor-meta.service pc-monitor-meta.timer pc-monitor-panico.service \
  pc-recursos-check.service pc-recursos-check.timer pc-deploy-watch.service pc-deploy-watch.timer \
  pc-deploy-check.service pc-deploy-check.timer /etc/systemd/system/
mkdir -p /var/lib/pc-monitor /var/log/pc-monitor
systemctl daemon-reload
systemctl enable pc-site-check.timer pc-checkout-probe.timer pc-fila-check.timer pc-tunel-check.timer pc-recursos-check.timer pc-deploy-check.timer pc-monitor-meta.timer
systemctl restart pc-site-check.timer pc-checkout-probe.timer pc-fila-check.timer pc-tunel-check.timer pc-recursos-check.timer pc-deploy-check.timer pc-monitor-meta.timer
systemctl list-timers pc-site-check.timer pc-checkout-probe.timer pc-fila-check.timer pc-tunel-check.timer pc-recursos-check.timer pc-deploy-check.timer pc-monitor-meta.timer --no-pager
echo "backup em $B"
