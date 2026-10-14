-- Relatorio 2.0 (Cesar 14/out/2026): o relatorio espera ate 5 min pelas fontes lentas e entrega tudo junto;
-- o que nao chegou vira job aqui e completa depois, com UM e-mail ao cliente quando o pedido fecha.
-- Worker: timer systemd no host (pc-premium-jobs.timer, 1 min) chama POST /api/premium/jobs/run (x-admin-secret);
-- a execucao roda DENTRO do site, registrada em voo (#524), com lease atomico.
-- Backoff apos falha: 1 min, 5 min, 30 min, 6 h; na 4a falha vira 'esgotado' (teto fixo, nunca loop).

create table if not exists public.premium_jobs (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references public.pedidos_premium(id) on delete cascade,
  fonte          text not null,                                   -- detran_al, sefaz_al_ipva, recall, leilao, fipe, ...
  status         text not null default 'pendente'
                 check (status in ('pendente', 'rodando', 'ok', 'sem_dado', 'esgotado')),
  tentativas     int  not null default 0 check (tentativas >= 0),
  max_tentativas int  not null default 4 check (max_tentativas between 1 and 10),
  proxima_em     timestamptz not null default now(),
  travado_ate    timestamptz,                                     -- lease do worker (10 min); vencido = volta a pendente
  ultimo_code    int,
  ultimo_erro    text check (ultimo_erro is null or length(ultimo_erro) <= 300),   -- curto, sem PII
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  concluido_em   timestamptz,
  unique (pedido_id, fonte)
);

create index if not exists premium_jobs_fila_idx on public.premium_jobs (status, proxima_em)
  where status in ('pendente', 'rodando');
create index if not exists premium_jobs_pedido_idx on public.premium_jobs (pedido_id);

-- regra da auditoria RLS de 30/set: toda tabela nova com RLS; sem policy = so service_role acessa
alter table public.premium_jobs enable row level security;

create or replace function public.premium_jobs_touch() returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists premium_jobs_touch on public.premium_jobs;
create trigger premium_jobs_touch before update on public.premium_jobs
  for each row execute function public.premium_jobs_touch();

-- lease atomico: pega ate p_limite jobs vencidos. Um 'rodando' com lease vencido (container morreu no meio,
-- ex. OOM) CONTA tentativa: se ja estourou o teto vira 'esgotado' em vez de ser reivindicado de novo
-- (sem isso, um job que derruba o container voltaria para sempre: regra do incidente superbid).
create or replace function public.premium_jobs_reivindicar(p_limite int default 5, p_lease interval default '10 minutes')
returns setof public.premium_jobs language plpgsql security definer set search_path = public as $$
begin
  update public.premium_jobs
     set status = 'esgotado', tentativas = tentativas + 1, travado_ate = null, concluido_em = now(),
         ultimo_erro = left(coalesce(ultimo_erro || ' | ', '') || 'lease vencido (worker morreu no meio)', 300)
   where status = 'rodando' and travado_ate < now() and tentativas + 1 >= max_tentativas;

  return query
  update public.premium_jobs j
     set status = 'rodando', travado_ate = now() + p_lease,
         tentativas = j.tentativas + case when j.status = 'rodando' then 1 else 0 end
   where j.id in (
     select id from public.premium_jobs
      where (status = 'pendente' and proxima_em <= now())
         or (status = 'rodando' and travado_ate < now())
      order by proxima_em
      limit greatest(1, least(p_limite, 20))
      for update skip locked)
  returning j.*;
end $$;

-- registra o resultado de uma tentativa; aplica backoff e teto
create or replace function public.premium_jobs_resultado(p_id uuid, p_status text, p_code int default null, p_erro text default null)
returns public.premium_jobs language plpgsql security definer set search_path = public as $$
declare j public.premium_jobs;
begin
  if p_status in ('ok', 'sem_dado') then
    update public.premium_jobs set status = p_status, ultimo_code = p_code, ultimo_erro = null,
           travado_ate = null, concluido_em = now(), tentativas = tentativas + 1
     where id = p_id returning * into j;
  elsif p_status = 'falha' then
    update public.premium_jobs
       set tentativas = tentativas + 1, ultimo_code = p_code, ultimo_erro = left(p_erro, 300), travado_ate = null,
           status = case when tentativas + 1 >= max_tentativas then 'esgotado' else 'pendente' end,
           concluido_em = case when tentativas + 1 >= max_tentativas then now() end,
           proxima_em = now() + case tentativas + 1 when 1 then interval '1 minute' when 2 then interval '5 minutes'
                                                    when 3 then interval '30 minutes' else interval '6 hours' end
     where id = p_id returning * into j;
  else
    raise exception 'status invalido: %', p_status;
  end if;
  return j;
end $$;

revoke all on function public.premium_jobs_reivindicar(int, interval) from public, anon, authenticated;
revoke all on function public.premium_jobs_resultado(uuid, text, int, text) from public, anon, authenticated;

-- saude da fila (TV/alerta do infra): contagens, sem dado de cliente
create or replace view public.premium_jobs_saude with (security_invoker = true) as
select
  count(*) filter (where status = 'pendente')                                           as pendentes,
  count(*) filter (where status = 'rodando')                                            as rodando,
  count(*) filter (where status = 'pendente' and proxima_em < now() - interval '15 minutes') as atrasados,
  count(*) filter (where status = 'rodando' and travado_ate < now())                   as lease_vencido,
  count(*) filter (where status = 'esgotado' and concluido_em > now() - interval '24 hours') as esgotados_24h,
  count(*) filter (where status in ('ok','sem_dado') and concluido_em > now() - interval '24 hours') as concluidos_24h,
  min(proxima_em) filter (where status = 'pendente')                                   as mais_antigo_pendente
from public.premium_jobs;
revoke all on public.premium_jobs_saude from anon, authenticated;
