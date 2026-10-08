-- Aviso de venda ao Cesar na hora da entrega (08/out/2026). Quem enviar
-- primeiro (servidor, server/utils/aviso-venda.ts, ou o timer do host
-- pc-venda-origem, que virou rede de seguranca) marca a hora aqui; o outro
-- pula. RLS: pedidos_premium ja tem RLS ligado; coluna nova herda.
alter table public.pedidos_premium
  add column if not exists aviso_venda_em timestamptz;

notify pgrst, 'reload schema';
