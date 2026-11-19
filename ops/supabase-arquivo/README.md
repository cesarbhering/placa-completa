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

- **consultas:** zera `api_response`, a cópia do `placa_cache.payload` que nada lê, depois de 7 dias.
  - A migration `20261119200000_leads_extract_incremental` precisa estar aplicada antes do primeiro `zerar`, porque a função de leads era a única leitora da coluna.

## Instalação

```
install -m 755 pc-supabase-arquivar /usr/local/bin/
cp pc-supabase-arquivar-consultas.service pc-supabase-arquivar-consultas.timer /etc/systemd/system/
systemctl daemon-reload
```

Só ligar o timer (`systemctl enable --now pc-supabase-arquivar-consultas.timer`) depois do backfill e da primeira janela de zerar.

## Uso manual

```
pc-supabase-arquivar consultas arquivar --de 2026-08-03 --ate 2026-11-19 --pausa 10   # backfill, só lê o banco
pc-supabase-arquivar consultas zerar --ate 2026-11-14                                  # simulação
pc-supabase-arquivar consultas zerar --ate 2026-11-14 --confirmar
pc-supabase-arquivar consultas status
```

O espaço só volta para o painel do Supabase depois de um `VACUUM (FULL, ANALYZE) public.consultas`, numa janela de madrugada.

## Testes

```
python3 -m unittest discover -s ops/supabase-arquivo -p 'test_*.py'
```

Os testes não tocam no banco nem no R2.
