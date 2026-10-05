-- Cliente recorrente sem e-mail (05/out/2026): identificador PSEUDONIMIZADO do
-- pagador. pagador_hash = HMAC-SHA256(segredo, digitos do CPF/CNPJ de quem
-- pagou o Pix); o CPF/CNPJ e o nome nunca sao gravados. pagador_hash_cartao =
-- fingerprint do cartao na Stripe (id opaco, sem numero).
-- RLS: pedidos_premium ja tem RLS ligado; coluna nova herda.
alter table public.pedidos_premium
  add column if not exists pagador_hash text,
  add column if not exists pagador_hash_cartao text;

create index if not exists pedidos_premium_pagador_hash_idx on public.pedidos_premium (pagador_hash) where pagador_hash is not null;
create index if not exists pedidos_premium_pagador_hash_cartao_idx on public.pedidos_premium (pagador_hash_cartao) where pagador_hash_cartao is not null;

notify pgrst, 'reload schema';
