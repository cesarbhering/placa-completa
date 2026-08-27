-- v2.0 Consulta Premium (homologacao). Pedidos pagos via Pix (AbacatePay) que
-- disparam a consulta SENATRAN apos pagamento confirmado. Vive no Supabase de
-- homologacao; prod nao e tocado nesta fase.

create table if not exists public.pedidos_premium (
  id uuid primary key default gen_random_uuid(),
  token_entrega text not null unique,        -- token da URL do relatorio (nao adivinhavel)
  placa text not null,
  placa_confirmada boolean not null default false,
  email text,                                -- entrega duravel
  telefone text,                             -- coleta p/ WhatsApp futuro (nao usado ainda)
  status text not null default 'aguardando_pagamento',
  -- aguardando_pagamento | pago | consultando | entregue | falha | expirado | reembolsado
  valor_centavos integer not null,
  abacatepay_id text,                        -- pix_char_...
  br_code text,                              -- copia-e-cola
  expira_em timestamptz,
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  entregue_em timestamptz,
  consulta_id uuid references public.senatran_consultas (id),
  preview jsonb,                             -- id basico gratis (marca/modelo/ano) mostrado no confirm
  erro text
);
create index if not exists pedidos_premium_status_idx on public.pedidos_premium (status);
create index if not exists pedidos_premium_abacatepay_idx on public.pedidos_premium (abacatepay_id);

-- log dos webhooks recebidos, pra idempotencia e auditoria
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'abacatepay',
  event text,
  abacatepay_id text,
  payload jsonb,
  processado boolean not null default false,
  recebido_em timestamptz not null default now()
);
create index if not exists webhook_events_abacatepay_idx on public.webhook_events (abacatepay_id);
