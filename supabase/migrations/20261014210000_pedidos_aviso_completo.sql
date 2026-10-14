-- Relatorio 2.0 (item 7): o pedido que fechou a fila premium_jobs com dado
-- novo recebe UM e-mail ao cliente; esta coluna marca o envio (idempotencia).
alter table public.pedidos_premium
  add column if not exists aviso_completo_em timestamptz;

notify pgrst, 'reload schema';
