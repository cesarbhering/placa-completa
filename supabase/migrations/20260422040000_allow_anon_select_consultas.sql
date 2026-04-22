-- =====================================================
-- TEMPORARY: Allow anon to SELECT consultas
-- =====================================================
-- Needed so the /api/consulta dedupe can check if an
-- email+placa pair was already sent in the last hour.
-- The server uses the anon key (not service_role), so
-- without this policy the SELECT returns 0 rows and
-- dedupe never hits.
--
-- Security note: this exposes all consulta rows to any
-- client holding the anon key. Tighten later by either
-- (a) switching the server to use the service_role key
-- or (b) wrapping the dedupe query in a SECURITY DEFINER
-- function that only returns created_at when given
-- exact email+placa matches.
-- =====================================================

CREATE POLICY "Allow anonymous reads"
  ON public.consultas
  FOR SELECT
  USING (TRUE);
