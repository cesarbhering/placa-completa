-- Vehicle history partner (second partner base), Cesar 13/11/2026: one row per ATTEMPT (error, timeout
-- and cache hit included) to audit consumption and match the vendor invoice. premium_custos keeps the
-- cost (the finance agent reads it there); this table is the detail. Name without the vendor.
-- resposta_bruta holds the WHOLE answer, with name and CPF/CNPJ of every owner of the vehicle:
-- RLS on and NO policy (only service_role reads it), no grant to anon or authenticated. Nothing of it
-- goes to the report snapshot, the report JSON, the screen, e-mail or logs.
create table if not exists public.parceiro_historico_chamadas (
  id                    uuid primary key default gen_random_uuid(),
  pedido_id             uuid references public.pedidos_premium(id) on delete set null,
  placa                 text,
  http_status           integer,
  sucesso               boolean not null default false,
  cobrada               boolean not null default false,
  custo_centavos        integer not null default 0,
  tempo_ms              integer,
  id_consulta_parceiro  text,
  cache_hit             boolean not null default false,
  -- reserved before the call (daily ceiling), cleared when the answer comes
  em_andamento          boolean not null default false,
  motivo_erro           text,
  resposta_bruta        jsonb,
  criado_em             timestamptz not null default now()
);

create index if not exists parceiro_historico_chamadas_placa_idx on public.parceiro_historico_chamadas (placa, criado_em desc);
create index if not exists parceiro_historico_chamadas_pedido_idx on public.parceiro_historico_chamadas (pedido_id);
-- daily ceiling: paid calls and reservations in progress since the start of the day
create index if not exists parceiro_historico_chamadas_dia_idx on public.parceiro_historico_chamadas (criado_em) where not cache_hit;

-- One charge per order: the code has a lock per order and per plate; this index is the guarantee in the database
-- (a second paid row of the same order is refused; the code stores it as cobrada=false with
-- "COBRANCA DUPLICADA" and alerts).
create unique index if not exists parceiro_historico_chamadas_uma_cobranca_uq
  on public.parceiro_historico_chamadas (pedido_id)
  where cobrada and pedido_id is not null;

alter table public.parceiro_historico_chamadas enable row level security;
revoke all on table public.parceiro_historico_chamadas from anon, authenticated;

-- Daily ceiling (review 1 of PR #752): the ceiling counts PAID calls of the day plus the reservations
-- in progress (an attempt with an error does not count). Each call reserves its row here BEFORE calling,
-- under a transaction lock, so simultaneous calls never pass it. A reservation older than 5 minutes no
-- longer counts (the process died in the middle). Returns the row id, or null at the ceiling.
create or replace function public.parceiro_historico_reservar(p_pedido uuid, p_placa text, p_teto int, p_desde timestamptz)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_feitas int;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('parceiro_historico_teto'));
  select count(*) into v_feitas
    from public.parceiro_historico_chamadas
   where criado_em >= p_desde
     and not cache_hit
     and (cobrada or (em_andamento and criado_em > now() - interval '5 minutes'));
  if v_feitas >= p_teto then
    return null;
  end if;
  insert into public.parceiro_historico_chamadas (pedido_id, placa, em_andamento, motivo_erro)
  values (p_pedido, p_placa, true, 'em andamento')
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.parceiro_historico_reservar(uuid, text, int, timestamptz) from public, anon, authenticated;

-- The vehicle history block goes into the order snapshot by jsonb_set on its own key only (review 1 of
-- PR #752): it never rewrites what other sources wrote. A block that is not ok never replaces one that is.
create or replace function public.snapshot_gravar_historico_veicular(p_pedido uuid, p_valor jsonb)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_linhas int := 0;
begin
  update public.pedidos_premium
     set relatorio_snapshot = jsonb_set(relatorio_snapshot, array['historicoVeicular'], p_valor, true)
   where id = p_pedido
     and relatorio_snapshot is not null
     and jsonb_typeof(relatorio_snapshot) = 'object'
     and not (coalesce(relatorio_snapshot -> 'historicoVeicular' ->> 'status', '') = 'ok'
              and coalesce(p_valor ->> 'status', '') <> 'ok');
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end $$;
revoke all on function public.snapshot_gravar_historico_veicular(uuid, jsonb) from public, anon, authenticated;

comment on table public.parceiro_historico_chamadas is
  'Contem dado pessoal: resposta_bruta traz nome e CPF/CNPJ de todos os donos do veiculo. So o servidor le (RLS sem policy). Uma linha por tentativa de consulta a base parceira de historico veicular (inclusive erro e cache hit).';
comment on column public.parceiro_historico_chamadas.resposta_bruta is
  'Resposta inteira do fornecedor, com dado pessoal. Nunca sai daqui.';

notify pgrst, 'reload schema';
