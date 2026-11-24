-- pedidos_premium.aviso_app_completo_em (24/nov/2026).
--
-- Report complete e-mail of app purchases (server/utils/aviso-app-completo.ts):
-- its own stamp, at most one per order. It does not share aviso_completo_em
-- with the queue's "report updated" e-mail, so a queue job reset by hand after
-- the "complete" e-mail can still send the "report updated" one. The sweep
-- skips an order with either column filled and writes only this one. The code
-- needs this column: apply it before the deploy.
set local lock_timeout = '3s';

alter table public.pedidos_premium add column if not exists aviso_app_completo_em timestamptz;

comment on column public.pedidos_premium.aviso_app_completo_em is
  'Report complete e-mail of an app purchase went out (one per order). Separate from aviso_completo_em, the queue''s report updated e-mail.';

notify pgrst, 'reload schema';
