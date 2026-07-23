-- Potenciais parceiros: candidatos a limite customizado / parceria
-- (gerenciada no Supabase Studio; quem for aprovado vai pra
-- rate_limit_whitelist com o hourly_limit combinado).

create table if not exists public.potenciais_parceiros (
  id bigint generated always as identity primary key,
  email text not null unique,
  justificativa text not null,        -- quem e / por que seria parceiro
  created_at timestamptz not null default now()
);

alter table public.potenciais_parceiros enable row level security;

-- Sem policies: apenas service_role acessa (mesmo padrao das tabelas internas).
