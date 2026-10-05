-- Cupom de recompra (05/out/2026, decisao do Cesar): toda compra paga a partir
-- do deploy gera um codigo de 20%, valido 7 dias desde a entrega, uso
-- ilimitado por qualquer pessoa (compartilhar e bom). Reusa cupons_premium
-- (origem='recompra'); pedido_origem_id diz qual pedido gerou o codigo.
-- No pedido que USA o cupom: cupom_origem='cupom_recompra' e qual pedido
-- gerou (cupom_pedido_origem_id), pra medir recompra e compartilhamento.
-- RLS: as duas tabelas ja tem RLS ligado; coluna nova herda.
alter table public.cupons_premium
  add column if not exists pedido_origem_id uuid;
create unique index if not exists cupons_premium_pedido_origem_uidx
  on public.cupons_premium (pedido_origem_id) where pedido_origem_id is not null;

alter table public.pedidos_premium
  add column if not exists cupom_origem text,
  add column if not exists cupom_pedido_origem_id uuid;

-- Cupom de recompra vale sem e-mail: o registro de uso aceita e-mail nulo.
alter table public.cupons_premium_usos alter column email drop not null;

notify pgrst, 'reload schema';
