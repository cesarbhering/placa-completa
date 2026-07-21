-- Log duravel de requests bloqueadas (rate limit e afins).
-- Motivacao: os 429 eram invisiveis - o container nao loga erros tratados
-- e os logs docker morrem a cada deploy. Auditoria de 21/jul estimou 20
-- janelas de bloqueio em 30 dias sem nenhum rastro consultavel.

create table if not exists public.blocked_requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  reason text not null,               -- 'rate_limit_ip' | 'rate_limit_recipient'
  ip_address text,
  recipient text,                     -- email/telefone que tentou (para debug de abuso)
  placa text,
  user_agent text
);

alter table public.blocked_requests enable row level security;

-- Sem policies: apenas service_role acessa (mesmo padrao das outras tabelas internas).

create index if not exists blocked_requests_created_at_idx
  on public.blocked_requests (created_at desc);
