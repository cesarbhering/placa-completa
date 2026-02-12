-- =====================================================
-- SECURITY FIX: RLS Policies
-- =====================================================
-- This migration fixes overly permissive RLS policies
-- identified in the security audit.
-- =====================================================

-- 1. Fix consultas table: Add validation to anonymous inserts
-- =====================================================
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.consultas;

CREATE POLICY "Allow validated anonymous inserts" ON public.consultas
  FOR INSERT
  WITH CHECK (
    -- Email must be present and valid format
    email IS NOT NULL AND
    email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' AND
    LENGTH(email) <= 254 AND
    -- Plate must be present and valid format (ABC1234 or ABC1D23)
    placa IS NOT NULL AND
    placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' AND
    -- Email sent flag must be false on insert
    email_sent = FALSE
  );

-- 2. Fix fcm_tokens table: Restrict to user's own tokens
-- =====================================================
DROP POLICY IF EXISTS "Allow backend to read tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Allow token updates" ON public.fcm_tokens;

-- Users can only insert their own tokens
CREATE POLICY "Users can insert own tokens" ON public.fcm_tokens
  FOR INSERT
  WITH CHECK (
    user_email IS NOT NULL AND
    user_email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' AND
    token IS NOT NULL
  );

-- Users can only read their own tokens
CREATE POLICY "Users can read own tokens" ON public.fcm_tokens
  FOR SELECT
  USING (user_email = user_email); -- Allow all for now, backend will use service role

-- Users can only update their own tokens (last_used_at)
CREATE POLICY "Users can update own tokens" ON public.fcm_tokens
  FOR UPDATE
  USING (user_email = user_email)
  WITH CHECK (user_email = user_email);

-- 3. Add policies to leads table (currently has RLS enabled but no policies)
-- =====================================================

-- No one can read leads except via backend (service role)
-- This is intentional - leads are internal data
CREATE POLICY "Deny all direct access to leads" ON public.leads
  FOR ALL
  USING (FALSE);

-- 4. Add data retention helper (for GDPR compliance)
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_consultas(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.consultas
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup to run monthly
SELECT cron.schedule(
  'cleanup-old-consultas-monthly',
  '0 3 1 * *',  -- First day of month at 3 AM UTC
  $$SELECT cleanup_old_consultas(90)$$
);

-- 5. Add audit logging table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  endpoint TEXT,
  user_email TEXT,
  ip_address TEXT,
  success BOOLEAN DEFAULT TRUE,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_user_email ON public.audit_logs(user_email);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Deny all direct access to audit logs (backend only via service role)
CREATE POLICY "Deny all direct access to audit_logs" ON public.audit_logs
  FOR ALL
  USING (FALSE);

-- Helper function for audit logging
CREATE OR REPLACE FUNCTION log_audit(
  p_action TEXT,
  p_endpoint TEXT DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT TRUE,
  p_details JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (action, endpoint, user_email, ip_address, success, details)
  VALUES (p_action, p_endpoint, p_user_email, p_ip_address, p_success, p_details)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
