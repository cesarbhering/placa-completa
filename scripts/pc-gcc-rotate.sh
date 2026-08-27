#!/usr/bin/env bash
# ============================================================
# pc-gcc-rotate — rotaciona a chave de uso continuo do GCC (quemmeviu) de forma
# automatizada e a grava nas 2 bases Supabase (prod fivalp + staging nqhlxs).
#
# Uso:
#   pc-gcc-rotate <producao|homolog> [--dry-run]
#
# Fluxo:
#   1. Le a chave status='active' do ambiente em gcc_api_keys (base prod, via
#      Management API do Supabase).
#   2. POST {gccBase}/chaves-api/gerar com header Api-Key: <chave atual>, sem
#      corpo. O GCC gera a nova chave de uso continuo e INVALIDA a atual NA HORA.
#      A nova so aparece nesta resposta (campo chave_api, + expira_em).
#   3. IMEDIATAMENTE grava a nova como active nas 2 bases (ambiente correto) e
#      marca as antigas active como 'rotated' — atomico por base (CTE).
#   4. Valida com um POST de consentimento (/consentimentos-ciencias) esperando
#      HTTP 201 + numero_hash_consulta.
#   5. NUNCA imprime a chave. Se a gravacao falhar depois de gerar, salva a chave
#      nova num arquivo temporario protegido (600) como salvaguarda e avisa.
#
# Seguranca: como o passo 2 invalida a chave atual imediatamente, o passo 3 e
# disparado sem intervalo. A chave nunca vai pra stdout, log, nem argv (curl le
# os headers de um arquivo de config 600).
#
# Teste sem queimar chave: PC_GCC_MOCK=1 com PC_GCC_MOCK_DIR apontando pra uma
# pasta com respostas mockadas (ver o bloco de mocks). Nesse modo nenhuma
# chamada real (GCC ou Supabase) acontece.
# ============================================================
set -euo pipefail

# --- nunca deixar rastro de comando com segredo ---
set +x

# ------------------------------------------------------------
# Args + config por ambiente
# ------------------------------------------------------------
AMBIENTE="${1:-}"
DRY_RUN=0
[ "${2:-}" = "--dry-run" ] && DRY_RUN=1

die() { echo "ERRO: $*" >&2; exit 1; }
info() { echo "[pc-gcc-rotate] $*" >&2; }

case "$AMBIENTE" in
  producao)
    GCC_BASE="https://company.quemmeviu.com.br"
    TEMPLATE_ID="41102026-00001"
    ;;
  homolog)
    GCC_BASE="https://company.hml.quemmeviu.com.br"
    TEMPLATE_ID="2932026-00001"
    ;;
  *)
    die "uso: pc-gcc-rotate <producao|homolog> [--dry-run]"
    ;;
esac

CNPJ_PROVEDOR="37115342004154"
PROD_REF="fivalpkfneadngxiflea"
STG_REF="nqhlxsvggrumgcceamwg"
MGMT="https://api.supabase.com/v1/projects"

MOCK="${PC_GCC_MOCK:-0}"
MOCK_DIR="${PC_GCC_MOCK_DIR:-}"

SUPA_TOKEN=""
if [ "$MOCK" != "1" ]; then
  [ -f "$HOME/.supabase/access-token" ] || die "sem ~/.supabase/access-token"
  SUPA_TOKEN="$(tr -d '\r\n' < "$HOME/.supabase/access-token")"
  [ -n "$SUPA_TOKEN" ] || die "access-token vazio"
fi

# arquivos temporarios protegidos (config de headers do curl + salvaguarda)
TMPDIR_SEC="$(mktemp -d)"
chmod 700 "$TMPDIR_SEC"
cleanup() { rm -rf "$TMPDIR_SEC" 2>/dev/null || true; }
trap cleanup EXIT

# ------------------------------------------------------------
# Helpers de escaping SQL (o valor vira literal '...'; aspas simples dobradas)
# ------------------------------------------------------------
sql_lit() {
  # $1 = valor; imprime 'valor' com aspas simples internas dobradas, ou NULL se vazio
  if [ -z "${1:-}" ] || [ "${1:-}" = "null" ]; then
    printf 'NULL'
  else
    printf "'%s'" "$(printf '%s' "$1" | sed "s/'/''/g")"
  fi
}

# ------------------------------------------------------------
# Camada de rede (mockavel). NENHUMA imprime a chave.
# ------------------------------------------------------------

