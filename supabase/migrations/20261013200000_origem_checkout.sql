-- Porta de entrada do checkout (pedido do Cesar, 13/out): qual botao abriu o
-- checkout que virou o pedido. Enum no codigo (shared/origem-checkout.ts):
-- bloco_bloqueado, barra_fixa, escada_planos, hero_home, hero_apos_cta,
-- link_direto, pix_recovery, app, outro. Nulo = pedido de antes da medicao.
-- RLS: pedidos_premium ja tem RLS ligado; coluna nova herda.
alter table public.pedidos_premium
  add column if not exists origem_checkout text;

notify pgrst, 'reload schema';
