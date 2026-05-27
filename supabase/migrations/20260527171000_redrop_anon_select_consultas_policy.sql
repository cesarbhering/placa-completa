-- Re-drop "Allow anonymous reads" on public.consultas.
--
-- Original drop landed in 20260527164000, then was rolled back in
-- 20260527170000 because Coolify had SUPABASE_SERVICE_KEY mistakenly
-- set to the anon JWT — so the server actually depended on this
-- policy for /api/consulta dedupe and per-email rate-limit queries.
--
-- That env var has now been corrected to the real service_role key
-- and the container recreated. useSupabaseServer() bypasses RLS
-- properly, the policy is dead weight again, and leaving it open
-- still leaks every consulta row to any client holding the anon key.

DROP POLICY IF EXISTS "Allow anonymous reads" ON public.consultas;
