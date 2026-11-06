-- Acompanhamento de avaliacao no Google (05/nov/2026): cada cliente recebe UM
-- e-mail na vida, por e-mail normalizado (trim + lower). A chave primaria e a
-- trava: quem insere e quem envia. So o service role escreve/le.
create table if not exists public.avaliacao_google_envios (
  email_norm text primary key,
  pedido_id uuid references public.pedidos_premium (id) on delete set null,
  enviado_em timestamptz not null default now()
);

alter table public.avaliacao_google_envios enable row level security;

notify pgrst, 'reload schema';
