-- Close the anonymous INSERT paths on consultas and fcm_tokens (19/nov/2026).
--
-- Each table had one policy that let any role, anon included, insert rows
-- that pass a format check. Nothing limits the size of the free text and
-- jsonb columns (consultas.api_response; fcm_tokens.token, user_agent,
-- device_info), and the anon key is public (runtime config of the site), so
-- anyone could fill the database through PostgREST until the Free plan turns
-- read-only at 500 MB.
--
-- Nobody uses those paths any more:
-- - the site writes both tables from the server with the service role key
--   (useSupabaseServer: server/api/consulta.post.ts and
--   server/api/fcm-token/save.post.ts); the client only calls those endpoints;
-- - the frozen app container that used another key was retired on 22/sep,
--   and app.placacompleta.com.br is served by the production container;
-- - in the last 24 h of API logs, every request to /rest/v1/consultas came
--   from the server (user agent node, 1,469 POSTs, all 201).
--
-- The service role bypasses RLS and keeps its grants, so the site keeps
-- writing as before. RLS has no SELECT policy for anon or authenticated on
-- either table, so revoking everything only turns an empty answer into a
-- permission error for direct REST calls.

-- Give up after 3 s instead of queueing reads and inserts behind the lock.
set local lock_timeout = '3s';

drop policy if exists "Allow validated anonymous inserts" on public.consultas;
revoke all on table public.consultas from anon, authenticated;

drop policy if exists "Users can insert own tokens" on public.fcm_tokens;
revoke all on table public.fcm_tokens from anon, authenticated;

notify pgrst, 'reload schema';
