-- Custo por pedido de fontes externas pagas (comeca pelo DETRAN via Infosimples,
-- ~R$0,28 por chamada, cobrado ATE em erro). O fin soma isto no P&L por venda.
-- Uma linha por CHAMADA (sucesso ou erro), com o header.price e o code retornado.
create table if not exists public.premium_custos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos_premium (id),
  fonte text not null,                 -- ex: 'infosimples_detran_sp'
  preco numeric not null default 0,    -- header.price da resposta (BRL)
  code integer,                        -- code da resposta (200, erro, etc.)
  criado_em timestamptz not null default now()
);
create index if not exists premium_custos_pedido_idx on public.premium_custos (pedido_id);
create index if not exists premium_custos_fonte_idx on public.premium_custos (fonte, criado_em);

alter table public.premium_custos enable row level security;
-- Sem policy: so o service role (server) escreve/le. Superficie zero.

notify pgrst, 'reload schema';
