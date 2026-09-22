-- Debitos e restricoes do veiculo no orgao de transito estadual, comecando por
-- SP (22/set/2026). Disparado quando a consulta paga do SENATRAN traz
-- indicadorMultaRenainf=true e o veiculo e de SP: o registro so diz que existe
-- multa, e quem pagou quer o VALOR e o detalhe.
--
-- Cada linha e UMA consulta: guarda o que voltou (multas, IPVA, licenciamento,
-- historico de hodometro e restricoes), a captura bruta pra conferencia, e
-- quanto custou. O custo fica aqui porque o teto de gasto do dia soma esta
-- tabela com a de recall.

create table if not exists multas_consultas (
  id uuid primary key default gen_random_uuid(),
  placa text not null,
  consulta_id uuid,
  uf text,
  -- ok | sem_debito | sessao_expirada | captcha | erro
  status text not null,
  multas_total_centavos int,
  ipva_total_centavos int,
  licenciamento_centavos int,
  licenciamento_venc date,
  -- [{ "data": "2020-09-16", "km": 125599 }, ...] em ordem cronologica
  hodometro jsonb,
  -- true quando alguma leitura de km e menor que uma leitura anterior
  hodometro_suspeito boolean,
  -- { bloqueio_furto_roubo, tributaria, financeira, administrativa, judicial, guincho }
  restricoes jsonb,
  -- Captura bruta do que a pagina trouxe, pra conferir um caso estranho na mao.
  bruto jsonb,
  run_id text,
  custo_usd numeric(10, 4) not null default 0,
  criado_em timestamptz not null default now()
);

-- O cache e a contagem de tentativas leem por placa dentro de uma janela de
-- dias; o teto de gasto le a janela do dia inteira.
create index if not exists multas_consultas_placa_criado_idx on multas_consultas (placa, criado_em desc);
create index if not exists multas_consultas_criado_idx on multas_consultas (criado_em desc);

comment on table multas_consultas is 'Uma linha por consulta de debitos e restricoes no orgao de transito estadual: resposta, captura bruta, custo e janela de cache.';
comment on column multas_consultas.custo_usd is 'Custo da execucao. Somado ao recall no teto de gasto diario.';
comment on column multas_consultas.hodometro_suspeito is 'true quando alguma leitura de km e menor que uma leitura cronologicamente anterior.';

notify pgrst, 'reload schema';
