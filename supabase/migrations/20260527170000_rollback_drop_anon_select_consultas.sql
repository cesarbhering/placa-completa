-- EMERGENCY ROLLBACK of 20260527164000_drop_anon_select_consultas_policy.sql.
--
-- The drop was correct in spirit (server should use service_role and
-- bypass RLS), BUT investigation revealed SUPABASE_SERVICE_KEY in
-- Coolify was mistakenly set to the anon JWT (identical to
-- SUPABASE_ANON_KEY). The server therefore had only anon privileges
-- and silently relied on the "Allow anonymous reads" policy for
-- /api/consulta dedupe and rate-limit count queries. Dropping it
-- broke both.
--
-- Re-creating the policy temporarily to restore production. To be
-- dropped again after Coolify is reconfigured with the real
-- service_role key.

CREATE POLICY "Allow anonymous reads"
  ON public.consultas
  FOR SELECT
  USING (TRUE);
