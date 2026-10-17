-- Checklist reativo do relatorio premium (Cesar, 16/out/2026): o estado marcado
-- de cada item da secao "O que conferir antes de fechar negocio". Fica numa
-- tabela propria porque o snapshot do relatorio e imutavel.
-- item_id e o id ESTAVEL do item (shared/checklist-compra.ts), nunca o texto.
create table if not exists public.premium_checklist (
  pedido_id     uuid not null references public.pedidos_premium(id) on delete cascade,
  item_id       text not null check (char_length(item_id) between 1 and 40),
  marcado       boolean not null default false,
  marcado_em    timestamptz,
  atualizado_em timestamptz not null default now(),
  primary key (pedido_id, item_id)
);

-- regra da auditoria RLS de 30/set: toda tabela nova com RLS; sem policy = so service_role acessa
alter table public.premium_checklist enable row level security;

notify pgrst, 'reload schema';
