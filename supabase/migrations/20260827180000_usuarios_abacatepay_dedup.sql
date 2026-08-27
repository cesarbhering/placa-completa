-- Dedup de cliente na AbacatePay por e-mail: criarOuObterCliente() so fazia
-- customers/create, nunca buscava antes, entao cada compra virava um customer
-- novo pro mesmo e-mail (confirmado: mesmo email = customer_ids diferentes no
-- dashboard). Esta tabela guarda o mapeamento email -> customer_id canonico
-- (o mais antigo), pra get-or-create de verdade no server/utils/abacatepay.ts.
create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  abacatepay_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists usuarios_email_idx on public.usuarios (email);

-- RLS habilitado igual as outras tabelas premium (padrao do lockdown de
-- 20260827030000): sem policy = negado pra anon/authenticated; o app usa
-- service_role, que bypassa.
alter table public.usuarios enable row level security;

notify pgrst, 'reload schema';
