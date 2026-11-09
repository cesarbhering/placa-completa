-- Resultado do Cloudflare Turnstile por requisicao da consulta gratis (POST /api/consulta), 09/nov/2026.
--
-- Serve pra medir, no modo 'log', quantas consultas viriam sem token ou com token invalido antes de ligar o
-- 'enforce', separando web, PWA e app. Sem PII: nada de IP, token, placa ou e-mail. O dia sai de criado_em.
create table if not exists public.turnstile_eventos (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  modo       text not null check (modo in ('log', 'enforce')),
  resultado  text not null check (resultado in ('ok', 'ausente', 'invalido', 'erro_siteverify')),
  bloqueado  boolean not null default false,
  is_pwa     boolean not null default false,
  is_app     boolean not null default false
);

create index if not exists turnstile_eventos_criado_idx on public.turnstile_eventos (criado_em);

-- regra da auditoria RLS de 30/set: toda tabela nova com RLS; sem policy = so service_role acessa
alter table public.turnstile_eventos enable row level security;

comment on table public.turnstile_eventos is
  'Resultado do Turnstile na consulta gratis (modo log/enforce). Sem IP nem token; contar por dia, resultado e canal.';

notify pgrst, 'reload schema';
