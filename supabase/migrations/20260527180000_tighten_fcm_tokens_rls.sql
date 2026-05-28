-- Tighten RLS on public.fcm_tokens.
--
-- Prior state had three problems:
-- 1. "Users can read own tokens" USING (user_email = user_email) is a
--    tautology — column compared to itself is always TRUE. Any client
--    with the anon key could SELECT every FCM token + associated email.
-- 2. "Users can update own tokens" had the same tautology in USING and
--    WITH CHECK — any client could overwrite any row.
-- 3. "Allow anonymous token registration" allowed INSERT with CHECK
--    (true), bypassing the format validation enforced by the parallel
--    "Users can insert own tokens" policy. (PostgreSQL applies the
--    permissive INSERT policies with OR — the weakest wins.)
--
-- Server-side code uses SUPABASE_SERVICE_KEY (real service_role, fixed
-- 2026-05-27) which bypasses RLS, so these client-facing read/update
-- paths are unnecessary. Drop them entirely; what remains:
--   - "Users can insert own tokens" (INSERT, with email format CHECK)
-- which is what the /api/fcm-token/save endpoint relies on.

DROP POLICY IF EXISTS "Users can read own tokens"          ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can update own tokens"        ON public.fcm_tokens;
DROP POLICY IF EXISTS "Allow anonymous token registration" ON public.fcm_tokens;
