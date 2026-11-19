-- Leads extraction becomes incremental (19/nov/2026).
--
-- Why: consultas.api_response (~80 MB, the largest column in the database) is
-- going to be archived to R2 and cleared after 7 days, to keep the Free plan
-- under its 500 MB limit. The only reader of that column is this function:
-- every night it re-read every consulta with an email, detoasted
-- api_response to parse the FIPE value, and rewrote every lead (4.5k updates a
-- day). Once old api_response values are cleared, that full recompute would
-- turn fipe_max/fipe_min/fipe_avg into NULL for every lead.
--
-- Now each run only reads the consultas created since the previous run (the
-- watermark lives in leads_extracao_estado) and merges them into the existing
-- totals. Those rows are at most a day old, so their api_response is still in
-- the database. fipe_n keeps how many FIPE values went into fipe_avg, so the
-- average stays a true running average. consultas_count becomes cumulative.

-- Fail fast instead of queueing behind a long reader of leads.
set local lock_timeout = '5s';

alter table public.leads add column if not exists fipe_n integer not null default 0;

create table if not exists public.leads_extracao_estado (
  id boolean primary key default true check (id),
  processado_ate timestamptz not null
);
alter table public.leads_extracao_estado enable row level security;
revoke all on table public.leads_extracao_estado from anon, authenticated;

-- Last full pass, with the same math as the old function, now also counting
-- the FIPE values per email. Rows newer than 5 minutes are left for the next
-- run: the cut-off keeps clear of inserts that have not committed yet.
-- Only the first time: once the watermark exists, old api_response values may
-- have been cleared by the archive, and a second full pass would null the
-- FIPE stats and reset the cumulative counts. Running this file again is safe.
do $$
declare
  v_ate timestamptz := now() - interval '5 minutes';
begin
  if exists (select 1 from public.leads_extracao_estado) then
    raise notice 'leads_extracao_estado already has a watermark: full pass skipped';
    return;
  end if;

  insert into public.leads (email, first_seen_at)
  select lower(trim(email)), min(created_at)
  from public.consultas
  where created_at <= v_ate
    and email is not null and trim(email) <> ''
  group by 1
  on conflict (email) do nothing;

  update public.leads l set
    consultas_count = s.total,
    fipe_max = s.max_fipe,
    fipe_min = s.min_fipe,
    fipe_avg = s.avg_fipe,
    fipe_n = s.n_fipe
  from (
    select lower(trim(c.email)) as email,
           count(*) as total,
           max(f.v) as max_fipe,
           min(f.v) as min_fipe,
           avg(f.v) as avg_fipe,
           count(f.v) as n_fipe
    from public.consultas c
    cross join lateral (
      select public.parse_brl_to_numeric(c.api_response->'fipe'->'dados'->0->>'texto_valor') as v
    ) f
    where c.created_at <= v_ate
      and c.email is not null and trim(c.email) <> ''
    group by 1
  ) s
  where l.email = s.email
    and (l.consultas_count, l.fipe_max, l.fipe_min, l.fipe_avg, l.fipe_n)
        is distinct from (s.total, s.max_fipe, s.min_fipe, round(s.avg_fipe, 2), s.n_fipe);

  -- Leads whose consultas were deleted by the old 90-day cleanup keep their
  -- last average; count it as one observation so it is not dropped later.
  update public.leads set fipe_n = 1 where fipe_n = 0 and fipe_avg is not null;

  insert into public.leads_extracao_estado (id, processado_ate) values (true, v_ate)
  on conflict (id) do update set processado_ate = excluded.processado_ate;
end $$;

create or replace function public.extract_leads_from_consultas()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_desde timestamptz;
  v_ate timestamptz := now() - interval '5 minutes';
  inserted_count integer;
begin
  -- for update: a concurrent call (cron plus a manual or RPC call) waits here
  -- and then reads the new watermark, so no window is counted twice.
  select processado_ate into v_desde from public.leads_extracao_estado where id for update;
  if v_desde is null then
    raise exception 'leads_extracao_estado has no watermark';
  end if;
  if v_ate <= v_desde then
    return 0;
  end if;

  with novos as (
    insert into public.leads (email, first_seen_at)
    select lower(trim(email)), min(created_at)
    from public.consultas
    where created_at > v_desde and created_at <= v_ate
      and email is not null and trim(email) <> ''
    group by 1
    on conflict (email) do nothing
    returning 1
  )
  select count(*) into inserted_count from novos;

  update public.leads l set
    consultas_count = coalesce(l.consultas_count, 0) + w.total,
    fipe_max = greatest(l.fipe_max, w.max_fipe),
    fipe_min = least(l.fipe_min, w.min_fipe),
    fipe_avg = case
      when l.fipe_n + w.n_fipe > 0
        then (coalesce(l.fipe_avg, 0) * l.fipe_n + coalesce(w.soma_fipe, 0)) / (l.fipe_n + w.n_fipe)
      else l.fipe_avg
    end,
    fipe_n = l.fipe_n + w.n_fipe
  from (
    select lower(trim(c.email)) as email,
           count(*) as total,
           max(f.v) as max_fipe,
           min(f.v) as min_fipe,
           sum(f.v) as soma_fipe,
           count(f.v) as n_fipe
    from public.consultas c
    cross join lateral (
      select public.parse_brl_to_numeric(c.api_response->'fipe'->'dados'->0->>'texto_valor') as v
    ) f
    where c.created_at > v_desde and c.created_at <= v_ate
      and c.email is not null and trim(c.email) <> ''
    group by 1
  ) w
  where l.email = w.email;

  update public.leads_extracao_estado set processado_ate = v_ate where id;
  return inserted_count;
end
$$;

revoke all on function public.extract_leads_from_consultas() from public, anon, authenticated;
grant execute on function public.extract_leads_from_consultas() to service_role;

notify pgrst, 'reload schema';
