-- Escada de planos na consulta premium: alem da completa (R$45), passa a
-- existir a basica (R$19,90), que entrega so a ficha cadastral do SENATRAN.
-- O gate de campos e feito na API (shared/planos.ts, whitelist); esta coluna
-- e quem diz por qual nivel o cliente pagou.

alter table public.pedidos_premium
  add column if not exists plano text not null default 'completa';

-- pedidos antigos sao todos completa (unico plano que existia)
update public.pedidos_premium set plano = 'completa' where plano is null;

alter table public.pedidos_premium
  drop constraint if exists pedidos_premium_plano_check;
alter table public.pedidos_premium
  add constraint pedidos_premium_plano_check check (plano in ('basica', 'completa'));

create index if not exists pedidos_premium_plano_idx on public.pedidos_premium (plano);

comment on column public.pedidos_premium.plano is
  'basica | completa. Define o filtro de campos aplicado em /api/premium/report.';
