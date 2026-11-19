# Migrations do Supabase

**Não use `supabase db push` no prod nem no staging.** Em 19/11/2026, o histórico estava assim:

| Projeto | Migrations do repo sem registro |
|---|---|
| prod | 60 |
| staging | 48 |

Essas migrations foram aplicadas por SQL direto, e o push tentaria rodar todas de novo.

## Como aplicar

Uma migration por vez, sempre no staging antes do prod:

```
ops/supabase/aplicar-migration --dry-run staging supabase/migrations/<arquivo>.sql   # só confere
ops/supabase/aplicar-migration --ensaio  staging supabase/migrations/<arquivo>.sql   # roda e desfaz (rollback)
ops/supabase/aplicar-migration staging supabase/migrations/<arquivo>.sql
ops/supabase/aplicar-migration --ensaio  prod supabase/migrations/<arquivo>.sql --confirmar-prod PlacaCompleta
ops/supabase/aplicar-migration prod supabase/migrations/<arquivo>.sql --confirmar-prod PlacaCompleta
```

## O que o script garante

- **Tudo ou nada.** O arquivo, o registro em `supabase_migrations.schema_migrations` (com o conteúdo em `statements`) e o `notify pgrst, 'reload schema'` vão numa chamada só, que é uma transação só. Não existe "aplicada sem registro".
- **Guarda de transação.** Um parser tira comentários, strings, identificadores entre aspas e corpos `$tag$`. Depois disso, o script recusa:
  - comando que comece por begin, start, commit, end, rollback, abort, savepoint, release, prepare ou vacuum;
  - alter system e create/drop database ou tablespace;
  - qualquer `concurrently`.
- **Alvo travado.** Só `prod` e `staging`. O nome do projeto é conferido na API antes de aplicar, e o prod exige `--confirmar-prod PlacaCompleta`.
- **Reexecução:**
  - versão registrada com o mesmo conteúdo: não faz nada;
  - versão registrada com conteúdo diferente: avisa e sai com 3;
  - versão registrada pelo CLI: não compara.
- **Queda da chamada** (timeout, rede, 5xx): registra "ESTADO DESCONHECIDO", sai com 4 e nunca repete sozinho. Antes de rodar de novo, confira o histórico e os objetos.
- **Segredos.** O token e o SQL não aparecem na linha de comando (ps, /proc), e não há limite de 128 KB.
- **Nome do arquivo:** `AAAAMMDDHHMMSS_nome.sql`, só com minúsculas, dígitos e `_`.

**Códigos de saída:**

| Código | Significado |
|---|---|
| 0 | aplicada, ou nada a fazer |
| 1 | erro de SQL, nada aplicado |
| 2 | recusada antes de rodar |
| 3 | conteúdo diferente do registrado |
| 4 | estado desconhecido |

**Log:** `/var/log/pc-aplicar-migration.log`, ou o caminho de `PC_MIGRATION_LOG`.

**Testes:** `unshare -n -- python3 -m unittest discover -s ops/supabase -p 'test_*.py'`.
- Não tocam banco nem rede.
- O `unshare -n` cobre também subprocessos, que o bloqueio de socket do `setUpModule` não alcança.

## Testado no staging em 19/11

1. `--dry-run` não mudou nada.
2. `--ensaio` rodou e desfez: nem tabela nem versão ficaram.
3. A aplicação criou a tabela, gravou a linha e registrou a versão com `statements`, numa transação.
4. Reexecutar com o mesmo conteúdo não fez nada.
5. Com o conteúdo mudado, avisou e saiu com 3.
6. Erro no meio não deixou nada aplicado nem registrado.
7. `commit` no meio da linha foi recusado antes de qualquer chamada.
8. Prod sem `--confirmar-prod` foi recusado.

A limpeza veio depois: tabela e versão de teste removidas.

**Pendente:** pôr em dia o histórico do staging (as 48 migrations sem registro), fora deste script.
