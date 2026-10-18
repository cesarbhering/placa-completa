-- Comprovante de toda compra do app (Google Play), com ou sem pedido (Cesar, 18/out/2026).
--
-- Antes, o /api/premium/google-play/verificar so gravava algo quando a compra virava pedido. Compra recusada
-- (consumida no celular, Pix da Play ainda pendente) nao deixava rastro: o servidor nunca soube de BAN0G13
-- (17/out) nem de BCY3E00 (18/out). Agora toda chamada grava ou atualiza a linha aqui, o job do servidor
-- (server/utils/google-play-compras.ts, a cada 2 min) conclui as que ficaram sem pedido, e as notificacoes
-- da Play (RTDN, /api/premium/google-play/rtdn) registram ate compra cujo app nunca chamou o servidor.
create table if not exists public.google_play_compras (
  id                        uuid primary key default gen_random_uuid(),
  purchase_token            text not null unique check (length(purchase_token) between 1 and 1000),
  order_id                  text,
  product_id                text,
  placa                     text,
  email                     text,
  -- pago | pendente | cancelada | nao_encontrada | indisponivel | sem_estado (o que a Google disse por ultimo)
  estado_google             text,
  -- por que ainda nao virou pedido (ou por que desistimos)
  motivo                    text,
  -- purchaseType 0: compra de teste da Play
  teste                     boolean,
  -- preco cobrado pela Play (orders.get) e o liquido depois da taxa
  valor_centavos            integer,
  liquido_centavos          integer,
  -- app | rtdn | job: quem registrou primeiro
  origem                    text,
  -- o resto do que o app mandou (preview, origin, origem_checkout, ambiente) pra criar o pedido depois
  dados_app                 jsonb,
  pedido_id                 uuid references public.pedidos_premium(id) on delete set null,
  tentativas                integer not null default 0,
  -- alerta "compra sem pedido em 10 min" ja mandado
  alerta_em                 timestamptz,
  -- o job parou de tentar (72 h, cancelada, token inexistente); o /verificar ainda conclui se o app voltar
  desistiu_em               timestamptz,
  recebido_em               timestamptz not null default now(),
  atualizado_em             timestamptz not null default now()
);

create index if not exists google_play_compras_abertas_idx
  on public.google_play_compras (recebido_em)
  where pedido_id is null and desistiu_em is null;
create index if not exists google_play_compras_order_idx on public.google_play_compras (order_id);

-- regra da auditoria RLS de 30/set: toda tabela nova com RLS; sem policy = so service_role acessa
alter table public.google_play_compras enable row level security;

comment on table public.google_play_compras is
  'Toda compra do app (Google Play) que chegou ao servidor (app, RTDN), com ou sem pedido. Fonte do job que conclui compras pendentes e do alerta de compra sem pedido.';

notify pgrst, 'reload schema';
