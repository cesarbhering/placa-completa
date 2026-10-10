#!/usr/bin/env bash
# Rodada mensal da camada 2 do cambio (timer pc-cambio-chassi, dia 1, 01h10).
# 1) extrai os lotes do leiloes-poc-db (so SELECT, janela 01h-05h45);
# 2) le as escolhas dos clientes em prod (so SELECT, Management API);
# 3) regenera shared/cambio-chassi.json num worktree limpo da main;
# 4) se mudou, abre PR pro Cesar. NUNCA troca em prod sozinho.
set -euo pipefail
DIR=${CAMBIO_DIR:-/var/lib/cambio-chassi}
REPO=${REPO:-/root/placa-completa}
WT=$DIR/wt
mkdir -p "$DIR"
LOG=$DIR/rodar.log
exec >>"$LOG" 2>&1
echo "== $(date -Is) inicio"
# Dia 2 so existe pra retomar extracao que nao terminou no dia 1.
if [ "$(cat "$DIR/ultimo-ok" 2>/dev/null)" = "$(date +%Y%m)" ]; then echo "rodada do mes ja feita"; exit 0; fi

CAMBIO_DIR="$DIR" "$(dirname "$(readlink -f "$0")")/extrair.sh" || true
if [ ! -f "$DIR/status" ]; then echo "extracao nao terminou (retoma no proximo disparo)"; exit 0; fi
rm -f "$DIR/status"

# Escolhas dos clientes (chassi + cambio), so leitura.
TOKEN=$(cat /root/.supabase/access-token)
python3 - "$DIR/escolhas.json" "$TOKEN" <<'PY'
import json, sys, urllib.request
out, tok = sys.argv[1], sys.argv[2]
q = """select coalesce(relatorio_snapshot->'consulta'->'response'->0, relatorio_snapshot->'consulta'->'response')->>'chassi' chassi,
 relatorio_snapshot->'valorCusto'->'fipeEscolhaCliente'->>'cambio' cambio
from pedidos_premium where status='entregue' and ambiente='producao' and relatorio_snapshot->'valorCusto' ? 'fipeEscolhaCliente'"""
req = urllib.request.Request('https://api.supabase.com/v1/projects/fivalpkfneadngxiflea/database/query',
  data=json.dumps({'query': q}).encode(), headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json', 'User-Agent': 'cambio-chassi'})
rows = json.load(urllib.request.urlopen(req, timeout=60))
json.dump([r for r in rows if r.get('chassi') and r.get('cambio')], open(out, 'w'))
PY

git -C "$REPO" fetch -q origin
BR="chore/cambio-chassi-$(date +%Y%m)"
rm -rf "$WT"; git -C "$REPO" worktree prune
git -C "$REPO" worktree add -q -B "$BR" "$WT" origin/main
ln -sfn "${NODE_MODULES:-/root/pc-wt-go/node_modules}" "$WT/node_modules"
(cd "$WT" && npx jiti ops/cambio-chassi/gerar.ts "$DIR/lotes-cambio.csv" "$DIR/escolhas.json" shared/cambio-chassi.json)
rm -f "$WT/node_modules"
date +%Y%m > "$DIR/ultimo-ok"
if git -C "$WT" diff --quiet -- shared/cambio-chassi.json; then echo "sem mudanca"; exit 0; fi
# So a versao/data mudou (mesmas regras): nao vale PR.
if git -C "$WT" diff -- shared/cambio-chassi.json | grep -E '^[+-] +"[A-Z0-9]{8}"' -q; then :; else echo "so metadados mudaram"; exit 0; fi
git -C "$WT" add shared/cambio-chassi.json
git -C "$WT" commit -qm "chore(fipe): regras de cambio por chassi, rodada $(date +%Y-%m)"
git -C "$WT" push -q -f -u origin "$BR"
gh pr create -R cesarbhering/placa-completa --base main --head "$BR" \
  --title "chore(fipe): regras de cambio por chassi ($(date +%Y-%m))" \
  --body "Rodada mensal automatica da camada 2 do cambio (ops/cambio-chassi). Regras pos 1-8, minimo 5 chassis, 0 conflito; metricas da validacao cruzada no campo fonte do JSON. Revisar o diff antes de mergear." || true
echo "== $(date -Is) fim"
