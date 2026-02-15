-- =====================================================
-- FIX: Allow email_sent to be TRUE or FALSE on inserts
-- =====================================================
-- The previous RLS policy was blocking inserts from web
-- version because it required email_sent = FALSE.
-- This migration removes that restriction.
-- =====================================================

DROP POLICY IF EXISTS "Allow validated anonymous inserts" ON public.consultas;

CREATE POLICY "Allow validated anonymous inserts" ON public.consultas
  FOR INSERT
  WITH CHECK (
    -- Email must be present and valid format
    email IS NOT NULL AND
    email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' AND
    LENGTH(email) <= 254 AND
    -- Plate must be present and valid format (ABC1234 or ABC1D23)
    placa IS NOT NULL AND
    placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'
    -- Removed email_sent = FALSE restriction
  );