# supa_query <ref> <sql> -> imprime o JSON de resposta da Management API
supa_query() {
  local ref="$1" sql="$2"
  if [ "$MOCK" = "1" ]; then
    cat "${MOCK_DIR}/supa_${ref}.json" 2>/dev/null || echo '[]'
    return 0
  fi
  local body cfg
  body="$(jq -nc --arg q "$sql" '{query:$q}')"
  cfg="$TMPDIR_SEC/supa.curlrc"
  # bearer via config file 600 (fora do argv)
  umask 077; printf 'header = "Authorization: Bearer %s"\n' "$SUPA_TOKEN" > "$cfg"
  curl -sS -K "$cfg" \
    -H "Content-Type: application/json" \
    -X POST "${MGMT}/${ref}/database/query" \
    --data "$body"
  rm -f "$cfg"
}

# gcc_gerar <api_key> -> imprime o JSON da resposta de /chaves-api/gerar
gcc_gerar() {
  local key="$1"
  if [ "$MOCK" = "1" ]; then
    cat "${MOCK_DIR}/gerar.json" 2>/dev/null || echo '{}'
    return 0
  fi
  local cfg="$TMPDIR_SEC/gerar.curlrc"
  umask 077; printf 'header = "Api-Key: %s"\n' "$key" > "$cfg"
  curl -sS -K "$cfg" \
    -H "accept: application/json" \
    -X POST "${GCC_BASE}/chaves-api/gerar"
  rm -f "$cfg"
}

# gcc_consent <api_key> -> imprime "HTTP:<status>" na 1a linha e o body nas demais
gcc_consent() {
  local key="$1"
  if [ "$MOCK" = "1" ]; then
    echo "HTTP:$(cat "${MOCK_DIR}/consent_status" 2>/dev/null || echo 201)"
    cat "${MOCK_DIR}/consent.json" 2>/dev/null || echo '{}'
    return 0
  fi
  local cfg="$TMPDIR_SEC/consent.curlrc"
  umask 077; printf 'header = "Api-Key: %s"\n' "$key" > "$cfg"
  local resp
  resp="$(curl -sS -K "$cfg" -w $'\nHTTP:%{http_code}' \
    -H "accept: application/json" -H "Content-Type: application/json" \
    -X POST "${GCC_BASE}/consentimentos-ciencias" \
    --data "$(jq -nc --arg cnpj "$CNPJ_PROVEDOR" --arg tpl "$TEMPLATE_ID" \
      '{tipo_titular:null, cpf_cnpj:"", tipo_de_usuario:1, cnpj_provedor:$cnpj, template_id:$tpl}')")"
  rm -f "$cfg"
  # reordena: status primeiro, body depois (pra ficar igual ao mock)
  local status
  status="$(printf '%s' "$resp" | sed -n 's/^HTTP:\([0-9]*\)$/\1/p' | tail -1)"
  echo "HTTP:${status:-000}"
  printf '%s' "$resp" | sed '/^HTTP:[0-9]*$/d'
}

# ------------------------------------------------------------
# 1) Le a chave active do ambiente (base prod = fonte da verdade)
# ------------------------------------------------------------
info "ambiente=$AMBIENTE gccBase=$GCC_BASE (mock=$MOCK dry-run=$DRY_RUN)"
info "lendo chave active de gcc_api_keys ($AMBIENTE) na base prod..."

READ_SQL="select api_key from public.gcc_api_keys where ambiente = $(sql_lit "$AMBIENTE") and status = 'active' order by created_at desc limit 1;"
READ_JSON="$(supa_query "$PROD_REF" "$READ_SQL")"

# Management API devolve um array de linhas: [{"api_key":"..."}]
CURRENT_KEY="$(printf '%s' "$READ_JSON" | jq -r 'if type=="array" and length>0 then .[0].api_key else empty end' 2>/dev/null || true)"
[ -n "$CURRENT_KEY" ] || die "nao achei chave active pra ambiente=$AMBIENTE (resposta: $(printf '%s' "$READ_JSON" | head -c 300))"
info "chave atual encontrada (prefixo ${CURRENT_KEY:0:6}...), ok."

if [ "$DRY_RUN" = "1" ]; then
  info "DRY-RUN: pararia aqui. NAO chamaria /chaves-api/gerar (isso invalidaria a chave atual)."
  info "DRY-RUN: em seguida gravaria a nova nas bases $PROD_REF e $STG_REF e validaria com um consentimento."
  exit 0
fi

# ------------------------------------------------------------
# 2) Gera a nova chave (INVALIDA a atual na hora)
# ------------------------------------------------------------
info "gerando nova chave (isso invalida a atual imediatamente)..."
GERAR_JSON="$(gcc_gerar "$CURRENT_KEY")"
NEW_KEY="$(printf '%s' "$GERAR_JSON" | jq -r '.chave_api // empty' 2>/dev/null || true)"
EXPIRA_EM="$(printf '%s' "$GERAR_JSON" | jq -r '.expira_em // empty' 2>/dev/null || true)"
[ -n "$NEW_KEY" ] || die "gerar nao retornou chave_api (resposta: $(printf '%s' "$GERAR_JSON" | head -c 300))"
info "nova chave gerada (prefixo ${NEW_KEY:0:6}...), expira_em=${EXPIRA_EM:-?}"

