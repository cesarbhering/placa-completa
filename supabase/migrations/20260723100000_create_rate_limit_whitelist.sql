-- Whitelist de destinatarios (email ou telefone) isentos do rate limit
-- de 5 consultas/hora. Gerenciada direto no Supabase Studio - sem deploy.
-- O servidor cacheia por 5 min, entao mudancas valem em ate 5 min.

create table if not exists public.rate_limit_whitelist (
  recipient text primary key,          -- email (lowercase) ou telefone normalizado
  note text,                           -- quem e / por que esta isento
  created_at timestamptz not null default now()
);

alter table public.rate_limit_whitelist enable row level security;

-- Sem policies: apenas service_role acessa (mesmo padrao das tabelas internas).
