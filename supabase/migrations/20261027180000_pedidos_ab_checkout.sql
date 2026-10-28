-- Teste A/B da tela de confirmacao do checkout (27/out/2026, shared/ab-checkout.ts).
-- 'A' = confirmacao de hoje; 'B' = confirmacao enxuta. Null = pedido do app
-- (sempre A, fora do teste) ou anterior ao teste. Nos eventos do funil a
-- variante vai em eventos_funil.extra->>'ab_checkout' (sem coluna nova).
-- RLS: pedidos_premium ja tem RLS ligado; coluna nova herda.
alter table public.pedidos_premium
  add column if not exists ab_checkout text
    check (ab_checkout is null or ab_checkout in ('A', 'B'));

notify pgrst, 'reload schema';
