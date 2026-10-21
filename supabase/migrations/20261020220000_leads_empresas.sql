-- Pedidos de proposta de consultas em pacote (/para-empresas, Cesar 20/out/2026).
create table if not exists public.leads_empresas (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  nome          text not null,
  empresa       text not null,
  tipo          text not null check (tipo in ('Lojista', 'Garagem', 'Despachante', 'Outro')),
  cidade        text not null,
  uf            text not null check (length(uf) = 2),
  volume_faixa  text not null check (volume_faixa in ('até 20', '20 a 50', '50 a 200', 'mais de 200')),
  whatsapp      text not null,
  email         text not null,
  mensagem      text,
  origem        text,
  ip_hash       text,
  user_agent    text,
  status        text not null default 'novo',
  respondido_em timestamptz
);

create index if not exists leads_empresas_criado_idx on public.leads_empresas (criado_em desc);

-- regra da auditoria RLS de 30/set: toda tabela nova com RLS; sem policy = so service_role acessa
alter table public.leads_empresas enable row level security;

notify pgrst, 'reload schema';
