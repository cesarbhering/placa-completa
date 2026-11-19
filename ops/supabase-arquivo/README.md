# Arquivo do Supabase no R2

O plano Free do Supabase vira só leitura acima de 500 MB, e a regra do projeto é não descartar dado coletado. Por isso, antes de qualquer linha ou coluna sair do banco, o `pc-supabase-arquivar`:

1. grava o dado no R2;
2. baixa de volta e confere;
3. só então apaga.

## Como funciona

**O que é gravado:** no bucket privado `placa-completa-backups`, um objeto `.jsonl.gz` por dia (fuso de Brasília) e um `.manifest.json` com:
- linhas;
- sha256 do jsonl e do gz;
- md5 dos ids e md5 da coluna que vai ser zerada.

O caminho é `supabase-arquivo/<tabela>/AAAA/MM/AAAA-MM-DD.*`. Para outro projeto, como o staging, o prefixo é `supabase-arquivo-<ref>`.

**A conferência depois do upload:** o script baixa o objeto e confere o sha256 e o número de linhas. Também nunca sobrescreve um objeto que já esteja no R2.

**Antes de zerar, quatro checagens:**
- O dia tem pelo menos 8 dias, contando a partir de hoje.
- O banco ainda bate com o manifesto: mesmas linhas, mesmo md5 dos ids e da coluna.
- O objeto no R2 é baixado de novo e conferido.
- Sem `--confirmar`, o script só mostra o que faria.

**Estado:** `/var/lib/pc-supabase-arquivo/<tabela>-<ref>.json`, com um lock por tabela.

## Tabelas

| Tabela | Retenção no banco | O que sai depois de arquivado | Resumo que fica |
|---|---|---|---|
| consultas | 7 dias | a coluna `api_response` (cópia do `placa_cache.payload`, que nada lê); a linha fica | não precisa |
| api_chamadas | 30 dias | as linhas brutas, menos `wdapi` e `placafipe`, que o fin lê | `api_chamadas_diario` |
| eventos_funil | 30 dias | as linhas brutas | `eventos_funil_diario` e `funil_diario_arquivo`; a view `funil_diario` lê os dias arquivados daí |
| placa_cache | não encontradas: 6 h; encontradas: 90 dias | a linha inteira, exceto as placas com pedido pago, que o relatório lê para pegar o número do motor (ação `podar`, até 5.000 linhas por rodada) | não precisa; a placa que voltar é buscada de novo |

**Migrations que precisam estar aplicadas antes:**
- consultas: `20261119200000_leads_extract_incremental`, porque a função de leads era a única leitora da coluna.
- api_chamadas e eventos_funil: `20261119220000_daily_summaries_before_archiving`, com as funções de resumo. Essa migration também tira o DELETE de api_chamadas do `fonte_cache_limpar()`.

**placa_cache:** o DELETE apaga só as linhas arquivadas, pela mesma placa e o mesmo `fetched_at`. A placa renovada nesse meio-tempo fica no banco.

**Como apaga:** o DELETE das tabelas brutas confere a impressão do dia, com linhas, md5 dos ids e md5 de cada linha, dentro do próprio comando. Se o dia mudou desde o arquivo, nada é apagado.

## Instalação

```
install -m 755 pc-supabase-arquivar /usr/local/bin/
cp pc-supabase-arquivar-*.service pc-supabase-arquivar-*.timer /etc/systemd/system/
systemctl daemon-reload
```

Cada timer só é ligado depois do backfill e da primeira janela de liberar daquela tabela. Os horários são 04h00 (consultas), 04h20 (api_chamadas), 04h40 (eventos_funil) e 05h00 (placa_cache).

## Uso manual

```
pc-supabase-arquivar consultas arquivar --de 2026-08-03 --ate 2026-11-19 --pausa 10   # backfill, só lê o banco
pc-supabase-arquivar consultas liberar --ate 2026-11-14                                # simulação
pc-supabase-arquivar consultas liberar --ate 2026-11-14 --confirmar
pc-supabase-arquivar eventos_funil arquivar --de 2026-09-20 --ate 2026-11-19 --pausa 10
pc-supabase-arquivar eventos_funil liberar --ate 2026-10-19 --confirmar
pc-supabase-arquivar consultas status
```

O espaço só volta para o painel do Supabase depois de um `VACUUM (FULL, ANALYZE)` da tabela, numa janela de madrugada.

## Testes

```
python3 -m unittest discover -s ops/supabase-arquivo -p 'test_*.py'
```

Os testes não tocam no banco nem no R2.
