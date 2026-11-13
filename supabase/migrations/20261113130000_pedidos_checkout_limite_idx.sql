-- Checkout limits (server/utils/checkout-limite.ts): the per-plate count of
-- unpaid orders in the last 60 minutes filters by (placa, criado_em), and the
-- card circuit breaker counts card orders in the last 10 minutes. These two
-- indexes keep both counts cheap as the table grows. The code works without
-- them (it fails open on a slow count), so they can be applied at any time.
create index if not exists pedidos_premium_placa_criado_idx on public.pedidos_premium (placa, criado_em desc);
create index if not exists pedidos_premium_cartao_criado_idx on public.pedidos_premium (criado_em desc) where forma_pagamento = 'cartao';
