-- Aviso ao cliente quando chegam as fotos do leilao num relatorio ja entregue
-- (Cesar, 18/out/2026): no maximo UM e-mail por pedido. O job marca esta
-- coluna ANTES de enviar (update condicionado a ela ser nula).
alter table public.pedidos_premium add column if not exists aviso_fotos_em timestamptz;

notify pgrst, 'reload schema';
