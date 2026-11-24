-- funil_diario: same grants as the other public views (24/nov/2026).
--
-- funil_diario was the only view in public that still granted anon and
-- authenticated every privilege (the schema default privileges at creation,
-- kept when #779 recreated it). It is security_invoker and the tables under it
-- have RLS with no policy for those roles, so nothing leaked, but the other ten
-- views grant only postgres and service_role. Nothing in the site or the app
-- reads it with a client key: the dashboards and the A/B reports read it from
-- the host as postgres.

-- Give up after 3 s instead of queueing readers behind the lock.
set local lock_timeout = '3s';

revoke all on table public.funil_diario from anon, authenticated;

notify pgrst, 'reload schema';
