-- ===========================================
-- 1. Criar tabela leads
-- ===========================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  source TEXT DEFAULT 'consulta',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_created_at ON public.leads (created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 2. Habilitar pg_cron
-- ===========================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- ===========================================
-- 3. Função para extrair leads de consultas
-- ===========================================
CREATE OR REPLACE FUNCTION extract_leads_from_consultas()
RETURNS INTEGER AS $$
DECLARE
  last_run TIMESTAMPTZ;
  inserted_count INTEGER;
BEGIN
  SELECT MAX(created_at) INTO last_run FROM public.leads;

  IF last_run IS NULL THEN
    last_run := '1970-01-01'::timestamptz;
  END IF;

  WITH new_leads AS (
    INSERT INTO public.leads (email, first_seen_at)
    SELECT DISTINCT ON (LOWER(TRIM(email)))
      LOWER(TRIM(email)),
      MIN(created_at)
    FROM public.consultas
    WHERE created_at > last_run
      AND email IS NOT NULL
      AND TRIM(email) != ''
    GROUP BY LOWER(TRIM(email))
    ON CONFLICT (email) DO NOTHING
    RETURNING *
  )
  SELECT COUNT(*) INTO inserted_count FROM new_leads;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 4. Agendar cron job (22h BRT = 01:00 UTC)
-- ===========================================
SELECT cron.schedule(
  'extract-leads-daily',
  '0 1 * * *',
  $$SELECT extract_leads_from_consultas()$$
);
