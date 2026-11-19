# Migrations do Supabase

**Não use `supabase db push` no prod nem no staging.** Em 19/11/2026, o histórico estava assim:

| Projeto | Migrations do repo sem registro |
|---|---|
| prod | 60 |
| staging | 48 |

Essas migrations foram aplicadas por SQL direto, e o push tentaria rodar todas de novo.

Para aplicar uma migration nova, use:

```
ops/supabase/aplicar-migration.sh --dry-run <ref> supabase/migrations/<arquivo>.sql   # simulação, não muda nada
ops/supabase/aplicar-migration.sh <ref> supabase/migrations/<arquivo>.sql
```

- ref do prod: `fivalpkfneadngxiflea`; ref do staging: `nqhlxsvggrumgcceamwg`. Sempre o staging antes do prod.
- O arquivo vai inteiro numa chamada da Management API. Uma string com vários comandos roda numa transação só: se um comando falhar, nada fica aplicado nem registrado.
- Depois de aplicar, o script registra a versão em `supabase_migrations.schema_migrations` e manda `notify pgrst, 'reload schema'`.
- Uma versão já registrada não é aplicada de novo.
- Arquivo com BEGIN/COMMIT, CONCURRENTLY ou VACUUM (fora de comentário) é recusado, porque esses comandos não rodam numa transação.
- O log fica em `/var/log/pc-aplicar-migration.log`, ou no caminho de `PC_MIGRATION_LOG`.

## Testado no staging em 19/11

1. A simulação não fez nada.
2. Uma migration trivial foi aplicada e registrada.
3. Reexecutar não fez nada.
4. Uma migration com erro no meio não deixou a tabela criada antes do erro nem o registro.
5. CONCURRENTLY citado só em comentário passa; CONCURRENTLY de verdade é recusado.

O registro de teste foi apagado do staging depois.

**Pendente:** pôr em dia o histórico do staging (as 48 sem registro), com `migration repair` ou replay, fora deste script.
