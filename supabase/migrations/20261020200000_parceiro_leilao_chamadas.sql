-- Base parceira de leiloes e sinistros (Cesar, 20/out/2026): uma linha por TENTATIVA de consulta
-- (inclusive erro, timeout e cache hit), para auditar o consumo e cruzar com a fatura do fornecedor
-- (a API dele nao tem endpoint de consumo). premium_custos continua com o custo (o fin le de la);
-- esta tabela e o detalhe. Nome sem citar o fornecedor.
create table if not exists public.parceiro_leilao_chamadas (
  id                      uuid primary key default gen_random_uuid(),
  pedido_id               uuid references public.pedidos_premium(id) on delete set null,
  placa                   text,
  parametro_enviado       text,
  tipo_parametro          text check (tipo_parametro in ('placa', 'chassi')),
  id_consulta_parceiro    text,
  data_consulta_parceiro  text,
  tempo_parceiro_ms       integer,
  tempo_total_ms          integer,
  http_status             integer,
  cobrada                 boolean not null default false,
  preco_centavos          integer not null default 0,
  motivo_erro             text,
  tem_registro_leilao     boolean,
  n_leiloes               integer,
  indicio_sinistro        boolean,
  mensagem_sinistro       text,
  nossa_base_vazia        boolean not null default true,
  cache_hit               boolean not null default false,
  resposta_bruta          jsonb,
  criado_em               timestamptz not null default now()
);

create unique index if not exists parceiro_leilao_chamadas_id_consulta_uq
  on public.parceiro_leilao_chamadas (id_consulta_parceiro)
  where id_consulta_parceiro is not null and cache_hit = false;
create index if not exists parceiro_leilao_chamadas_criado_idx on public.parceiro_leilao_chamadas (criado_em);
create index if not exists parceiro_leilao_chamadas_pedido_idx on public.parceiro_leilao_chamadas (pedido_id);

-- regra da auditoria RLS de 30/set: toda tabela nova com RLS; sem policy = so service_role acessa
alter table public.parceiro_leilao_chamadas enable row level security;

-- Consumo por dia (Brasilia) para o fin e o dashboard TV.
create or replace view public.parceiro_leilao_consumo_diario
with (security_invoker = true) as
select
  (criado_em at time zone 'America/Sao_Paulo')::date                       as dia,
  count(*) filter (where not cache_hit)                                    as chamadas,
  count(*) filter (where cobrada)                                          as cobradas,
  coalesce(sum(preco_centavos), 0)::bigint                                 as custo_centavos,
  count(*) filter (where cobrada and tem_registro_leilao)                  as com_registro,
  count(*) filter (where cobrada and indicio_sinistro)                     as com_sinistro,
  count(*) filter (where not cache_hit and not cobrada)                    as erros,
  count(*) filter (where cache_hit)                                        as cache_hits
from public.parceiro_leilao_chamadas
group by 1;

revoke all on public.parceiro_leilao_consumo_diario from anon, authenticated;
grant select on public.parceiro_leilao_consumo_diario to service_role;

comment on table public.parceiro_leilao_chamadas is
  'Toda tentativa de consulta a base parceira de leiloes e sinistros (inclusive erro e cache hit). Auditoria e cruzamento com a fatura.';

notify pgrst, 'reload schema';
