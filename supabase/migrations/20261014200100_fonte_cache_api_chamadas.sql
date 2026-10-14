-- Relatorio 2.0 (Cesar 14/out/2026), itens (b) e (c):
-- (b) cache por chave (placa, chassi, codigo FIPE...) com TTL POR FONTE e "consultado em" exposto ao relatorio.
--     TTLs: multas 24 h, leilao 30 d, chassi 30 d, recall 7 d, fipe 7 d. Falha nao e cacheada (so 'ok' e 'sem_dado').
-- (c) log leve de chamadas a APIs externas (hoje FIPE e invisivel): uma linha por chamada, sem payload, sem PII.
-- placa_cache (wdapi) continua como esta; recall_consultas/multas_consultas seguem como auditoria de custo.

create table if not exists public.fonte_cache (
  fonte          text not null,                 -- multas_sp, leilao, chassi, recall, recall_montadora, fipe_historico, nhtsa...
  chave          text not null,                 -- placa (maiuscula, sem hifen), chassi ou codigo FIPE
  status         text not null check (status in ('ok', 'sem_dado')),
  payload        jsonb not null,                -- o bloco como vai ao snapshot; sem dado pessoal de proprietario
  consultado_em  timestamptz not null default now(),
  expira_em      timestamptz not null,
  primary key (fonte, chave)
);
create index if not exists fonte_cache_expira_idx on public.fonte_cache (expira_em);
alter table public.fonte_cache enable row level security;      -- sem policy: so service_role

-- TTL padrao por fonte num lugar so (o site pode passar outro, mas o padrao vem daqui)
create or replace function public.fonte_cache_ttl(p_fonte text) returns interval language sql immutable as $$
  select case
    when p_fonte like 'multas%'  then interval '24 hours'
    when p_fonte like 'leilao%'  then interval '30 days'
    when p_fonte like 'chassi%'  then interval '30 days'
    when p_fonte like 'recall%'  then interval '7 days'
    when p_fonte like 'fipe%'    then interval '7 days'
    when p_fonte like 'nhtsa%'   then interval '7 days'
    else interval '24 hours' end
$$;

create table if not exists public.api_chamadas (
  id         bigint generated always as identity primary key,
  fonte      text not null,                   -- fipe, leiloes_api, vin_decoder, nhtsa, ...
  endpoint   text not null check (length(endpoint) <= 120),   -- caminho SEM placa/chassi/token (ex.: /models/fipe/:cod/price-history)
  code       int,                             -- HTTP; null = timeout/erro de rede
  ms         int,
  cache_hit  boolean not null default false,
  pedido_id  uuid references public.pedidos_premium(id) on delete set null,
  criado_em  timestamptz not null default now()
);
create index if not exists api_chamadas_fonte_criado_idx on public.api_chamadas (fonte, criado_em);
alter table public.api_chamadas enable row level security;

-- limpeza: cache vencido ha mais de 7 dias e log com mais de 90 dias (chamada pelo timer do infra, 1x por dia)
create or replace function public.fonte_cache_limpar() returns jsonb language plpgsql security definer set search_path = public as $$
declare c int; l int;
begin
  delete from public.fonte_cache where expira_em < now() - interval '7 days'; get diagnostics c = row_count;
  delete from public.api_chamadas where criado_em < now() - interval '90 days'; get diagnostics l = row_count;
  return jsonb_build_object('cache_removido', c, 'log_removido', l);
end $$;
revoke all on function public.fonte_cache_limpar() from public, anon, authenticated;
