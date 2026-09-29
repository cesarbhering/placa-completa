-- Reserva de hash GCC ("2 hashes de frente"): pre-gera ate 2 hashes de
-- consentimento e guarda pra consumo imediato na venda. Assim uma queda do GCC
-- (que passou a responder 201 "03 Enfileirado" SEM devolver o numero_hash em
-- 29/set, ~17h20-19h13, e estornou a venda LTE5E03) nao derruba mais a entrega:
-- a venda consome um hash ja pronto enquanto o GCC nao volta. Hash tem TTL de
-- 24h (exp do JWT); margem de 1h no consumo (nunca usa hash com <1h de vida).

alter table public.gcc_consentimentos
  -- denormaliza o ambiente do gcc_api_keys pro claim atomico filtrar sem join
  add column if not exists ambiente text,
  -- validade do hash (exp do JWT, ~24h). So faz sentido pra linha de reserva.
  add column if not exists expira_em timestamptz;

comment on column public.gcc_consentimentos.ambiente is
  'producao|homolog. Denormalizado do gcc_api_keys pro claim atomico da reserva filtrar sem join.';
comment on column public.gcc_consentimentos.expira_em is
  'Validade do hash (exp do JWT, ~24h). A reserva so e consumida com >1h de vida.';
-- status agora tambem assume 'reserva' (pre-gerado, nao usado) e 'em_uso'
-- (reivindicado pra uma venda, ainda nao gasto), alem de created|spent|error.
-- Nao ha CHECK na coluna, entao o dominio fica documentado aqui.

-- Claim atomico da reserva: FIFO (mais antigo primeiro), so hash com >1h de
-- vida, trava a linha (for update skip locked) pra dois pedidos concorrentes
-- NUNCA pegarem o mesmo hash. Marca 'em_uso' e devolve; 0 linhas = reserva
-- vazia (o chamador pede um hash novo na hora, fluxo de sempre).
create or replace function public.reivindicar_hash_reserva(p_ambiente text)
returns table (id uuid, numero_hash_consulta text, api_key_id uuid)
language plpgsql
as $$
begin
  return query
  update public.gcc_consentimentos g
     set status = 'em_uso'
   where g.id = (
     select c.id
       from public.gcc_consentimentos c
      where c.status = 'reserva'
        and c.ambiente = p_ambiente
        and c.expira_em > now() + interval '1 hour'
      order by c.created_at asc
      limit 1
      for update skip locked
   )
  returning g.id, g.numero_hash_consulta, g.api_key_id;
end;
$$;

-- Indice do claim: acha rapido a reserva mais antiga valida por ambiente.
create index if not exists gcc_consentimentos_reserva_idx
  on public.gcc_consentimentos (ambiente, created_at)
  where status = 'reserva';

-- Saude do GCC pro alerta (uma linha por ambiente). O repositor atualiza isto:
-- quando o GCC para de devolver hash ("03 Enfileirado"/401/5xx), marca gcc_ok
-- false + guarda 'desde'; manda e-mail pro Cesar com cooldown de 1h (ultimo_alerta)
-- e outro quando volta. Persistente pra sobreviver a restart do container.
create table if not exists public.gcc_reserva_estado (
  ambiente text primary key,               -- 'producao' | 'homolog'
  gcc_ok boolean not null default true,    -- ultima checagem conseguiu hash?
  desde timestamptz,                       -- inicio da janela atual (down desde / ok desde)
  ultimo_alerta timestamptz,               -- ultimo e-mail de "fora" enviado (cooldown 1h)
  atualizado_em timestamptz not null default now()
);
alter table public.gcc_reserva_estado enable row level security;
-- Sem policy: so o service role (que ignora RLS) le/escreve. Superficie zero.

notify pgrst, 'reload schema';
