-- consultas: close the anonymous INSERT path (19/nov/2026).
--
-- The only policy on consultas let any role, anon included, insert rows that
-- pass a format check on plate, channel and email. Nothing checks the size of
-- api_response, and the anon key is public (runtime config of the site), so
-- anyone could fill the database through PostgREST until the Free plan turns
-- read-only at 500 MB.
--
-- Nobody uses that path any more:
-- - the site inserts consultas from the server with the service role key
--   (server/api/consulta.post.ts via useSupabaseServer, SUPABASE_SERVICE_KEY);
-- - no client code inserts into consultas;
-- - the frozen app container that used another key was retired on 22/sep,
--   and app.placacompleta.com.br is served by the production container;
-- - in the last 24 h of API logs, every request to /rest/v1/consultas came
--   from the server (user agent node, 1,469 POSTs, all 201).
--
-- The service role bypasses RLS, so the site keeps inserting as before.
drop policy if exists "Allow validated anonymous inserts" on public.consultas;
revoke insert, update, delete, truncate on table public.consultas from anon, authenticated;
