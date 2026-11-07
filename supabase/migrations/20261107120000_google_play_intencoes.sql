-- Intencao de compra no app (Google Play), gravada ANTES do pagamento (07/nov/2026).
--
-- O e-mail do comprador so chegava ao servidor depois de pagar (/api/premium/google-play/verificar). Se o
-- app morria logo apos o pagamento, a RTDN criava o pedido sem e-mail. Agora o checkout do app grava placa e
-- e-mail aqui (/api/premium/google-play/intencao) e manda o id como obfuscatedExternalAccountId da compra;
-- o servidor recupera placa e e-mail por esse id em qualquer caminho (app, RTDN, job).
create table if not exists public.google_play_intencoes (
  -- id opaco (gpi_ + aleatorio), cabe nos 64 caracteres do obfuscatedExternalAccountId
  id         text primary key check (length(id) between 1 and 64),
  placa      text not null check (length(placa) = 7),
  email      text not null check (length(email) between 3 and 200),
  criado_em  timestamptz not null default now(),
  -- quando virou pedido
  usado_em   timestamptz
);

create index if not exists google_play_intencoes_criado_idx on public.google_play_intencoes (criado_em);

-- regra da auditoria RLS de 30/set: toda tabela nova com RLS; sem policy = so service_role acessa
alter table public.google_play_intencoes enable row level security;

comment on table public.google_play_intencoes is
  'Placa e e-mail que o app gravou antes de abrir a folha da Play. O id vai como obfuscatedExternalAccountId e e lido na criacao do pedido (app, RTDN, job).';

notify pgrst, 'reload schema';
