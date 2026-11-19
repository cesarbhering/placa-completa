-- Daily summaries that stay in the database when raw rows move to R2
-- (19/nov/2026, Supabase Free plan, 500 MB limit).
--
-- The host tool pc-supabase-arquivar archives one day of rows to the private
-- R2 backups bucket, checks the object, calls the summary function of the day
-- and only then deletes the raw rows older than the retention (30 days). The
-- summaries keep what the dashboards, the fin and the funnel analyses read
-- after the raw rows are gone. Raw api_chamadas of the paid sources (wdapi,
-- placafipe) are never deleted: fin_custos_variaveis_diaria reads them.
-- Summary functions never overwrite a day that is already summarized, so a
-- second call after the raw rows were deleted cannot shrink the numbers.

-- 1) api_chamadas: one row per day x source x endpoint x cache hit x code.
create table if not exists public.api_chamadas_diario (
  dia date not null,
  fonte text not null,
  endpoint text not null,
  cache_hit boolean not null,
  code integer not null, -- 0 when the call had no HTTP code
  chamadas integer not null,
  ms_total bigint not null,
  ms_max integer not null,
  primary key (dia, fonte, endpoint, cache_hit, code)
);
alter table public.api_chamadas_diario enable row level security;
revoke all on table public.api_chamadas_diario from anon, authenticated;

create or replace function public.api_chamadas_resumir(p_dia date)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  n integer;
begin
  if exists (select 1 from public.api_chamadas_diario where dia = p_dia) then
    return 0;
  end if;
  insert into public.api_chamadas_diario (dia, fonte, endpoint, cache_hit, code, chamadas, ms_total, ms_max)
  select p_dia, fonte, coalesce(endpoint, ''), coalesce(cache_hit, false), coalesce(code, 0),
         count(*), coalesce(sum(ms), 0), coalesce(max(ms), 0)
  from public.api_chamadas
  where criado_em >= (p_dia::timestamp at time zone 'America/Sao_Paulo')
    and criado_em < ((p_dia + 1)::timestamp at time zone 'America/Sao_Paulo')
  group by 2, 3, 4, 5;
  get diagnostics n = row_count;
  return n;
end
$$;
revoke all on function public.api_chamadas_resumir(date) from public, anon, authenticated;

-- 2) eventos_funil: a generic daily count, plus the funil_diario rows of the
--    day, so the funnel view keeps its full history.
create table if not exists public.eventos_funil_diario (
  dia date not null,
  evento text not null,
  canal text not null,
  dispositivo text not null,
  sistema text not null,
  origem text not null,
  eventos integer not null,
  sessoes integer not null,
  placas integer not null,
  primary key (dia, evento, canal, dispositivo, sistema, origem)
);
alter table public.eventos_funil_diario enable row level security;
revoke all on table public.eventos_funil_diario from anon, authenticated;

create table if not exists public.funil_diario_arquivo (
  dia date not null,
  origem text not null,
  canal text not null,
  leilao_sinal text not null,
  ab_bloco text not null,
  fase text not null,
  resultado_exibido bigint not null,
  leilao_sinal_visto bigint not null,
  cta_visto bigint not null,
  cta_click bigint not null,
  checkout_open bigint not null,
  confirm_visto bigint not null,
  email_informado bigint not null,
  pix_gerado bigint not null,
  fechou_sem_pagar bigint not null,
  primary key (dia, origem, canal, leilao_sinal, ab_bloco, fase)
);
alter table public.funil_diario_arquivo enable row level security;
revoke all on table public.funil_diario_arquivo from anon, authenticated;

create or replace function public.eventos_funil_resumir(p_dia date)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ini timestamptz := p_dia::timestamp at time zone 'America/Sao_Paulo';
  v_fim timestamptz := (p_dia + 1)::timestamp at time zone 'America/Sao_Paulo';
  n integer;
begin
  if exists (select 1 from public.eventos_funil_diario where dia = p_dia)
     or exists (select 1 from public.funil_diario_arquivo where dia = p_dia) then
    return 0;
  end if;

  insert into public.eventos_funil_diario (dia, evento, canal, dispositivo, sistema, origem, eventos, sessoes, placas)
  select p_dia, e.evento, coalesce(nullif(e.canal, ''), 'sem_canal'), coalesce(e.dispositivo, ''), coalesce(e.sistema, ''),
         case
           when coalesce(e.origem->>'msclkid', '') <> '' or lower(coalesce(e.origem->>'utm_source', '')) in ('bing', 'microsoft') then 'bing'
           when coalesce(e.origem->>'gclid', '') <> '' or lower(coalesce(e.origem->>'utm_source', '')) = 'google' then 'google'
           when coalesce(e.origem->>'utm_source', '') = '' then 'organico'
           else 'outros'
         end,
         count(*), count(distinct e.sessao), count(distinct e.placa)
  from public.eventos_funil e
  where e.criado_em >= v_ini and e.criado_em < v_fim
  group by 2, 3, 4, 5, 6;
  get diagnostics n = row_count;

  -- Same grouping and counts as the live part of funil_diario below.
  insert into public.funil_diario_arquivo
  select p_dia,
    case
      when coalesce(e.origem->>'msclkid', '') <> '' or lower(coalesce(e.origem->>'utm_source', '')) in ('bing', 'microsoft') then 'bing'
      when coalesce(e.origem->>'gclid', '') <> '' or lower(coalesce(e.origem->>'utm_source', '')) = 'google' then 'google'
      when coalesce(e.origem->>'utm_source', '') = '' then 'organico'
      else 'outros'
    end,
    coalesce(nullif(e.canal, ''), 'sem_canal'),
    coalesce(e.leilao_sinal, 'sem_sinal'),
    coalesce(nullif(e.extra->>'ab_bloco', ''), 'sem_ab'),
    case
      when e.extra->>'ab_rodada' = '3' then 'rodada3'
      when e.criado_em >= timestamptz '2026-09-25T19:37:40Z' then 'layout_a'
      else 'pre_layout_a'
    end,
    count(distinct e.sessao) filter (where e.evento = 'resultado_exibido'),
    count(distinct e.sessao) filter (where e.evento = 'leilao_sinal_visto'),
    count(distinct e.sessao) filter (where e.evento = 'cta_completa_visto'),
    count(distinct e.sessao) filter (where e.evento = 'cta_completa_click'),
    count(distinct e.sessao) filter (where e.evento = 'premium_checkout_open'),
    count(distinct e.sessao) filter (where e.evento = 'checkout_confirm_visto'),
    count(distinct e.sessao) filter (where e.evento = 'email_informado'),
    count(distinct e.sessao) filter (where e.evento = 'pix_gerado'),
    count(distinct e.sessao) filter (where e.evento = 'checkout_fechado_sem_pagar')
  from public.eventos_funil e
  where e.criado_em >= v_ini and e.criado_em < v_fim
  group by 1, 2, 3, 4, 5, 6;

  return n;
