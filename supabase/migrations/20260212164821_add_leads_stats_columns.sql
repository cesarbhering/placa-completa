-- ===========================================
-- 1. Adicionar colunas de estatísticas na leads
-- ===========================================
ALTER TABLE public.leads
  ADD COLUMN consultas_count INTEGER DEFAULT 0,
  ADD COLUMN fipe_max NUMERIC(12,2),
  ADD COLUMN fipe_min NUMERIC(12,2),
  ADD COLUMN fipe_avg NUMERIC(12,2);

-- ===========================================
-- 2. Função auxiliar: converter "R$ 45.000,00" para numeric
-- ===========================================
CREATE OR REPLACE FUNCTION parse_brl_to_numeric(val TEXT)
RETURNS NUMERIC AS $$
BEGIN
  RETURN REPLACE(REPLACE(REPLACE(val, 'R$', ''), '.', ''), ',', '.')::NUMERIC;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ===========================================
-- 3. Substituir função de extração com stats
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

  -- Inserir novos leads
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

  -- Atualizar stats de TODOS os leads (novos e existentes)
  UPDATE public.leads l
  SET
    consultas_count = stats.total,
    fipe_max = stats.max_fipe,
    fipe_min = stats.min_fipe,
    fipe_avg = stats.avg_fipe
  FROM (
    SELECT
      LOWER(TRIM(c.email)) AS email,
      COUNT(*) AS total,
      MAX(parse_brl_to_numeric(c.api_response->'fipe'->'dados'->0->>'texto_valor')) AS max_fipe,
      MIN(parse_brl_to_numeric(c.api_response->'fipe'->'dados'->0->>'texto_valor')) AS min_fipe,
      AVG(parse_brl_to_numeric(c.api_response->'fipe'->'dados'->0->>'texto_valor')) AS avg_fipe
    FROM public.consultas c
    WHERE c.email IS NOT NULL AND TRIM(c.email) != ''
    GROUP BY LOWER(TRIM(c.email))
  ) stats
  WHERE l.email = stats.email;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 4. Popular stats dos leads existentes agora
-- ===========================================
SELECT extract_leads_from_consultas();
