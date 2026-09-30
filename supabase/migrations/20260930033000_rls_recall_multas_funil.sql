-- Versiona o fix do advisor do Supabase (30/set), ja aplicado a mao em prod e
-- staging via Management API: recall_consultas e multas_consultas estavam SEM
-- RLS (anon tinha SELECT) e a view funil_diario era SECURITY DEFINER. Tudo
-- idempotente: rodar de novo nao muda nada.
--
-- Regra daqui pra frente: toda create table em public nasce com
-- `enable row level security` (sem policy = so service role) e toda create view
-- com `with (security_invoker = on)`.

alter table if exists public.recall_consultas enable row level security;
alter table if exists public.multas_consultas enable row level security;

do $$
begin
  if to_regclass('public.recall_consultas') is not null then
    revoke all on public.recall_consultas from anon, authenticated;
  end if;
  if to_regclass('public.multas_consultas') is not null then
    revoke all on public.multas_consultas from anon, authenticated;
  end if;
  if to_regclass('public.funil_diario') is not null then
    alter view public.funil_diario set (security_invoker = on);
    revoke all on public.funil_diario from anon, authenticated;
  end if;
end
$$;

notify pgrst, 'reload schema';
