-- Pin search_path on SECURITY DEFINER functions to prevent privilege
-- escalation via object shadowing in schemas under the caller's control.
--
-- Without an explicit SET search_path, a SECURITY DEFINER function
-- executes with the owner's privileges but resolves unqualified names
-- through the caller's search_path — so any role that can CREATE in
-- any schema reachable from the search_path can shadow a referenced
-- function/operator and run code as the function's owner. Pinning to
-- (pg_catalog, public) closes that path. (Supabase Database Linter
-- rule "function_search_path_mutable".)

ALTER FUNCTION public.extract_leads_from_consultas()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.cleanup_old_consultas(integer)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.log_audit(text, text, text, text, boolean, jsonb)
  SET search_path = pg_catalog, public;
