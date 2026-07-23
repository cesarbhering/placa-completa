-- Leads de cotacao real de seguro: gerados pelo modal pos-consulta
-- (usuario viu a estimativa SUSEP e pediu contato telefonico).
-- Gestao manual da coluna status no Supabase Studio.

create table if not exists public.cotacoes_seguro (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email text,                          -- do fluxo da consulta
  phone text not null,                 -- normalizado E.164 sem + (5531...)
  placa text,
  marca text,
  modelo text,
  ano_modelo int,
  regiao_code text,                    -- codigo REGSUSEP da estimativa exibida
  premio_estimado numeric,             -- o valor que o usuario VIU no modal
  franquia_estimada numeric,
  status text not null default 'novo'  -- novo | contatado | convertido | descartado
);

alter table public.cotacoes_seguro enable row level security;

-- Sem policies: apenas service_role (insert e server-side; padrao das tabelas internas).