# salvaguarda: a partir daqui a chave nova SO existe aqui. Se a gravacao falhar,
# dumpar num arquivo 600 pra recuperacao manual.
salvaguarda() {
  local out; out="$(mktemp /root/pc-gcc-newkey.XXXXXX)"; chmod 600 "$out"
  { echo "ambiente=$AMBIENTE"; echo "expira_em=$EXPIRA_EM"; echo "chave_api=$NEW_KEY"; } > "$out"
  info "SALVAGUARDA: a chave nova foi salva em $out (600). Grave manualmente nas 2 bases e apague o arquivo."
}

# ------------------------------------------------------------
# 3) Grava a nova como active nas 2 bases + marca antigas rotated (atomico/base)
# ------------------------------------------------------------
# redige a raw_response (remove chave_api) pra nao duplicar o segredo no banco
RAW_REDACTED="$(printf '%s' "$GERAR_JSON" | jq -c 'if type=="object" then (.chave_api = "[redacted]") else . end' 2>/dev/null || echo '{}')"

build_write_sql() {
  local exp_lit rot_lit raw_lit amb_lit key_lit
  amb_lit="$(sql_lit "$AMBIENTE")"
  key_lit="$(sql_lit "$NEW_KEY")"
  raw_lit="$(sql_lit "$RAW_REDACTED")"
  if [ -n "$EXPIRA_EM" ]; then
    exp_lit="$(sql_lit "$EXPIRA_EM")::timestamptz"
    rot_lit="($(sql_lit "$EXPIRA_EM")::timestamptz - interval '30 days')"
  else
    exp_lit="NULL"; rot_lit="NULL"
  fi
  cat <<SQL
with rotated as (
  update public.gcc_api_keys set status = 'rotated', rotated_at = now()
  where ambiente = ${amb_lit} and status = 'active'
  returning id
)
insert into public.gcc_api_keys (api_key, status, ambiente, expires_at, rotate_after, raw_response, note)
values (${key_lit}, 'active', ${amb_lit}, ${exp_lit}, ${rot_lit}, ${raw_lit}::jsonb, 'rotacionada via pc-gcc-rotate');
SQL
}

WRITE_SQL="$(build_write_sql)"
WROTE_OK=1
for ref in "$PROD_REF" "$STG_REF"; do
  info "gravando nova chave na base $ref..."
  RESP="$(supa_query "$ref" "$WRITE_SQL" || true)"
  # a Management API devolve erro com campo "message" quando falha
  if printf '%s' "$RESP" | jq -e 'if type=="object" and (has("message") or has("error")) then true else false end' >/dev/null 2>&1; then
    info "FALHA ao gravar em $ref: $(printf '%s' "$RESP" | head -c 300)"
    WROTE_OK=0
  else
    info "gravado em $ref, ok."
  fi
done

if [ "$WROTE_OK" != "1" ]; then
  salvaguarda
  die "a gravacao falhou em ao menos uma base. Chave nova salva na salvaguarda; reconcilie manualmente."
fi

# ------------------------------------------------------------
# 4) Valida a nova chave com um consentimento (espera 201 + numero_hash_consulta)
# ------------------------------------------------------------
info "validando a nova chave com um POST de consentimento..."
CONSENT_OUT="$(gcc_consent "$NEW_KEY")"
CONSENT_STATUS="$(printf '%s' "$CONSENT_OUT" | sed -n 's/^HTTP:\([0-9]*\)$/\1/p' | head -1)"
CONSENT_BODY="$(printf '%s' "$CONSENT_OUT" | sed '/^HTTP:[0-9]*$/d')"
HASH="$(printf '%s' "$CONSENT_BODY" | jq -r '.numero_hash_consulta // empty' 2>/dev/null || true)"

if [ "$CONSENT_STATUS" = "201" ] && [ -n "$HASH" ]; then
  info "OK: consentimento HTTP 201 + numero_hash_consulta obtido. Rotacao concluida com sucesso."
  info "Resumo: ambiente=$AMBIENTE, expira_em=${EXPIRA_EM:-?}, chave gravada em $PROD_REF e $STG_REF."
  exit 0
else
  info "ATENCAO: a nova chave FOI gravada nas 2 bases, mas a validacao nao retornou 201+hash"
  info "  (HTTP=${CONSENT_STATUS:-?}, body: $(printf '%s' "$CONSENT_BODY" | head -c 200))."
  info "  A chave ja esta active no banco; rode uma consulta de verdade pra confirmar, ou investigue o GCC."
  exit 2
fi
