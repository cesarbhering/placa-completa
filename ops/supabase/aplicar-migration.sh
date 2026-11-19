#!/bin/bash
# Aplica UMA migration (arquivo .sql do repo) num projeto Supabase pela Management API e registra
# a versao em supabase_migrations.schema_migrations, depois manda o PostgREST recarregar o schema.
#
# Por que nao `supabase db push`: em 19/11/2026 o historico do prod tinha 60 migrations do repo
# aplicadas sem registro (48 no staging). O push tentaria rodar todas de novo.
#
# O arquivo inteiro vai numa chamada so. Uma string com varios comandos roda numa transacao
# implicita: se um comando falhar, nada fica aplicado, e a versao nao e registrada.
# O arquivo nao pode ter BEGIN/COMMIT, CONCURRENTLY nem VACUUM (nao rodam em transacao).
#
# Uso: aplicar-migration.sh [--dry-run] <ref> <arquivo.sql>
#      ref prod: fivalpkfneadngxiflea | staging: nqhlxsvggrumgcceamwg
# Log: ${PC_MIGRATION_LOG:-/var/log/pc-aplicar-migration.log}
set -euo pipefail
DRY=0; [ "${1:-}" = "--dry-run" ] && { DRY=1; shift; }
[ $# -eq 2 ] || { echo "uso: $0 [--dry-run] <ref> <arquivo.sql>"; exit 2; }
REF=$1; F=$2
[ -f "$F" ] || { echo "arquivo nao existe: $F"; exit 2; }
base=$(basename "$F" .sql); ver=${base%%_*}; nome=${base#*_}
[[ "$ver" =~ ^[0-9]{14}$ ]] || { echo "nome fora do padrao AAAAMMDDHHMMSS_nome.sql: $base"; exit 2; }
if grep -v '^[[:space:]]*--' "$F" | grep -qiE '^\s*(begin|commit|rollback)\s*;|\bconcurrently\b|^\s*vacuum\b'; then
  echo "o arquivo tem controle de transacao, CONCURRENTLY ou VACUUM: aplicar a mao"; exit 2
fi
L=${PC_MIGRATION_LOG:-/var/log/pc-aplicar-migration.log}
log(){ echo "$(date '+%F %T') $REF $*" | tee -a "$L"; }
api(){ curl -sS -m 300 -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
        -H "Authorization: Bearer $(cat /root/.supabase/access-token)" -H "Content-Type: application/json" \
        -d "$(jq -n --arg q "$1" '{query:$q}')" -w ' http=%{http_code}'; }

ja=$(api "select count(*) as n from supabase_migrations.schema_migrations where version = '$ver'")
echo "$ja" | grep -q 'http=201' || { log "falha ao ler o historico: ${ja:0:200}"; exit 1; }
if ! echo "$ja" | grep -q '"n":0'; then log "$ver ja registrada, nada feito"; exit 0; fi
sha=$(sha256sum "$F" | cut -c1-12)
if [ $DRY = 1 ]; then log "dry-run: aplicaria $base (sha256 $sha, $(wc -l < "$F") linhas), nada feito"; exit 0; fi

log "aplicando $base (sha256 $sha)"
r=$(api "$(cat "$F")")
if ! echo "$r" | grep -q 'http=201'; then log "FALHOU, nada registrado: ${r:0:400}"; exit 1; fi
reg=$(api "insert into supabase_migrations.schema_migrations (version, name) values ('$ver', '$nome') on conflict do nothing")
echo "$reg" | grep -q 'http=201' || { log "APLICADA MAS NAO REGISTRADA (registrar a mao): ${reg:0:200}"; exit 1; }
api "notify pgrst, 'reload schema'" > /dev/null
log "$ver aplicada, registrada e schema recarregado"
