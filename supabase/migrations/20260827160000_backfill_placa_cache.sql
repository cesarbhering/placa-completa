-- ============================================================
-- Backfill do placa_cache a partir das consultas ja feitas.
--
-- Contexto: o placa_cache zerou no cutover pro projeto fivalp (nasceu vazio) e
-- estava reaquecendo devagar, entao o lookup gratis batia na wdapi (API paga) a
-- cada placa. As consultas ja feitas guardam a resposta bruta da wdapi em
-- `consultas.api_response` — da pra popular o cache direto dela, sem custo de
-- API, cortando a queima drasticamente quando os creditos forem recarregados.
--
-- Regras (casando com o que server/utils/placa-lookup.ts espera):
--  - So ENCONTRADAS: linhas cujo api_response tem marca/modelo/anoModelo com
--    valor (nao vazio). Nao-encontradas e erros ficam de fora (nao viram cache).
--  - Uma entrada por placa: a consulta MAIS RECENTE (payload/fetched_at mais
--    novos).
--  - fetched_at = created_at real da consulta (respeita o TTL de 180 dias do
--    lookup; consultas antigas demais entram ja "stale" e sao re-consultadas).
--  - placa normalizada pro formato do PK (7 chars, A-Z0-9, upper).
--  - ON CONFLICT: so atualiza se a linha do backfill for MAIS NOVA que a ja
--    cacheada — nao sobrescreve entradas frescas gravadas ao vivo.
--
-- Idempotente: rodar de novo nao muda nada (o guard de fetched_at barra). Num
-- rebuild do zero (consultas vazio) e no-op.
-- ============================================================

insert into public.placa_cache (placa, payload, encontrado, fetched_at)
select distinct on (norm.placa_norm)
  norm.placa_norm,
  norm.api_response,
  true,
  norm.created_at
from (
  select
    upper(regexp_replace(placa, '[^A-Za-z0-9]', '', 'g')) as placa_norm,
    api_response,
    created_at
  from public.consultas
  where api_response is not null
    and jsonb_typeof(api_response) = 'object'
    and coalesce(
      nullif(api_response->>'MARCA', ''), nullif(api_response->>'marca', ''),
      nullif(api_response->>'MODELO', ''), nullif(api_response->>'modelo', ''),
      nullif(api_response->>'anoModelo', '')
    ) is not null
) norm
where length(norm.placa_norm) = 7
order by norm.placa_norm, norm.created_at desc
on conflict (placa) do update
  set payload = excluded.payload,
      encontrado = true,
      fetched_at = excluded.fetched_at
  where placa_cache.fetched_at < excluded.fetched_at;

notify pgrst, 'reload schema';
