-- Compra da Consulta Completa feita dentro do app Android (Google Play Billing).
--
-- No app nao existe Pix: quem cobra e a loja. O comprovante que o app manda e
-- o purchaseToken, e ele precisa ser UNIQUE: sem isso, um reenvio (rede caiu,
-- usuario reabriu a tela) viraria um segundo pedido, uma segunda consulta paga
-- no SENATRAN e uma segunda entrega pela mesma compra.
--
-- pix_provider ganha o valor 'google_play' (a coluna ja existe e e texto
-- livre); e por ele que o fluxo de falha sabe NAO pedir estorno pra
-- AbacatePay/Woovi de uma cobranca que nunca passou por elas.
alter table public.pedidos_premium
  add column if not exists google_play_purchase_token text,
  add column if not exists google_play_order_id text,
  add column if not exists google_play_product_id text;

create unique index if not exists pedidos_premium_google_play_token_idx
  on public.pedidos_premium (google_play_purchase_token)
  where google_play_purchase_token is not null;

comment on column public.pedidos_premium.google_play_purchase_token is
  'Comprovante da compra no Google Play. Unique: e a chave de idempotencia da entrega.';
comment on column public.pedidos_premium.google_play_order_id is
  'Pedido correspondente no Play Console (GPA....). E por ele que o estorno manual e feito.';

notify pgrst, 'reload schema';