end
$$;
revoke all on function public.eventos_funil_resumir(date) from public, anon, authenticated;

-- funil_diario: archived days come from funil_diario_arquivo, the other days
-- are computed from eventos_funil exactly as before.
drop view if exists public.funil_diario;

create view public.funil_diario as
select a.dia, a.origem, a.canal, a.leilao_sinal, a.ab_bloco, a.fase,
       a.resultado_exibido, a.leilao_sinal_visto, a.cta_visto, a.cta_click, a.checkout_open,
       a.confirm_visto, a.email_informado, a.pix_gerado, a.fechou_sem_pagar
from public.funil_diario_arquivo a
union all
select
  (e.criado_em at time zone 'America/Sao_Paulo')::date as dia,
  case
    when coalesce(e.origem->>'msclkid', '') <> '' or lower(coalesce(e.origem->>'utm_source', '')) in ('bing', 'microsoft') then 'bing'
    when coalesce(e.origem->>'gclid', '') <> '' or lower(coalesce(e.origem->>'utm_source', '')) = 'google' then 'google'
    when coalesce(e.origem->>'utm_source', '') = '' then 'organico'
    else 'outros'
  end as origem,
  coalesce(nullif(e.canal, ''), 'sem_canal') as canal,
  coalesce(e.leilao_sinal, 'sem_sinal') as leilao_sinal,
  coalesce(nullif(e.extra->>'ab_bloco', ''), 'sem_ab') as ab_bloco,
  case
    when e.extra->>'ab_rodada' = '3' then 'rodada3'
    when e.criado_em >= timestamptz '2026-09-25T19:37:40Z' then 'layout_a'
    else 'pre_layout_a'
  end as fase,
  count(distinct e.sessao) filter (where e.evento = 'resultado_exibido') as resultado_exibido,
  count(distinct e.sessao) filter (where e.evento = 'leilao_sinal_visto') as leilao_sinal_visto,
  count(distinct e.sessao) filter (where e.evento = 'cta_completa_visto') as cta_visto,
  count(distinct e.sessao) filter (where e.evento = 'cta_completa_click') as cta_click,
  count(distinct e.sessao) filter (where e.evento = 'premium_checkout_open') as checkout_open,
  count(distinct e.sessao) filter (where e.evento = 'checkout_confirm_visto') as confirm_visto,
  count(distinct e.sessao) filter (where e.evento = 'email_informado') as email_informado,
  count(distinct e.sessao) filter (where e.evento = 'pix_gerado') as pix_gerado,
  count(distinct e.sessao) filter (where e.evento = 'checkout_fechado_sem_pagar') as fechou_sem_pagar
from public.eventos_funil e
where not exists (
  select 1 from public.funil_diario_arquivo a
  where a.dia = (e.criado_em at time zone 'America/Sao_Paulo')::date
)
group by 1, 2, 3, 4, 5, 6;

comment on view public.funil_diario is 'Uma linha por dia BRT x origem x canal (app/web) x sinal de leilao x variante A/B x fase, com sessoes distintas em cada etapa do funil. Dias arquivados no R2 vem de funil_diario_arquivo; os outros sao calculados de eventos_funil.';

-- Recreating the view resets its options: keep security_invoker from the RLS
-- audit of 30/set, otherwise the view runs as definer again.
alter view public.funil_diario set (security_invoker = on);

-- 3) fonte_cache_limpar() no longer deletes api_chamadas: raw rows now leave
--    only through pc-supabase-arquivar, after the archive and the summary.
create or replace function public.fonte_cache_limpar() returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c int;
begin
  delete from public.fonte_cache where expira_em < now();
  get diagnostics c = row_count;
  return jsonb_build_object('cache_removido', c, 'log_removido', 0);
end
$$;
revoke all on function public.fonte_cache_limpar() from public, anon, authenticated;

notify pgrst, 'reload schema';
