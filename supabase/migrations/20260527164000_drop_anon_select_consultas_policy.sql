-- Drop the temporary "Allow anonymous reads" policy on public.consultas.
--
-- Originally added in 20260422040000 to support an /api/consulta dedupe
-- query that ran with the anon key. The server now uses
-- SUPABASE_SERVICE_KEY via useSupabaseServer(), which bypasses RLS — so
-- this policy is dead code that only exposes PII (email, placa,
-- ip_address, user_agent, api_response with chassi) to any client
-- holding the public anon key.

DROP POLICY IF EXISTS "Allow anonymous reads" ON public.consultas;
