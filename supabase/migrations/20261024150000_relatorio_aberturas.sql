-- Aberturas do relatorio pago (pedido do Cesar, 24/out/2026): responder "quem
-- abriu e de onde" (caso PGB7E23, comprador de Colinas do Tocantins/TO, sem
-- registro nenhum das aberturas). Gravado pelo servidor ao servir o relatorio
-- (server/utils/relatorio-aberturas.ts), uma linha por pedido + ip_hash +
-- origem a cada 30 min.
-- LGPD: nunca o token nem o IP crus. token_hash = sha256(token); ip_hash = o
-- mesmo esquema do eventos_funil (sha256 com sal do servidor, 32 hex). Geo e
-- cidade/UF/pais do IP (mesma fonte da tabela consultas). Retencao: 180 dias.
create table if not exists public.relatorio_aberturas (
  id bigserial primary key,
  pedido_id uuid not null references public.pedidos_premium(id) on delete cascade,
  token_hash text not null,
  aberto_em timestamptz not null default now(),
  geo_uf text,
  geo_cidade text,
  geo_pais text,
  ip_hash text,
  dispositivo text,
  sistema text,
  mesmo_ip_da_compra boolean,
  origem text not null default 'pagina' check (origem in ('pagina', 'pdf', 'email_link', 'preview'))
);

create index if not exists ix_rel_aberturas_pedido on public.relatorio_aberturas (pedido_id, aberto_em desc);
create index if not exists ix_rel_aberturas_token on public.relatorio_aberturas (token_hash);
create index if not exists ix_rel_aberturas_aberto on public.relatorio_aberturas (aberto_em);

-- RLS ligada e sem policy: so o service role (servidor) le e grava.
alter table public.relatorio_aberturas enable row level security;
revoke all on public.relatorio_aberturas from anon, authenticated;

-- Consulta rapida por token_hash: encode(sha256(convert_to('<token>','UTF8')),'hex').
create or replace view public.relatorio_aberturas_resumo
with (security_invoker = on) as
select
  token_hash,
  pedido_id,
  count(*) as aberturas,
  count(*) filter (where origem <> 'preview') as aberturas_sem_preview,
  min(aberto_em) as primeira_abertura,
  max(aberto_em) as ultima_abertura,
  array_agg(distinct geo_uf) filter (where geo_uf is not null) as ufs,
  array_agg(distinct geo_cidade || coalesce('/' || geo_uf, '')) filter (where geo_cidade is not null) as cidades,
  count(distinct ip_hash) as ips_distintos,
  bool_or(mesmo_ip_da_compra) as abriu_do_ip_da_compra,
  array_agg(distinct origem) as origens
from public.relatorio_aberturas
group by token_hash, pedido_id;

revoke all on public.relatorio_aberturas_resumo from anon, authenticated;

-- Retencao de 180 dias: limpeza diaria leve (04:17 UTC).
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule('relatorio-aberturas-retencao')
where exists (select 1 from cron.job where jobname = 'relatorio-aberturas-retencao');
select cron.schedule(
  'relatorio-aberturas-retencao',
  '17 4 * * *',
  $$delete from public.relatorio_aberturas where aberto_em < now() - interval '180 days'$$
);

notify pgrst, 'reload schema';
