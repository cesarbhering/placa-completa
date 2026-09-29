-- Cartao via Stripe (forma de pagamento SECUNDARIA; Pix segue principal).
-- pedidos_premium ganha:
--   forma_pagamento: 'pix' (default, preserva o que ja existe) | 'cartao'
--   stripe_session_id: id da Checkout Session hospedada do Stripe (analogo ao
--     abacatepay_id do Pix), usado pra casar o webhook/return com o pedido.
alter table public.pedidos_premium
  add column if not exists forma_pagamento text not null default 'pix',
  add column if not exists stripe_session_id text;

comment on column public.pedidos_premium.forma_pagamento is
  'pix (default) | cartao. Pix continua principal; cartao (Stripe) e secundario.';
comment on column public.pedidos_premium.stripe_session_id is
  'ID da Stripe Checkout Session (cartao). Casa o webhook/return com o pedido.';

create index if not exists idx_pedidos_stripe_session
  on public.pedidos_premium (stripe_session_id)
  where stripe_session_id is not null;

-- PGRST: recarrega o schema cache pro PostgREST enxergar as colunas novas.
notify pgrst, 'reload schema';
