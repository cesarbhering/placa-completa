-- Limite customizado por destinatario: hourly_limit N = N consultas/hora;
-- NULL = ilimitado. Quem nao esta na tabela usa o default (5/hora).

alter table public.rate_limit_whitelist
  add column if not exists hourly_limit integer;

comment on column public.rate_limit_whitelist.hourly_limit is
  'Consultas/hora permitidas. NULL = ilimitado.';
