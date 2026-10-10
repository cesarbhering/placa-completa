#!/usr/bin/env bash
# Camada 2 (cambio por chassi): extrai do leiloes-poc-db os lotes com chassi e
# cambio no nome do modelo. SO de madrugada (regra do Cesar: 01h-06h), so
# SELECT, statement_timeout curto, lote por faixa de id, para as 05h45 e
# retoma da faixa salva no proximo dia.
set -u
DIR=${CAMBIO_DIR:-/var/lib/cambio-chassi}
mkdir -p "$DIR"
OUT=$DIR/lotes-cambio.csv
CUR=$DIR/cursor
LOG=$DIR/extrair.log
set -a; . /root/.leiloes-db.env; set +a
FAIXA=50000
MAX=$(docker exec -e PGPASSWORD="$DB_PASS" leiloes-poc-db psql -U leiloes -d leiloes -Atc "set statement_timeout='10s'; select max(id) from leilao_index" | tail -1)
# Rodada nova (sem cursor): comeca do zero e zera a saida.
if [ ! -f "$CUR" ]; then : > "$OUT"; fi
id=$(cat "$CUR" 2>/dev/null || echo 0)
echo "$(date -Is) inicio id=$id max=$MAX" >> "$LOG"
while [ "$id" -le "$MAX" ]; do
  h=$(date +%H%M)
  if [ "$h" -ge 0545 ] && [ "$h" -lt 2300 ]; then echo "$(date -Is) parada horario id=$id" >> "$LOG"; exit 0; fi
  if [ "$h" -lt 0100 ] || [ "$h" -ge 2300 ]; then echo "$(date -Is) fora da janela id=$id" >> "$LOG"; exit 0; fi
  ate=$((id + FAIXA))
  docker exec -e PGPASSWORD="$DB_PASS" leiloes-poc-db psql -U leiloes -d leiloes -Atq -v ON_ERROR_STOP=1 -c "set statement_timeout='20s'" -c "copy (select id, fonte, chassi17, marca_n, modelo_n, ano_mod from leilao_index where id >= $id and id < $ate and chassi17 is not null and length(chassi17)=17 and modelo_n ~* '(^| )(AT[0-9]{0,2}|MT[0-9]?|CVT|DCT|DSG|AMT|AUT|AUTO|AUTOM|AUTOMATICO|AUTOMATIC|MEC|MECANICO|MANUAL|TIPTRONIC|POWERSHIFT|DUALOGIC|IMOTION|I-MOTION|EASYTRONIC|XTRONIC|MULTIDRIVE)( |$)|[0-9](AT|MT|CVT)[0-9]?( |$)|[0-9]{2}T(AT|MT)( |$)|[0-9][ .][0-9](A|M)( |$)') to stdout with csv" >> "$OUT" 2>>"$LOG"
  if [ $? -ne 0 ]; then echo "$(date -Is) erro faixa id=$id (pula)" >> "$LOG"; fi
  id=$ate
  echo "$id" > "$CUR"
  sleep 2
done
echo "$(date -Is) fim id=$id linhas=$(wc -l < "$OUT")" >> "$LOG"
echo concluido > $DIR/status
rm -f "$CUR"
