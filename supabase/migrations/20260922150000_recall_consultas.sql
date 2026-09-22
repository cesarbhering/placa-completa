-- Detalhe do recall pendente, buscado no portal publico (22/set/2026).
--
-- Cada linha e UMA ida ao portal: guarda o que voltou e quanto custou. As tres
-- leituras que esta tabela precisa servir sao o cache por placa (30 dias), a
-- contagem de tentativas por placa e a soma de gasto do dia, e e por isso que
-- custo_usd fica aqui e nao so no log do provedor.

create table if not exists recall_consultas (
  id uuid primary key default gen_random_uuid(),
  placa text not null,
  consulta_id uuid,
  -- ok | sem_recall | captcha | erro
  status text not null,
  campanhas jsonb not null default '[]'::jsonb,
  -- Resumo do que a pagina mostrou, para conferir um caso estranho na mao.
  texto_pagina text,
  run_id text,
  custo_usd numeric(10, 4) not null default 0,
  criado_em timestamptz not null default now()
);

-- O cache e a contagem de tentativas leem sempre por placa dentro de uma
-- janela de dias; o teto de gasto le a janela do dia inteira.
create index if not exists recall_consultas_placa_criado_idx on recall_consultas (placa, criado_em desc);
create index if not exists recall_consultas_criado_idx on recall_consultas (criado_em desc);

comment on table recall_consultas is 'Uma linha por consulta de detalhe de recall no portal publico: resposta, custo e janela de cache.';
comment on column recall_consultas.custo_usd is 'Custo da execucao. Base do teto de gasto diario.';

notify pgrst, 'reload schema';
