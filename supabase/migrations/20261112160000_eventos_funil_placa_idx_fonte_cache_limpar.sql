-- Performance audit (12/nov/2026).
--
-- 1) aviso-venda looks up the last funnel event of a plate before the payment
--    (leilao_sinal, recall_sinal, extra->ab_bloco). It used `placa ilike`,
--    which no index serves: ~1.2 s per lookup, 3 per sale, walking the
--    criado_em index. Every writer stores the plate upper-cased and stripped
--    (shared/eventos-funil.ts), so the query now uses eq on the normalized
--    plate and this index answers it. PostgREST cannot filter on lower(placa),
--    hence a plain column index instead of an expression index.
create index if not exists eventos_funil_placa_criado_em_idx
  on public.eventos_funil (placa, criado_em desc)
  where placa is not null;

-- 2) fonte_cache: the only reader (server/utils/fonte-cache.ts) ignores
--    expired rows, so the 7-day grace before deleting them kept dead rows
--    (11 MB of fipe_historico) for nothing. Delete as soon as they expire.
create or replace function public.fonte_cache_limpar() returns jsonb language plpgsql security definer set search_path = public as $$
declare c int; l int;
begin
  delete from public.fonte_cache where expira_em < now(); get diagnostics c = row_count;
  delete from public.api_chamadas where criado_em < now() - interval '90 days'; get diagnostics l = row_count;
  return jsonb_build_object('cache_removido', c, 'log_removido', l);
end $$;
revoke all on function public.fonte_cache_limpar() from public, anon, authenticated;
