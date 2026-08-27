-- ============================================================
-- Lockdown de seguranca: RLS + revoke de funcoes + search_path fixo.
--
-- Contexto: um vazamento critico foi fechado ao vivo (RLS habilitado em prod e
-- staging) porque a anon key publica conseguia ler gcc_api_keys / pedidos_premium
-- e PII. A causa raiz e que varias migrations criaram tabelas SEM habilitar RLS.
-- Esta migration TORNA PERMANENTE o estado aplicado ao vivo, pra que um rebuild
-- futuro do banco (rodando as migrations do zero) nao regrida pro estado aberto.
--
-- Tudo aqui e idempotente: habilitar RLS ja habilitado e no-op; os REVOKE/ALTER
-- de funcao ficam dentro de blocos que ignoram "funcao inexistente". O app usa
-- service_role, que BYPASSA RLS — nada aqui afeta o fluxo do site.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Habilita RLS nas 8 tabelas sensiveis / internas.
--    Sem policy = negado pra anon/authenticated; service_role bypassa.
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.gcc_api_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gcc_consentimentos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.senatran_consultas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.senatran_api_calls  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pedidos_premium     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.placa_cache         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_queries       ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. Revoga EXECUTE das funcoes SECURITY DEFINER de anon/authenticated/public.
--    So o service_role (server) e o cron devem poder chamar. Blocos com
--    tratamento de erro pra rodar mesmo se a funcao ainda nao existir.
-- ------------------------------------------------------------
DO $$
BEGIN
  EXECUTE $q$REVOKE EXECUTE ON FUNCTION public.cleanup_old_consultas(integer) FROM anon, authenticated, public$q$;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'cleanup_old_consultas(integer) inexistente, pulando';
END $$;

DO $$
BEGIN
  EXECUTE $q$REVOKE EXECUTE ON FUNCTION public.extract_leads_from_consultas() FROM anon, authenticated, public$q$;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'extract_leads_from_consultas() inexistente, pulando';
END $$;

DO $$
BEGIN
  EXECUTE $q$REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, text, text, boolean, jsonb) FROM anon, authenticated, public$q$;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'log_audit(...) inexistente, pulando';
END $$;

-- ------------------------------------------------------------
-- 3. Fixa search_path das 2 funcoes com search_path mutavel (advisor do
--    Supabase). Valor `pg_catalog, public` — EXATAMENTE o que foi aplicado ao
--    vivo em prod/staging, pra um db push futuro nao mudar o estado real. As
--    duas nao referenciam tabela por nome, entao qualquer search_path fixo
--    resolve o advisor; mantemos o que ja esta ativo.
-- ------------------------------------------------------------
DO $$
BEGIN
  EXECUTE $q$ALTER FUNCTION public.parse_brl_to_numeric(text) SET search_path = pg_catalog, public$q$;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'parse_brl_to_numeric(text) inexistente, pulando';
END $$;

DO $$
BEGIN
  EXECUTE $q$ALTER FUNCTION public.update_fcm_tokens_updated_at() SET search_path = pg_catalog, public$q$;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'update_fcm_tokens_updated_at() inexistente, pulando';
END $$;

-- Recarrega o schema cache do PostgREST (grants/RLS afetam a visibilidade).
NOTIFY pgrst, 'reload schema';
