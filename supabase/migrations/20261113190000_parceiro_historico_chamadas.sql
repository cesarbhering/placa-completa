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
  motivo_erro           text,
  resposta_bruta        jsonb,
  criado_em             timestamptz not null default now()
);

create index if not exists parceiro_historico_chamadas_placa_idx on public.parceiro_historico_chamadas (placa, criado_em desc);
create index if not exists parceiro_historico_chamadas_pedido_idx on public.parceiro_historico_chamadas (pedido_id);
-- daily ceiling: paid calls (no cache hit) since the start of the day
create index if not exists parceiro_historico_chamadas_dia_idx on public.parceiro_historico_chamadas (criado_em) where not cache_hit;

-- One charge per order: the code has a lock per order; this index is the guarantee in the database
-- (a second paid row of the same order is refused; the code stores it as cobrada=false with
-- "COBRANCA DUPLICADA" and alerts).
create unique index if not exists parceiro_historico_chamadas_uma_cobranca_uq
  on public.parceiro_historico_chamadas (pedido_id)
  where cobrada and pedido_id is not null;

alter table public.parceiro_historico_chamadas enable row level security;
revoke all on table public.parceiro_historico_chamadas from anon, authenticated;

comment on table public.parceiro_historico_chamadas is
  'Contem dado pessoal: resposta_bruta traz nome e CPF/CNPJ de todos os donos do veiculo. So o servidor le (RLS sem policy). Uma linha por tentativa de consulta a base parceira de historico veicular (inclusive erro e cache hit).';
comment on column public.parceiro_historico_chamadas.resposta_bruta is
  'Resposta inteira do fornecedor, com dado pessoal. Nunca sai daqui.';

notify pgrst, 'reload schema';
