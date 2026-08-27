-- Cupom de desconto no checkout premium (v1). Modelo alinhado com @fin:
-- tabela propria (nada de integracao nativa com a AbacatePay), tipo
-- percentual ou fixo, validade, limites global + por-cliente, piso sempre
-- respeitado (basica >= R$9,90 / completa >= R$14,90), SEM bypass de 100%
-- na v1. Preco final e SEMPRE recalculado server-side no checkout.post.ts —
-- esta tabela e so a fonte de verdade da regra do cupom, nao do preco final.
create table if not exists public.cupons_premium (
  id uuid primary key default gen_random_uuid(),
  -- normalizado uppercase/sem espaco pelo server antes de gravar/consultar
  codigo text not null unique,
  tipo text not null check (tipo in ('percentual', 'fixo')),
  -- percentual: 0-100. fixo: centavos (mesma unidade de valor_centavos em pedidos_premium).
  valor numeric not null check (valor > 0),
  planos text[] not null default '{basica,completa}',
  ativo boolean not null default true,
  valido_de timestamptz,
  valido_ate timestamptz,
  limite_uso_global integer,          -- null = sem limite
  limite_uso_por_cliente integer not null default 1,
  usos_atual integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cupons_premium_codigo_idx on public.cupons_premium (codigo);

-- Registro de uso: 1 linha por pedido que aplicou cupom (pedido_id UNIQUE
-- evita double-count se o endpoint de validar/pagar for chamado 2x). Guarda
-- os 3 valores (bruto/desconto/liquido) fixos no momento da compra pro P&L
-- do @fin nao depender do estado atual do cupom (que pode mudar/desativar
-- depois).
create table if not exists public.cupons_premium_usos (
  id uuid primary key default gen_random_uuid(),
  cupom_id uuid not null references public.cupons_premium(id),
  pedido_id uuid not null unique references public.pedidos_premium(id),
  email text not null,
  preco_bruto numeric not null,
  valor_desconto numeric not null,
  preco_liquido numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists cupons_premium_usos_email_idx on public.cupons_premium_usos (email);
create index if not exists cupons_premium_usos_cupom_idx on public.cupons_premium_usos (cupom_id);

-- RLS habilitado, mesmo padrao das outras tabelas premium (lockdown de
-- 20260827030000): sem policy = negado pra anon/authenticated; service_role bypassa.
alter table public.cupons_premium enable row level security;
alter table public.cupons_premium_usos enable row level security;

notify pgrst, 'reload schema';
