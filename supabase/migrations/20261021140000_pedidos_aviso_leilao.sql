-- Aviso ao cliente de leilao/sinistro que apareceu depois da entrega (Cesar, 21/out/2026):
-- no maximo um e-mail por pedido (server/utils/aviso-leilao.ts).
alter table public.pedidos_premium add column if not exists aviso_leilao_em timestamptz;
notify pgrst, 'reload schema';
